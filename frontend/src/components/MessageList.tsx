import { Inbox, KeyRound, LoaderCircle, Send } from 'lucide-react'
import type { EmailSummary, SentSummary } from '../lib/api'
import { formatMessageDate, senderLabel } from '../lib/format'

interface NormalizedRow {
  id: number
  party: string
  time: string
  subject: string
  preview: string
  unread: boolean
  verificationCode?: string | null
}

function normalize(messages: Array<EmailSummary | SentSummary>, kind: 'inbox' | 'sent'): NormalizedRow[] {
  if (kind === 'sent') {
    return (messages as SentSummary[]).map((message) => ({
      id: message.id,
      party: message.recipients || '(无收件人)',
      time: formatMessageDate(message.created_at),
      subject: message.subject || '(无主题)',
      preview: `状态:${message.status || '已发送'}`,
      unread: false,
    }))
  }
  return (messages as EmailSummary[]).map((message) => ({
    id: message.id,
    party: senderLabel(message.sender),
    time: formatMessageDate(message.received_at),
    subject: message.subject || '(无主题)',
    preview: message.preview || '',
    unread: !message.is_read,
    verificationCode: message.verification_code,
  }))
}

export function MessageList({
  loading,
  messages,
  kind,
  selectedId,
  onSelect,
}: {
  loading: boolean
  messages: Array<EmailSummary | SentSummary>
  kind: 'inbox' | 'sent'
  selectedId: number | string | null
  onSelect: (message: EmailSummary | SentSummary) => void
}) {
  const rows = normalize(messages, kind)

  if (loading) {
    return (
      <div className="message-list-shell">
        <span className="list-state" role="status">
          <LoaderCircle className="spin" size={20} />
          <span>正在加载邮件…</span>
        </span>
      </div>
    )
  }

  if (!rows.length) {
    return (
      <div className="message-list-shell">
        <span className="list-state list-state--empty">
          <span className="empty-symbol">
            {kind === 'inbox' ? <Inbox size={21} /> : <Send size={21} />}
          </span>
          <strong>{kind === 'inbox' ? '暂无邮件' : '暂无发送记录'}</strong>
          <span>{kind === 'inbox' ? '新的邮件到达后会显示在这里' : '从这个邮箱发出的邮件会记录在这里'}</span>
        </span>
      </div>
    )
  }

  return (
    <div className="message-list-shell">
      <div className="message-list" role="list">
        {rows.map((row) => (
          <div
            className={`message-row${row.unread ? ' is-unread' : ''}${row.id === selectedId ? ' is-selected' : ''}`}
            key={row.id}
            role="listitem"
          >
            <button
              className="message-row__main"
              type="button"
              onClick={() => onSelect(messages.find((message) => message.id === row.id)!)}
            >
              <span className="message-row__top">
                <strong>{row.party}</strong>
                <time>{row.time}</time>
              </span>
              <span className="message-row__subject">
                {row.verificationCode ? <KeyRound size={13} aria-label="包含验证码" /> : null}
                <span className="message-row__subject-text">{row.subject}</span>
              </span>
              <span className="message-row__preview">{row.preview}</span>
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

