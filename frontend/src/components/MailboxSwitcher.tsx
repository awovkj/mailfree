import {
  ArrowLeft,
  AtSign,
  Check,
  ChevronDown,
  Copy,
  Globe2,
  LoaderCircle,
  Pin,
  PinOff,
  Plus,
  Trash2,
  X,
} from 'lucide-react'
import {
  useEffect,
  useRef,
  useState,
} from 'react'
import { api, type MailboxItem, type Quota } from '../lib/api'
import { copyText, domainOf, formatMessageDate } from '../lib/format'

const SWITCHER_EXIT_MS = 190

type ShowToast = (message: string, kind?: 'success' | 'error' | 'info') => void

function MailboxDomainSelect({
  value,
  domains,
  disabled,
  onChange,
}: {
  value: string
  domains: string[]
  disabled: boolean
  onChange: (value: string) => void
}) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const selectedIndex = Math.max(0, domains.indexOf(value))

  useEffect(() => {
    if (!open) return
    function closeOutside(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', closeOutside)
    return () => document.removeEventListener('pointerdown', closeOutside)
  }, [open])

  return (
    <div className={`mailbox-domain-select ${open ? 'is-open' : ''}`} ref={root}>
      <button
        className="mailbox-domain-select__trigger"
        type="button"
        aria-label="邮箱域名"
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled || !domains.length}
        onClick={() => setOpen((current) => !current)}
      >
        <span>{domains[selectedIndex] || '暂无域名'}</span>
        <ChevronDown size={15} />
      </button>
      {open && (
        <div className="mailbox-domain-select__menu" role="listbox" aria-label="邮箱域名">
          {domains.map((domain, index) => (
            <button
              className={domain === value ? 'is-selected' : ''}
              type="button"
              role="option"
              aria-selected={domain === value}
              key={domain}
              onClick={() => {
                onChange(domain)
                setOpen(false)
              }}
            >
              <AtSign size={14} />
              <span>{domain}</span>
              {domain === value && <Check size={15} />}
              {index < 0 ? null : null}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function MailboxSwitcher({
  mailboxes,
  loaded,
  domains,
  current,
  quota,
  canManage,
  onSelect,
  onPinToggled,
}: {
  mailboxes: MailboxItem[]
  loaded: boolean
  domains: string[]
  current: string
  quota: Quota | null
  canManage: boolean
  onSelect: (address: string) => void
  onPinToggled: () => void
  showToast: ShowToast
}) {
  const [open, setOpen] = useState(false)
  const [panelVisible, setPanelVisible] = useState(false)
  const [managing, setManaging] = useState(false)
  const [localPart, setLocalPart] = useState('')
  const [domainName, setDomainName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const closeTimerRef = useRef<number | null>(null)
  const openingRef = useRef(false)

  const groups = (() => {
    const grouped = new Map<string, MailboxItem[]>()
    for (const mailbox of mailboxes) {
      const domain = domainOf(mailbox.address)
      const entries = grouped.get(domain) || []
      entries.push(mailbox)
      grouped.set(domain, entries)
    }
    return [...grouped.entries()].sort(([left], [right]) => left.localeCompare(right))
  })()

  useEffect(() => {
    if (domains.some((domain) => domain === domainName)) return
    setDomainName(domains[0] || '')
  }, [domainName, domains])

  useEffect(() => {
    if (!panelVisible) return
    panelRef.current?.focus()
    function keydown(event: KeyboardEvent) {
      if (event.key === 'Escape') close()
    }
    document.addEventListener('keydown', keydown)
    return () => document.removeEventListener('keydown', keydown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelVisible])

  useEffect(() => {
    if (!open || !openingRef.current) return
    const frame = window.requestAnimationFrame(() => {
      if (!openingRef.current) return
      openingRef.current = false
      setPanelVisible(true)
    })
    return () => window.cancelAnimationFrame(frame)
  }, [open])

  useEffect(() => () => {
    if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current)
  }, [])

  function show() {
    if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current)
    closeTimerRef.current = null
    if (open) setPanelVisible(true)
    else {
      openingRef.current = true
      setOpen(true)
    }
  }

  function close() {
    if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current)
    openingRef.current = false
    setPanelVisible(false)
    triggerRef.current?.focus()
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    closeTimerRef.current = window.setTimeout(() => {
      setOpen(false)
      setManaging(false)
      setError('')
      setNotice('')
      closeTimerRef.current = null
    }, reducedMotion ? 0 : SWITCHER_EXIT_MS)
  }

  function select(address: string) {
    onSelect(address)
    close()
  }

  async function copyMailbox(address: string) {
    setError('')
    setNotice('')
    if (await copyText(address)) setNotice(`已复制：${address}`)
    else setError('无法访问剪贴板，请手动复制邮箱地址。')
  }

  async function add(event: React.FormEvent) {
    event.preventDefault()
    const nextLocal = localPart.trim().toLowerCase()
    if (!nextLocal || !domainName || busy) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const domainIndex = Math.max(0, domains.indexOf(domainName))
      const result = await api.createMailbox(nextLocal, domainIndex)
      setLocalPart('')
      setNotice(`邮箱已创建：${result.email}`)
      onPinToggled()
      select(result.email)
    } catch (addError) {
      setError(addError instanceof Error ? addError.message : '创建失败，请重试。')
    } finally {
      setBusy(false)
    }
  }

  async function togglePin(mailbox: MailboxItem) {
    setError('')
    setNotice('')
    try {
      const result = await api.pinMailbox(mailbox.address)
      setNotice(result.isPinned ? `已置顶：${mailbox.address}` : `已取消置顶：${mailbox.address}`)
      onPinToggled()
    } catch (pinError) {
      setError(pinError instanceof Error ? pinError.message : '操作失败，请重试。')
    }
  }

  async function removeMailbox(mailbox: MailboxItem) {
    if (!window.confirm(`确定删除邮箱 ${mailbox.address} 吗？其中邮件将一并删除。`)) return
    setError('')
    setNotice('')
    try {
      await api.deleteMailbox(mailbox.address)
      setNotice(`已删除：${mailbox.address}`)
      onPinToggled()
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : '删除失败，请重试。')
    }
  }

  const quotaLabel = !quota
    ? ''
    : quota.limit === -1
      ? `已创建 ${quota.used} 个邮箱 · 管理员不限量`
      : `已用 ${quota.used} / 上限 ${quota.limit} 个邮箱`

  return (
    <div className="mailbox-switcher">
      <button
        ref={triggerRef}
        className="mailbox-scope-trigger"
        type="button"
        aria-haspopup="dialog"
        aria-expanded={panelVisible}
        onClick={() => (panelVisible ? close() : show())}
      >
        <span>当前邮箱</span>
        <strong>{current || (loaded ? '还没有邮箱' : '正在加载…')}</strong>
        <ChevronDown size={14} aria-hidden="true" />
      </button>

      {open && (
        <>
          <button
            className={`switcher-backdrop${panelVisible ? ' is-open' : ''}`}
            type="button"
            tabIndex={-1}
            aria-hidden="true"
            onClick={close}
          />
          <div
            ref={panelRef}
            className={`mailbox-switcher__panel${panelVisible ? ' is-open' : ''}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="mailbox-switcher-title"
            data-state={panelVisible ? 'open' : 'closing'}
            tabIndex={-1}
          >
            <header className="switcher-header">
              {managing && (
                <button
                  className="icon-button icon-button--small"
                  type="button"
                  onClick={() => {
                    setManaging(false)
                    setError('')
                    setNotice('')
                  }}
                  aria-label="返回邮箱选择"
                >
                  <ArrowLeft size={17} />
                </button>
              )}
              <div>
                <small>{managing ? 'SETTINGS' : 'MAILBOX'}</small>
                <h2 id="mailbox-switcher-title">{managing ? '管理邮箱' : '选择邮箱'}</h2>
              </div>
              <button
                className="icon-button icon-button--small"
                type="button"
                onClick={close}
                aria-label="关闭邮箱选择"
              >
                <X size={17} />
              </button>
            </header>

            {managing ? (
              <div className="mailbox-manager">
                <form className="mailbox-add-form" onSubmit={add}>
                  <label htmlFor="switcher-new-local">新增邮箱地址</label>
                  <div>
                    <AtSign size={16} />
                    <input
                      id="switcher-new-local"
                      type="text"
                      value={localPart}
                      onChange={(event) => setLocalPart(event.target.value)}
                      placeholder="hello"
                      autoComplete="off"
                      maxLength={64}
                      required
                    />
                    <span className="mailbox-domain-separator">@</span>
                    <MailboxDomainSelect
                      value={domainName}
                      domains={domains}
                      disabled={busy}
                      onChange={setDomainName}
                    />
                    <button
                      className="button button--primary button--small"
                      type="submit"
                      disabled={busy || !localPart.trim() || !domainName}
                    >
                      {busy ? <LoaderCircle className="spin" size={15} /> : <Plus size={15} />}
                      添加
                    </button>
                  </div>
                </form>
                <p className="mailbox-manager-note">
                  置顶的邮箱会排在列表最前。删除邮箱会同时删除其中的全部邮件。
                </p>

                <div className="managed-mailboxes">
                  {mailboxes.map((mailbox) => (
                    <div className="managed-mailbox" key={mailbox.address}>
                      <span className={mailbox.is_pinned ? 'is-active' : ''} title={mailbox.is_pinned ? '已置顶' : '普通'} />
                      <div className="managed-mailbox__details">
                        <strong>{mailbox.address}</strong>
                        <small>创建于 {formatMessageDate(mailbox.created_at)}</small>
                      </div>
                      <button
                        className="icon-button icon-button--small"
                        type="button"
                        aria-label={mailbox.is_pinned ? '取消置顶' : '置顶'}
                        data-tooltip={mailbox.is_pinned ? '取消置顶' : '置顶'}
                        disabled={busy}
                        onClick={() => void togglePin(mailbox)}
                      >
                        {mailbox.is_pinned ? <PinOff size={15} /> : <Pin size={15} />}
                      </button>
                      <button
                        className="icon-button icon-button--small"
                        type="button"
                        aria-label="复制地址"
                        data-tooltip="复制地址"
                        disabled={busy}
                        onClick={() => void copyMailbox(mailbox.address)}
                      >
                        <Copy size={15} />
                      </button>
                      <button
                        className="icon-button icon-button--small icon-button--danger"
                        type="button"
                        aria-label="删除邮箱"
                        data-tooltip="删除邮箱"
                        disabled={busy}
                        onClick={() => void removeMailbox(mailbox)}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                  {!mailboxes.length && (
                    <p className="mailbox-manager-note">还没有邮箱，先在上方创建一个。</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="mailbox-scope-list">
                {groups.map(([domain, addresses]) => (
                  <section className="mailbox-domain-group" key={domain}>
                    <button type="button" onClick={() => select(addresses[0].address)}>
                      <span className="scope-icon"><Globe2 size={17} /></span>
                      <span>
                        <strong>{domain}</strong>
                        <small>{addresses.length} 个邮箱</small>
                      </span>
                    </button>
                    <div className="mailbox-address-list">
                      {addresses.map((mailbox) => (
                        <div className="mailbox-address-item" key={mailbox.address}>
                          <button
                            className={`mailbox-address-option${mailbox.address === current ? ' is-selected' : ''}`}
                            type="button"
                            onClick={() => select(mailbox.address)}
                          >
                            <AtSign size={13} />
                            <span>{mailbox.address}</span>
                            <small>{mailbox.is_pinned ? '置顶' : formatMessageDate(mailbox.created_at)}</small>
                          </button>
                          <button
                            className="icon-button mailbox-address-copy"
                            type="button"
                            aria-label={`复制 ${mailbox.address}`}
                            data-tooltip="复制地址"
                            onClick={() => void copyMailbox(mailbox.address)}
                          >
                            <Copy size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </section>
                ))}
                {!groups.length && (
                  <p className="mailbox-manager-note">
                    {loaded ? '还没有邮箱，点击右上角按钮快速生成一个。' : '正在加载邮箱列表…'}
                  </p>
                )}
              </div>
            )}

            {(error || notice) && (
              <p
                className={`switcher-feedback${error ? ' is-error' : ''}`}
                role={error ? 'alert' : 'status'}
                onAnimationEnd={(event) => {
                  if (event.animationName === 'switcher-feedback-out') setNotice('')
                }}
              >
                {error || notice}
              </p>
            )}

            <footer className="switcher-footer">
              {canManage && !managing ? (
                <button
                  type="button"
                  onClick={() => {
                    setManaging(true)
                    setError('')
                    setNotice('')
                  }}
                >
                  <Pin size={16} />
                  管理邮箱（置顶 / 删除）
                </button>
              ) : quotaLabel ? (
                <span style={{ padding: '0 11px', fontSize: 12, color: 'var(--text-tertiary)' }}>
                  {quotaLabel}
                </span>
              ) : null}
            </footer>
          </div>
        </>
      )}
    </div>
  )
}
