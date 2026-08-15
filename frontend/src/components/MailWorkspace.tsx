import {
  ChevronUp,
  Eraser,
  Inbox,
  LogOut,
  Mailbox,
  PenLine,
  RefreshCw,
  Send,
  UserCog,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api, type EmailDetail, type EmailSummary, type MailboxItem, type Quota, type Session, type SentDetail, type SentSummary } from '../lib/api'
import { domainOf } from '../lib/format'
import { Brand, ThemeToggle } from './Chrome'
import { ComposeDialog } from './ComposeDialog'
import { MailboxSwitcher } from './MailboxSwitcher'
import { MessageList } from './MessageList'
import { MessageReader } from './MessageReader'
import { QuickMailboxGenerator } from './QuickMailboxGenerator'

export type Folder = 'inbox' | 'sent'
type ShowToast = (message: string, kind?: 'success' | 'error' | 'info') => void
export type Navigate = (route: 'login' | 'app' | 'mailboxes' | 'admin' | 'mailbox') => void

export function roleLabel(session: Session): string {
  if (session.strictAdmin) return '超级管理员'
  if (session.role === 'admin') return '高级用户'
  if (session.role === 'user') return '用户'
  if (session.role === 'guest') return '演示模式'
  return '邮箱用户'
}

function mailboxStorageKey(session: Session): string {
  return `mf:mailbox:${session.role}:${session.username}`
}

export function MailSidebar({
  session,
  folder,
  unreadCount,
  canUseSent = true,
  adminView,
  onFolderChange,
  onNavigate,
  onLogout,
}: {
  session: Session
  folder: Folder
  unreadCount: number
  canUseSent?: boolean
  adminView?: 'mailboxes' | 'admin'
  onFolderChange: (folder: Folder) => void
  onNavigate: Navigate
  onLogout: () => void
}) {
  const showAdmin = session.strictAdmin || session.role === 'guest'
  const [adminMenuOpen, setAdminMenuOpen] = useState(!!adminView)

  const folders: Array<{ id: Folder; label: string; icon: typeof Inbox; count: number }> = [
    { id: 'inbox', label: '收件箱', icon: Inbox, count: unreadCount },
    ...(canUseSent ? [{ id: 'sent' as Folder, label: '已发送', icon: Send, count: 0 }] : []),
  ]

  return (
    <aside className={`mail-sidebar ${showAdmin ? 'is-admin' : ''}`}>
      <div className="sidebar-brand"><Brand /></div>
      <div className="sidebar-theme"><ThemeToggle /></div>
      <nav className="folder-nav" aria-label="邮箱文件夹">
        {folders.map((item) => {
          const Icon = item.icon
          return (
            <button
              className={folder === item.id ? 'is-active' : ''}
              type="button"
              key={item.id}
              onClick={() => {
                setAdminMenuOpen(false)
                onFolderChange(item.id)
              }}
            >
              <Icon size={18} />
              <span>{item.label}</span>
              {item.count > 0 && <small>{item.count > 99 ? '99+' : item.count}</small>}
            </button>
          )
        })}
      </nav>

      {showAdmin && (
        <>
          <button
            className={`admin-nav-toggle${adminMenuOpen ? ' is-open' : ''}`}
            type="button"
            aria-controls="mailfree-admin-navigation"
            aria-expanded={adminMenuOpen}
            aria-label={adminMenuOpen ? '收起管理功能' : '展开管理功能'}
            onClick={() => setAdminMenuOpen((open) => !open)}
          >
            <ChevronUp size={17} aria-hidden="true" />
          </button>
          <nav
            id="mailfree-admin-navigation"
            className={`admin-nav${adminMenuOpen ? ' is-open' : ''}`}
            aria-label="管理功能"
          >
            <button
              className={adminView === 'mailboxes' ? 'is-active' : ''}
              type="button"
              onClick={() => {
                setAdminMenuOpen(false)
                onNavigate('mailboxes')
              }}
            >
              <Mailbox size={18} />
              <span>所有邮箱</span>
            </button>
            <button
              className={adminView === 'admin' ? 'is-active' : ''}
              type="button"
              onClick={() => {
                setAdminMenuOpen(false)
                onNavigate('admin')
              }}
            >
              <UserCog size={18} />
              <span>用户管理</span>
            </button>
          </nav>
        </>
      )}

      <nav className="account-nav" aria-label="账号操作">
        <button type="button" onClick={onLogout}>
          <LogOut size={18} />
          <span>退出登录</span>
        </button>
      </nav>

      <div className="sidebar-account">
        <span className="account-avatar">{session.username.slice(0, 1).toUpperCase()}</span>
        <div>
          <strong>{session.role === 'mailbox' ? session.mailboxAddress : session.username}</strong>
          <span>{session.role === 'mailbox' ? '单邮箱账号' : `@${session.username}`}</span>
          <small className="account-role">{roleLabel(session)}</small>
        </div>
      </div>
    </aside>
  )
}

