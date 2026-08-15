import {
  ArrowLeft,
  Copy,
  Download,
  FileText,
  Inbox,
  KeyRound,
  PenLine,
  Send,
  Trash2,
} from 'lucide-react'
import { useMemo } from 'react'
import type { EmailDetail, EmailSummary, SentDetail, SentSummary } from '../lib/api'
import { copyText, extractAddress, extractVerificationCode, formatFullDate } from '../lib/format'

export type ReaderSelection =
  | { kind: 'email'; summary: EmailSummary; detail: EmailDetail }
  | { kind: 'sent'; summary: SentSummary; detail: SentDetail }
  | null

type ShowToast = (message: string, kind?: 'success' | 'error' | 'info') => void

function frameDocument(body: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><base target="_blank"><style>html,body{margin:0;padding:0;background:#fff;color:#262626;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans SC",sans-serif;font-size:14px;line-height:1.7;word-break:break-word}img{max-width:100%!important;height:auto!important}a{color:#1d4ed8}table{max-width:100%!important}</style></head><body>${body}</body></html>`
}

export function MessageReader({
  selection,
  loading,
  mailbox,
  canCompose,
  onBack,
  onDelete,
  onCompose,
  showToast,
}: {
  selection: ReaderSelection
  loading: boolean
  mailbox: string
  canCompose: boolean
  onBack: () => void
  onDelete: () => void
  onCompose: () => void
  showToast: ShowToast
}) {
  const verificationCode = useMemo(() => {
    if (selection?.kind !== 'email') return ''
    return (
      selection.detail.verification_code ||
      extractVerificationCode(selection.detail.subject, selection.detail.content)
    )
  }, [selection])

  if (loading && !selection) {
    return (
      <div className="reader-state reader-state--loading" role="status">
        <span className="reader-loading-visual">
          <span className="reader-loading-mail"><Inbox size={22} /></span>
        </span>
        <span className="reader-loading-copy">
          <strong>正在打开邮件</strong>
          <small>内容加载中…</small>
        </span>
      </div>
    )
  }

  if (!selection) {
    return (
      <div className="reader-state reader-state--empty">
        <span className="reader-empty-symbol"><Inbox size={26} /></span>
        <h2>选择一封邮件</h2>
        <p>从左侧列表选择邮件即可在此阅读，支持验证码一键复制与原始 HTML 渲染。</p>
      </div>
    )
  }

  const { detail, kind } = selection
  const isInbox = kind === 'email'
  const emailDetail = isInbox ? (detail as EmailDetail) : null
  const sentDetail = isInbox ? null : (detail as SentDetail)

  const party = isInbox
    ? extractAddress((detail as EmailDetail).sender || (selection.summary as EmailSummary).sender)
    : { name: '发件人', address: sentDetail?.from_addr || mailbox }
  const partyLabel = isInbox ? party.name || party.address : '我'
  const partyAddress = isInbox ? party.address : sentDetail?.from_addr || mailbox
  const timeText = formatFullDate(
    isInbox ? (detail as EmailDetail).received_at : (detail as SentDetail).created_at,
  )
  const toText = isInbox
    ? (detail as EmailDetail).to_addrs || ''
    : (detail as SentDetail).recipients || ''
  const htmlBody = isInbox ? emailDetail?.html_content || '' : sentDetail?.html_content || ''
  const textBody = isInbox ? emailDetail?.content || '' : sentDetail?.text_content || ''
  const downloadUrl = isInbox ? emailDetail?.download || '' : ''

  async function copyAddress() {
    if (await copyText(partyAddress)) showToast('地址已复制')
    else showToast('复制失败，请手动选择复制', 'error')
  }

  async function copyCode() {
    if (!verificationCode) return
    if (await copyText(verificationCode)) showToast(`验证码 ${verificationCode} 已复制`)
    else showToast('复制失败，请手动选择复制', 'error')
  }

  return (
    <article className="message-reader">
      <header className="reader-toolbar">
        <button
          className="icon-button icon-button--small mobile-back"
          type="button"
          aria-label="返回列表"
          onClick={onBack}
        >
          <ArrowLeft size={17} />
        </button>
        <h2 className="reader-toolbar__title">{detail.subject || '(无主题)'}</h2>
        <span className="reader-toolbar__spacer" />
        {verificationCode && (
          <button className="toolbar-button" type="button" onClick={() => void copyCode()}>
            <KeyRound size={14} />
            {verificationCode}
          </button>
        )}
        {isInbox && (
          <button className="toolbar-button" type="button" onClick={() => void copyAddress()}>
            <Copy size={14} />
            复制发件人
          </button>
        )}
        <button className="toolbar-button" type="button" onClick={onDelete}>
          <Trash2 size={14} />
          删除
        </button>
        {canCompose && (
          <button className="toolbar-button" type="button" onClick={onCompose}>
            <PenLine size={14} />
            写邮件
          </button>
        )}
      </header>

      <div className="reader-content">
        {sentDetail && sentDetail.status === 'scheduled' && sentDetail.scheduled_at && (
          <p className="message-notice">
            <Send size={14} />
            此邮件计划于 {formatFullDate(sentDetail.scheduled_at)} 定时发送。
          </p>
        )}

        <header className="message-heading">
          <h1>{detail.subject || '(无主题)'}</h1>
          <div className="sender-block">
            <span className="sender-avatar">{(partyLabel || '?').slice(0, 1).toUpperCase()}</span>
            <div>
              <strong>{partyLabel}</strong>
              <span>{partyAddress}</span>
              {toText && <small>收件人:{toText}</small>}
            </div>
            <time>{timeText}</time>
          </div>
        </header>

        {htmlBody ? (
          <iframe
            className="email-frame"
            title="邮件内容"
            sandbox="allow-popups allow-popups-to-escape-sandbox"
            srcDoc={frameDocument(htmlBody)}
          />
        ) : (
          <pre className="plain-body">{textBody || '(此邮件没有正文内容)'}</pre>
        )}

        {downloadUrl && (
          <a
            className="attachment-card"
            href={downloadUrl}
            download
            style={{ maxWidth: 320, margin: '34px auto 0', display: 'grid' }}
          >
            <span><FileText size={17} /></span>
            <div>
              <strong>原始邮件 .eml</strong>
              <small>下载完整邮件文件</small>
            </div>
            <Download size={15} />
          </a>
        )}

        <footer className="message-footer-actions">
          {verificationCode ? (
            <button className="quiet-link" type="button" onClick={() => void copyCode()}>
              <KeyRound size={13} />
              复制验证码 {verificationCode}
            </button>
          ) : (
            <span className="quiet-link">
              <Send size={13} />
              {isInbox ? '由 Mailfree 代收' : '发件记录'}
            </span>
          )}
          {canCompose && (
            <button className="button button--secondary" type="button" onClick={onCompose}>
              <PenLine size={15} />
              撰写新邮件
            </button>
          )}
        </footer>
      </div>
    </article>
  )
}
