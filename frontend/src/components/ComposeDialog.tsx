import { Check, ChevronDown, LoaderCircle, Mail, Send, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { api, ApiError } from '../lib/api'
import { localPartOf } from '../lib/format'

function textToHtml(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  return `<div style="font-family:inherit;font-size:14px;line-height:1.8;white-space:pre-wrap;">${escaped}</div>`
}

export function ComposeDialog({
  from,
  mailboxes,
  onClose,
  onSent,
}: {
  from: string
  mailboxes: string[]
  onClose: () => void
  onSent: () => void
}) {
  const [fromAddress, setFromAddress] = useState(from)
  const [to, setTo] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [fromOpen, setFromOpen] = useState(false)
  const selectRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !fromOpen) onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [fromOpen, onClose])

  useEffect(() => {
    if (!fromOpen) return
    const onPointerDown = (event: PointerEvent) => {
      if (selectRef.current && !selectRef.current.contains(event.target as Node)) setFromOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [fromOpen])

  const recipients = to
    .split(/[,;\s]+/)
    .map((item) => item.trim())
    .filter(Boolean)

  async function submit() {
    if (sending) return
    if (!recipients.length) {
      setError('请填写至少一个收件人邮箱地址')
      return
    }
    if (recipients.some((item) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item))) {
      setError('收件人地址格式不正确')
      return
    }
    setSending(true)
    setError('')
    try {
      await api.send({
        from: fromAddress,
        to: recipients.join(','),
        subject: subject.trim() || '(无主题)',
        html: textToHtml(body),
      })
      onSent()
    } catch (submitError) {
      setError(submitError instanceof ApiError ? submitError.message : '发送失败，请稍后重试')
    } finally {
      setSending(false)
    }
  }

  return (
    <div
      className="compose-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        className="compose-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="写邮件"
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') void submit()
        }}
      >
        <header>
          <div>
            <Mail size={17} />
            <h2>写邮件</h2>
          </div>
          <button
            className="icon-button"
            type="button"
            aria-label="关闭"
            data-tooltip="关闭 (Esc)"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </header>

        <div className="compose-dialog__body">
          <div className="compose-fields">
            <div className="compose-field">
              <span>发件人</span>
              <div className="compose-mailbox-select" ref={selectRef}>
                <button
                  className="compose-mailbox-select__trigger"
                  type="button"
                  aria-haspopup="listbox"
                  aria-expanded={fromOpen}
                  onClick={() => setFromOpen((value) => !value)}
                >
                  <span className="compose-mailbox-select__icon"><Mail size={13} /></span>
                  <span>{fromAddress}</span>
                  <ChevronDown size={14} />
                </button>
                {fromOpen && (
                  <div className="compose-mailbox-select__menu" role="listbox" aria-label="选择发件邮箱">
                    {mailboxes.map((address) => (
                      <button
                        className={address === fromAddress ? 'is-selected' : ''}
                        type="button"
                        role="option"
                        aria-selected={address === fromAddress}
                        key={address}
                        onClick={() => {
                          setFromAddress(address)
                          setFromOpen(false)
                        }}
                      >
                        <span className="compose-mailbox-select__icon"><Mail size={13} /></span>
                        <span>
                          <strong>{localPartOf(address)}</strong>
                          <small>{address}</small>
                        </span>
                        {address === fromAddress && <Check size={14} />}
                      </button>
                    ))}
                    {!mailboxes.length && <small style={{ padding: '8px 10px' }}>暂无可用邮箱</small>}
                  </div>
                )}
              </div>
            </div>

            <div className="compose-field">
              <span>收件人</span>
              <input
                value={to}
                placeholder="多个地址用逗号分隔"
                spellCheck={false}
                onChange={(event) => setTo(event.target.value)}
              />
            </div>

            <div className="compose-field compose-field--subject">
              <span>主题</span>
              <input
                value={subject}
                placeholder="邮件主题"
                onChange={(event) => setSubject(event.target.value)}
              />
            </div>
          </div>

          <div className="compose-editor">
            <textarea
              value={body}
              placeholder="在此撰写正文…（Ctrl/⌘ + Enter 快速发送）"
              spellCheck={false}
              onChange={(event) => setBody(event.target.value)}
            />
          </div>
        </div>

        {error && <p className="inline-error"><X size={14} />{error}</p>}

        <footer>
          <button
            className="button button--primary"
            type="button"
            disabled={sending || !fromAddress}
            onClick={() => void submit()}
          >
            {sending ? <LoaderCircle className="spin" size={15} /> : <Send size={15} />}
            {sending ? '发送中…' : '发送邮件'}
          </button>
          <span className="compose-delivery-note">
            {recipients.length > 1 ? `${recipients.length} 位收件人` : '通过 Mailfree SMTP 发送'}
          </span>
          <button
            className="compose-discard"
            type="button"
            aria-label="放弃草稿"
            data-tooltip="放弃草稿"
            disabled={sending}
            onClick={onClose}
          >
            <X size={17} />
          </button>
        </footer>
      </section>
    </div>
  )
}