type Selection =
  | { kind: 'email'; summary: EmailSummary; detail: EmailDetail }
  | { kind: 'sent'; summary: SentSummary; detail: SentDetail }
  | null

export function MailWorkspace({
  session,
  onNavigate,
  onLogout,
  showToast,
}: {
  session: Session
  onNavigate: Navigate
  onLogout: () => void
  showToast: ShowToast
}) {
  const [folder, setFolder] = useState<Folder>('inbox')
  const [domains, setDomains] = useState<string[]>([])
  const [mailboxes, setMailboxes] = useState<MailboxItem[]>([])
  const [mailboxesLoaded, setMailboxesLoaded] = useState(false)
  const [currentMailbox, setCurrentMailbox] = useState('')
  const [quota, setQuota] = useState<Quota | null>(null)
  const [emails, setEmails] = useState<EmailSummary[]>([])
  const [sentEmails, setSentEmails] = useState<SentSummary[]>([])
  const [listLoading, setListLoading] = useState(true)
  const [selection, setSelection] = useState<Selection>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [composeOpen, setComposeOpen] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const selectionRef = useRef<Selection>(null)
  selectionRef.current = selection

  const reloadMailboxes = useCallback(async () => {
    try {
      const data = await api.mailboxes({ page: 1, size: 200 })
      setMailboxes(data.list || [])
      setMailboxesLoaded(true)
      return data.list || []
    } catch {
      setMailboxesLoaded(true)
      return []
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const [domainList, quotaData] = await Promise.allSettled([api.domains(), api.quota()])
      if (cancelled) return
      if (domainList.status === 'fulfilled') setDomains(domainList.value)
      if (quotaData.status === 'fulfilled') setQuota(quotaData.value)
      const list = await reloadMailboxes()
      if (cancelled) return
      let stored = ''
      try {
        stored = localStorage.getItem(mailboxStorageKey(session)) || ''
      } catch {
        // ignore unavailable storage
      }
      const exists = list.some((mailbox) => mailbox.address === stored)
      setCurrentMailbox(exists ? stored : list[0]?.address || '')
    })()
    return () => {
      cancelled = true
    }
  }, [reloadMailboxes, session])

  const selectMailbox = useCallback((address: string) => {
    setCurrentMailbox(address)
    setSelection(null)
    try {
      localStorage.setItem(mailboxStorageKey(session), address)
    } catch {
      // ignore unavailable storage
    }
  }, [session])

  const refreshList = useCallback(async (silent = false) => {
    if (!currentMailbox) return
    if (!silent) setRefreshing(true)
    try {
      if (folder === 'inbox') {
        const list = await api.emails(currentMailbox, 50)
        setEmails(list || [])
      } else {
        const list = await api.sent(currentMailbox, 50)
        setSentEmails(list || [])
      }
    } catch (error) {
      if (!silent) showToast(error instanceof Error ? error.message : '刷新失败', 'error')
    } finally {
      setListLoading(false)
      setRefreshing(false)
    }
  }, [currentMailbox, folder, showToast])

  useEffect(() => {
    if (!currentMailbox) return
    setListLoading(true)
    setSelection(null)
    void refreshList()
  }, [currentMailbox, folder, refreshList])

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return
      if (selectionRef.current?.kind === 'email') return
      void refreshList(true)
    }, 30000)
    return () => window.clearInterval(timer)
  }, [refreshList])

  const openEmail = useCallback(async (summary: EmailSummary) => {
    setDetailLoading(true)
    try {
      const detail = await api.emailDetail(summary.id)
      setSelection({ kind: 'email', summary, detail })
      setEmails((current) => current.map((item) =>
        item.id === summary.id ? { ...item, is_read: 1 } : item,
      ))
    } catch (error) {
      showToast(error instanceof Error ? error.message : '无法打开邮件', 'error')
    } finally {
      setDetailLoading(false)
    }
  }, [showToast])

  const openSent = useCallback(async (summary: SentSummary) => {
    setDetailLoading(true)
    try {
      const detail = await api.sentDetail(summary.id)
      setSelection({ kind: 'sent', summary, detail })
    } catch (error) {
      showToast(error instanceof Error ? error.message : '无法打开发件记录', 'error')
    } finally {
      setDetailLoading(false)
    }
  }, [showToast])

  const deleteEmail = useCallback(async () => {
    if (selection?.kind !== 'email') return
    try {
      await api.deleteEmail(selection.detail.id)
      showToast('邮件已删除')
      setSelection(null)
      void refreshList(true)
    } catch (error) {
      showToast(error instanceof Error ? error.message : '删除失败', 'error')
    }
  }, [refreshList, selection, showToast])

  const clearMailbox = useCallback(async () => {
    if (!currentMailbox) return
    if (!window.confirm(`确定清空 ${currentMailbox} 的全部收件吗？此操作不可恢复。`)) return
    try {
      const result = await api.clearEmails(currentMailbox)
      showToast(`已清空 ${result.deletedCount} 封邮件`)
      setSelection(null)
      void refreshList(true)
    } catch (error) {
      showToast(error instanceof Error ? error.message : '清空失败', 'error')
    }
  }, [currentMailbox, refreshList, showToast])

  const deleteSent = useCallback(async () => {
    if (selection?.kind !== 'sent') return
    try {
      await fetch(`/api/sent/${selection.detail.id}`, { method: 'DELETE', credentials: 'include' })
      showToast('发件记录已删除')
      setSelection(null)
      void refreshList(true)
    } catch {
      showToast('删除发件记录失败', 'error')
    }
  }, [refreshList, selection, showToast])

  const unreadCount = useMemo(
    () => emails.filter((email) => !email.is_read).length,
    [emails],
  )

  const keyword = search.trim().toLowerCase()
  const visibleEmails = useMemo(() => {
    if (!keyword) return emails
    return emails.filter((email) =>
      `${email.subject} ${email.sender} ${email.preview}`.toLowerCase().includes(keyword),
    )
  }, [emails, keyword])

  const visibleSent = useMemo(() => {
    if (!keyword) return sentEmails
    return sentEmails.filter((item) =>
      `${item.subject} ${item.recipients}`.toLowerCase().includes(keyword),
    )
  }, [keyword, sentEmails])

  async function handleMailboxCreated(address: string) {
    await reloadMailboxes()
    selectMailbox(address)
    setFolder('inbox')
    showToast(`已生成邮箱 ${address}`)
  }

  return (
    <div className={`mail-layout${selection ? ' has-selection' : ''}`}>
      <MailSidebar
        session={session}
        folder={folder}
        unreadCount={unreadCount}
        onFolderChange={setFolder}
        onNavigate={onNavigate}
        onLogout={onLogout}
      />

      <section className="list-pane">
        <header className="list-header">
          <div>
            <MailboxSwitcher
              mailboxes={mailboxes}
              loaded={mailboxesLoaded}
              domains={domains}
              current={currentMailbox}
              quota={quota}
              canManage={session.role !== 'mailbox'}
              onSelect={selectMailbox}
              onPinToggled={() => void reloadMailboxes()}
              showToast={showToast}
            />
            <h1>{folder === 'inbox' ? '收件箱' : '已发送'}</h1>
          </div>
          <div className="list-header__actions">
            <QuickMailboxGenerator
              domains={domains}
              disabled={!mailboxesLoaded}
              onCreated={handleMailboxCreated}
            />
            <button
              className="icon-button"
              type="button"
              aria-label="刷新列表"
              data-tooltip="刷新列表"
              disabled={refreshing || !currentMailbox}
              onClick={() => void refreshList()}
            >
              <RefreshCw className={refreshing ? 'spin' : undefined} size={17} />
            </button>
            {folder === 'inbox' && (
              <button
                className="icon-button icon-button--danger"
                type="button"
                aria-label="清空邮箱"
                data-tooltip="清空邮箱"
                disabled={!currentMailbox || !emails.length}
                onClick={() => void clearMailbox()}
              >
                <Eraser size={16} />
              </button>
            )}
            <button
              className="button button--primary compose-trigger"
              type="button"
              disabled={!currentMailbox}
              onClick={() => setComposeOpen(true)}
            >
              <PenLine size={16} />
              <span>写邮件</span>
            </button>
          </div>
        </header>

        <div className="search-field">
          {folder === 'inbox' ? <Inbox size={15} /> : <Send size={15} />}
          <input
            type="search"
            value={search}
            placeholder={folder === 'inbox' ? '搜索邮件主题、发件人或正文预览' : '搜索已发送邮件'}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        {folder === 'inbox' ? (
          <MessageList
            loading={listLoading && !emails.length}
            messages={visibleEmails}
            kind="inbox"
            selectedId={selection?.kind === 'email' ? selection.detail.id : null}
            onSelect={(message) => void openEmail(message as EmailSummary)}
          />
        ) : (
          <MessageList
            loading={listLoading && !sentEmails.length}
            messages={visibleSent}
            kind="sent"
            selectedId={selection?.kind === 'sent' ? selection.detail.id : null}
            onSelect={(message) => void openSent(message as SentSummary)}
          />
        )}
      </section>

      <section className="reader-pane">
        <MessageReader
          selection={selection}
          loading={detailLoading}
          mailbox={currentMailbox}
          canCompose={session.role !== 'mailbox' && session.role !== 'guest'}
          onBack={() => setSelection(null)}
          onDelete={() => (selection?.kind === 'email' ? void deleteEmail() : void deleteSent())}
          onCompose={() => setComposeOpen(true)}
          showToast={showToast}
        />
      </section>

      {composeOpen && currentMailbox && (
        <ComposeDialog
          from={currentMailbox}
          mailboxes={mailboxes.map((mailbox) => mailbox.address)}
          onClose={() => setComposeOpen(false)}
          onSent={() => {
            setComposeOpen(false)
            showToast('邮件发送成功')
            if (folder === 'sent') void refreshList(true)
          }}
        />
      )}
    </div>
  )
}

export { domainOf }
