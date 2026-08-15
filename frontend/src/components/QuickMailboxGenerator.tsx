import { Check, Globe, LoaderCircle, Sparkles, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { api, ApiError } from '../lib/api'

export function QuickMailboxGenerator({
  domains,
  disabled,
  onCreated,
}: {
  domains: string[]
  disabled: boolean
  onCreated: (address: string) => void | Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [domainIndex, setDomainIndex] = useState(0)
  const [local, setLocal] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  useEffect(() => {
    if (domainIndex >= domains.length) setDomainIndex(0)
  }, [domains, domainIndex])

  const domain = domains[domainIndex] || ''
  const trimmedLocal = local.trim().toLowerCase()
  const previewReady = domain && (!trimmedLocal || /^[a-z0-9][a-z0-9._-]{1,28}[a-z0-9]$/.test(trimmedLocal))

  async function submit() {
    if (submitting || disabled) return
    if (trimmedLocal && !previewReady) {
      setError('自定义名称需以字母或数字开头，长度 3-30，可包含 . _ -')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const result = trimmedLocal
        ? await api.createMailbox(trimmedLocal, domainIndex)
        : await api.generateMailbox(undefined, domainIndex)
      setOpen(false)
      setLocal('')
      await onCreated(result.email)
    } catch (submitError) {
      setError(submitError instanceof ApiError ? submitError.message : '生成邮箱失败，请稍后重试')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="quick-mailbox" ref={rootRef}>
      <button
        className="button button--secondary"
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        data-tooltip="随机或自定义生成邮箱"
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
      >
        {submitting ? <LoaderCircle className="spin" size={16} /> : <Sparkles size={16} />}
        <span>生成邮箱</span>
      </button>

      {open && (
        <div className="quick-mailbox__panel" role="dialog" aria-label="生成新邮箱">
          <header>
            <div>
              <small>NEW MAILBOX</small>
              <strong>生成邮箱</strong>
            </div>
            <button
              className="icon-button icon-button--small"
              type="button"
              aria-label="关闭"
              onClick={() => setOpen(false)}
            >
              <X size={15} />
            </button>
          </header>

          <div className="quick-mailbox__content">
            <p>留空名称则随机生成，也可以指定自定义前缀。生成后立即开始收信。</p>

            <label className="quick-mailbox__local-part">
              <span>自定义名称（可选）</span>
              <input
                value={local}
                placeholder="留空则随机生成"
                maxLength={30}
                spellCheck={false}
                onChange={(event) => setLocal(event.target.value)}
              />
              <small>支持字母、数字与 . _ - 符号</small>
            </label>

            <div className="quick-mailbox__domains" role="radiogroup" aria-label="选择域名">
              {domains.map((item, index) => (
                <button
                  className={index === domainIndex ? 'is-selected' : ''}
                  type="button"
                  role="radio"
                  aria-checked={index === domainIndex}
                  key={item}
                  onClick={() => setDomainIndex(index)}
                >
                  <Globe size={15} />
                  <span>@{item}</span>
                  {index === domainIndex && <Check size={14} />}
                </button>
              ))}
              {!domains.length && <small>暂无可用域名</small>}
            </div>

            <div className="quick-mailbox__preview">
              <span>邮箱预览</span>
              <strong>
                {trimmedLocal ? (previewReady ? `${trimmedLocal}@${domain}` : '前缀格式待完善') : `随机名称@${domain || '…'}`}
              </strong>
            </div>

            {error && <p className="quick-mailbox__error">{error}</p>}

            <button
              className="button button--primary quick-mailbox__submit"
              type="button"
              disabled={submitting || !domain}
              onClick={() => void submit()}
            >
              {submitting ? <LoaderCircle className="spin" size={15} /> : <Sparkles size={15} />}
              {trimmedLocal ? '创建邮箱' : '随机生成'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
