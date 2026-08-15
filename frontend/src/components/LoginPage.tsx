import { AlertCircle, LoaderCircle, LogIn } from 'lucide-react'
import { useState } from 'react'
import { api, ApiError, type Session } from '../lib/api'
import { Brand, ThemeToggle } from './Chrome'
import { MailfreeLogo } from './MailfreeLogo'

export function LoginPage({ onAuthenticated }: { onAuthenticated: (session: Session) => void }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setError('')
    try {
      await api.login(username.trim(), password)
      const session = await api.session()
      onAuthenticated(session)
    } catch (submitError) {
      if (submitError instanceof ApiError && submitError.status === 401) {
        setError('用户名或密码错误。')
      } else {
        setError(submitError instanceof Error ? submitError.message : '登录失败，请稍后重试。')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-page__top">
        <Brand />
        <ThemeToggle />
      </div>
      <section className="auth-card">
        <span className="auth-symbol"><MailfreeLogo size={26} /></span>
        <p className="eyebrow">WELCOME BACK</p>
        <h1>登录 Mailfree</h1>
        <form className="auth-form" onSubmit={submit}>
          <label>
            <span>账号</span>
            <input
              autoFocus
              autoComplete="username"
              value={username}
              placeholder="用户名 / 邮箱地址"
              onChange={(event) => setUsername(event.target.value)}
              required
            />
          </label>
          <label>
            <span>密码</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              placeholder="输入密码"
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
          {error && <p className="form-error" role="alert"><AlertCircle size={16} />{error}</p>}
          <button
            className="button button--primary auth-submit"
            type="submit"
            disabled={submitting}
          >
            {submitting ? <LoaderCircle className="spin" size={17} /> : <LogIn size={17} />}
            登录
          </button>
        </form>
      </section>
    </main>
  )
}
