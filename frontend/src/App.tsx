import { useCallback, useEffect, useMemo, useState } from 'react'
import { api, ApiError, type Session } from './lib/api'
import { AdminWorkspace } from './components/AdminWorkspace'
import { ConnectionError, PageLoader, Toast, useToast } from './components/Chrome'
import { LoginPage } from './components/LoginPage'
import { MailboxRolePage } from './components/MailboxRolePage'
import { MailWorkspace } from './components/MailWorkspace'
import { MailboxesOverview } from './components/MailboxesOverview'

type AppRoute = 'login' | 'app' | 'mailboxes' | 'admin' | 'mailbox'

const ROUTES: AppRoute[] = ['login', 'app', 'mailboxes', 'admin', 'mailbox']

function readRoute(): AppRoute {
  const value = window.location.hash.replace(/^#\/?/, '').split('?')[0] as AppRoute
  return ROUTES.includes(value) ? value : 'app'
}

function defaultRoute(session: Session): AppRoute {
  if (session.role === 'mailbox') return 'mailbox'
  return 'app'
}

function routeAllowed(route: AppRoute, session: Session): boolean {
  if (route === 'login') return true
  switch (route) {
    case 'admin':
    case 'mailboxes':
      return session.strictAdmin || session.role === 'guest'
    case 'mailbox':
      return session.role === 'mailbox'
    default:
      return true
  }
}

type Bootstrap =
  | { state: 'loading' }
  | { state: 'error'; message: string }
  | { state: 'anonymous' }
  | { state: 'ready'; session: Session }

export function App() {
  const [bootstrap, setBootstrap] = useState<Bootstrap>({ state: 'loading' })
  const [route, setRoute] = useState<AppRoute>(() => readRoute())
  const { toast, showToast, dismissToast } = useToast()

  useEffect(() => {
    const onHashChange = () => setRoute(readRoute())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const loadSession = useCallback(async () => {
    setBootstrap({ state: 'loading' })
    try {
      const session = await api.session()
      setBootstrap({ state: 'ready', session })
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setBootstrap({ state: 'anonymous' })
      } else {
        setBootstrap({
          state: 'error',
          message: error instanceof Error ? error.message : '网络异常，请稍后重试。',
        })
      }
    }
  }, [])

  useEffect(() => {
    void loadSession()
  }, [loadSession])

  const navigate = useCallback((next: AppRoute) => {
    window.location.hash = `#/${next}`
    setRoute(next)
  }, [])

  const handleLogout = useCallback(async () => {
    try {
      await api.logout()
    } catch {
      // ignore network failures during logout
    }
    navigate('login')
    setBootstrap({ state: 'anonymous' })
  }, [navigate])

  const effectiveRoute = useMemo<AppRoute>(() => {
    if (bootstrap.state !== 'ready') return route
    if (route === 'login') return 'login'
    if (!routeAllowed(route, bootstrap.session)) return defaultRoute(bootstrap.session)
    return route
  }, [bootstrap, route])

  if (bootstrap.state === 'loading') return <PageLoader />
  if (bootstrap.state === 'error') {
    return <ConnectionError message={bootstrap.message} retry={() => void loadSession()} />
  }

  if (bootstrap.state === 'anonymous' || effectiveRoute === 'login') {
    return (
      <>
        <LoginPage
          onAuthenticated={(session) => {
            setBootstrap({ state: 'ready', session })
            navigate(defaultRoute(session))
          }}
        />
        {toast && <Toast key={toast.key} message={toast.message} kind={toast.kind} onClose={dismissToast} />}
      </>
    )
  }

  const session = bootstrap.session

  return (
    <>
      {effectiveRoute === 'app' && (
        <MailWorkspace session={session} onNavigate={navigate} onLogout={handleLogout} showToast={showToast} />
      )}
      {effectiveRoute === 'mailbox' && (
        <MailboxRolePage session={session} onNavigate={navigate} onLogout={handleLogout} showToast={showToast} />
      )}
      {effectiveRoute === 'mailboxes' && (
        <MailboxesOverview session={session} onNavigate={navigate} onLogout={handleLogout} showToast={showToast} />
      )}
      {effectiveRoute === 'admin' && (
        <AdminWorkspace session={session} onNavigate={navigate} onLogout={handleLogout} showToast={showToast} />
      )}
      {toast && <Toast key={toast.key} message={toast.message} kind={toast.kind} onClose={dismissToast} />}
    </>
  )
}
