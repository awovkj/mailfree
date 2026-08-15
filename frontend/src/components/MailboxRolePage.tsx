import { Eraser, Inbox, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api, type EmailDetail, type EmailSummary, type Session } from '../lib/api'
import { MailSidebar } from './MailWorkspace'
import type { Navigate } from './MailWorkspace'
import { MessageList } from './MessageList'
import { MessageReader } from './MessageReader'

type ShowToast = (message: string, kind?: 'success' | 'error' | 'info') => void

type Selection =
  | { kind: 'email'; summary: EmailSummary; detail: EmailDetail }
  | null

export function MailboxRolePage({
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
  const mailbox = session.mailboxAddress || ''
  const [emails, setEmails] = useState<EmailSummary[]>([])
  const [listLoading, setListLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [selection, setSelection] = useState<Selection>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [search, setSearch] = useState('')
  const selectionRef = useRef<Selection>(null)
  selectionRef.current = selection

  const refreshList = useCallback(async (silent = false) => {
    if (!mailbox) return
    if (!silent) setRefreshing(true)
    try {
      const list = await api.emails(mailbox, 50)
      setEmails(list || [])
    } catch (error) {
      if (!silent) showToast(error instanceof Error ? error.message : '刷新失败', 'error')
    } finally {
      setListLoading(false)
      setRefreshing(false)
    }
  }, [mailbox, showToast])

  useEffect(() => {
    void refreshList()
  }, [refreshList])

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return
      if (selectionRef.current) return
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

  const deleteEmail = useCallback(async () => {
    if (!selection) return
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
    if (!mailbox) return
    if (!window.confirm(`确定清空 ${mailbox} 的全部收件吗？此操作不可恢复。`)) return
    try {
      const result = await api.clearEmails(mailbox)
      showToast(`已清空 ${result.deletedCount} 封邮件`)
      setSelection(null)
      void refreshList(true)
    } catch (error) {
      showToast(error instanceof Error ? error.message : '清空失败', 'error')
    }
  }, [mailbox, refreshList, showToast])

  const unreadCount = useMemo(() => emails.filter((email) => !email.is_read).length, [emails])

  const keyword = search.trim().toLowerCase()
  const visibleEmails = useMemo(() => {
    if (!keyword) return emails
    return emails.filter((email) =>
      `${email.subject} ${email.sender} ${email.preview}`.toLowerCase().includes(keyword),
    )
  }, [emails, keyword])

  return (
    <div className={`mail-layout${selection ? ' has-selection' : ''}`}>
      <MailSidebar
        session={session}
        folder="inbox"
        unreadCount={unreadCount}
        canUseSent={false}
        onFolderChange={() => undefined}
        onNavigate={onNavigate}
        onLogout={onLogout}
      />

      <section className="list-pane">
        <header className="list-header">
          <div>
            <span
              className="mailbox-scope-trigger"
              style={{ cursor: 'default', margin: '0 0 6px -7px' }}
              aria-disabled="true"
            >
              <span>MAILBOX ACCOUNT</span>
              <strong>{mailbox || '…'}</strong>
            </span>
            <h1>收件箱</h1>
          </div>
          <div className="list-header__actions">
            <button
              className="icon-button"
              type="button"
              aria-label="刷新列表"
              data-tooltip="刷新列表"
              disabled={refreshing || !mailbox}
              onClick={() => void refreshList()}
            >
              <RefreshCw className={refreshing ? 'spin' : undefined} size={17} />
            </button>
            <button
              className="icon-button icon-button--danger"
              type="button"
              aria-label="清空邮箱"
              data-tooltip="清空邮箱"
              disabled={!mailbox || !emails.length}
              onClick={() => void clearMailbox()}
            >
              <Eraser size={16} />
            </button>
          </div>
        </header>

        <div className="search-field">
          <Inbox size={15} />
          <input
            type="search"
            value={search}
            placeholder="搜索邮件主题、发件人或正文预览"
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <MessageList
          loading={listLoading && !emails.length}
          messages={visibleEmails}
          kind="inbox"
          selectedId={selection ? selection.detail.id : null}
          onSelect={(message) => void openEmail(message as EmailSummary)}
        />
      </section>

      <section className="reader-pane">
        <MessageReader
          selection={selection}
          loading={detailLoading}
          mailbox={mailbox}
          canCompose={false}
          onBack={() => setSelection(null)}
          onDelete={() => void deleteEmail()}
          onCompose={() => undefined}
          showToast={showToast}
        />
      </section>
    </div>
  )
}
