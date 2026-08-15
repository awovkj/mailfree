import {
  ArrowUp,
  Bookmark,
  Copy,
  Forward,
  Globe,
  KeyRound,
  LoaderCircle,
  Mailbox,
  RefreshCw,
  Search,
  UserCheck,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { api, type MailboxItem, type Session } from '../lib/api'
import { copyText, formatMessageDate } from '../lib/format'
import { MailSidebar, roleLabel } from './MailWorkspace'
import type { Navigate } from './MailWorkspace'

type ShowToast = (message: string, kind?: 'success' | 'error' | 'info') => void

interface OverviewStats {
  total?: number
  canLogin?: number
  forwarding?: number
  favorites?: number
}

export function MailboxesOverview({
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
  const [stats, setStats] = useState<OverviewStats | null>(null)
  const [mailboxes, setMailboxes] = useState<MailboxItem[]>([])
  const [domains, setDomains] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [stuck, setStuck] = useState(false)
  const [showTop, setShowTop] = useState(false)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const shellRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async (keyword: string, silent = false) => {
    if (!silent) setRefreshing(true)
    try {
      const [main, loginData, forwardData, favoriteData, domainList] = await Promise.allSettled([
        api.mailboxes({ q: keyword || undefined, page: 1, size: 40 }),
        api.mailboxes({ login: 'true', page: 1, size: 1 }),
        api.mailboxes({ forward: 'true', page: 1, size: 1 }),
        api.mailboxes({ favorite: 'true', page: 1, size: 1 }),
        api.domains(),
      ])
      if (main.status === 'fulfilled') {
        setMailboxes(main.value.list || [])
        setStats((current) => ({ ...current, total: main.value.total }))
      }
      if (loginData.status === 'fulfilled') setStats((current) => ({ ...current, canLogin: loginData.value.total }))
      if (forwardData.status === 'fulfilled') setStats((current) => ({ ...current, forwarding: forwardData.value.total }))
      if (favoriteData.status === 'fulfilled') setStats((current) => ({ ...current, favorites: favoriteData.value.total }))
      if (domainList.status === 'fulfilled') setDomains(domainList.value || [])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void load('')
  }, [load])

  useEffect(() => {
    const keyword = search.trim()
    const timer = window.setTimeout(() => void load(keyword, true), 280)
    return () => window.clearTimeout(timer)
  }, [load, search])

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return
    const observer = new IntersectionObserver(([entry]) => setStuck(!entry.isIntersecting), {
      root: shellRef.current,
      threshold: 0,
    })
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const shell = shellRef.current
    if (!shell) return
    const onScroll = () => setShowTop(shell.scrollTop > 260)
    shell.addEventListener('scroll', onScroll, { passive: true })
    return () => shell.removeEventListener('scroll', onScroll)
  }, [])

  async function copyAddress(address: string) {
    if (await copyText(address)) showToast('邮箱地址已复制')
    else showToast('复制失败，请手动选择复制', 'error')
  }

  const cards = [
    { label: '邮箱总数', value: stats?.total, Icon: Mailbox },
    { label: '可登录邮箱', value: stats?.canLogin, Icon: KeyRound },
    { label: '转发中', value: stats?.forwarding, Icon: Forward },
    { label: '已收藏', value: stats?.favorites, Icon: Bookmark },
  ]

  const domainCount = new Map<string, number>()
  for (const mailbox of mailboxes) {
    const domain = mailbox.address.split('@')[1] || ''
    domainCount.set(domain, (domainCount.get(domain) || 0) + 1)
  }

  return (
    <div className="mail-layout mail-layout--admin">
      <MailSidebar
        session={session}
        folder="inbox"
        unreadCount={0}
        adminView="mailboxes"
        onFolderChange={() => onNavigate('app')}
        onNavigate={onNavigate}
        onLogout={onLogout}
      />

      <div className="admin-scroll-shell delayed-scrollbar" ref={shellRef}>
        <div className="admin-workspace page-content-enter">
          <div className={`admin-workspace__header user-management__header${stuck ? ' is-stuck' : ''}`}>
            <span className="admin-workspace__icon"><Mailbox size={22} /></span>
            <div className="admin-workspace__heading">
              <p className="eyebrow">MAILBOX DIRECTORY · {roleLabel(session)}</p>
              <h1>所有邮箱</h1>
            </div>
            <div className="user-header-actions">
              <label className="user-search">
                <Search size={14} />
                <input
                  value={search}
                  placeholder="搜索邮箱地址…"
                  spellCheck={false}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </label>
              <button
                className="icon-button"
                type="button"
                aria-label="刷新数据"
                data-tooltip="刷新数据"
                disabled={refreshing}
                onClick={() => void load(search.trim(), true)}
              >
                <RefreshCw className={refreshing ? 'spin' : undefined} size={17} />
              </button>
            </div>
            <span className="admin-page-header__sentinel" ref={sentinelRef} />
          </div>

          <section className="admin-count-grid" aria-label="邮箱统计">
            {cards.map(({ label, value, Icon }) => (
              <article key={label}>
                <span><Icon size={16} /></span>
                <strong>{value ?? (loading ? '—' : 0)}</strong>
                <small>{label}</small>
              </article>
            ))}
          </section>

          <section className="admin-detail-grid">
            <div className="admin-card">
              <header>
                <Globe size={17} />
                <div>
                  <h2>可用域名</h2>
                </div>
              </header>
              <div className="admin-domain-list">
                {domains.map((domain) => (
                  <div key={domain}>
                    <span><Globe size={13} /></span>
                    <strong>{domain}</strong>
                    <small>{domainCount.get(domain) || 0} 个邮箱</small>
                  </div>
                ))}
                {!domains.length && !loading && <p className="admin-empty">暂无可用域名</p>}
              </div>
            </div>

            <div className="admin-card">
              <header>
                <Mailbox size={17} />
                <div>
                  <h2>最新邮箱</h2>
                  <p>{search.trim() ? `匹配 “${search.trim()}” 的结果` : '最近创建的邮箱，点击复制地址'}</p>
                </div>
              </header>
              <div className="admin-mailbox-list">
                {mailboxes.slice(0, 8).map((mailbox) => (
                  <div key={mailbox.id}>
                    <span className={mailbox.can_login ? 'is-active' : ''} title={mailbox.can_login ? '允许登录' : '禁止登录'} />
                    <strong>{mailbox.address}</strong>
                    <small>{formatMessageDate(mailbox.created_at)}</small>
                  </div>
                ))}
                {!mailboxes.length && !loading && <p className="admin-empty">{search.trim() ? '没有匹配的邮箱' : '暂无邮箱'}</p>}
                {loading && (
                  <p className="admin-empty" role="status">
                    <LoaderCircle className="spin" size={15} style={{ verticalAlign: '-2px' }} /> 正在加载…
                  </p>
                )}
              </div>
              {mailboxes.length > 0 && (
                <button
                  className="quiet-link"
                  type="button"
                  style={{ margin: '13px 0 0' }}
                  onClick={() => void copyAddress(mailboxes[0].address)}
                >
                  <Copy size={13} />
                  复制最新邮箱地址
                </button>
              )}
            </div>
          </section>

          <section className="admin-detail-grid" style={{ marginTop: 14 }}>
            <div className="admin-card admin-card--settings" style={{ gridColumn: '1 / -1' }}>
              <header>
                <UserCheck size={17} />
                <div>
                  <h2>完整邮箱列表</h2>
                  <p>共 {stats?.total ?? '—'} 个邮箱{search.trim() ? '（当前为搜索结果）' : ''}，点击行复制地址</p>
                </div>
              </header>
              <div className="admin-mailbox-list">
                {mailboxes.map((mailbox) => (
                  <div
                    key={mailbox.id}
                    role="button"
                    tabIndex={0}
                    style={{ cursor: 'pointer' }}
                    onClick={() => void copyAddress(mailbox.address)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') void copyAddress(mailbox.address)
                    }}
                  >
                    <span className={mailbox.can_login ? 'is-active' : ''} />
                    <strong>{mailbox.address}</strong>
                    <small>
                      {mailbox.is_pinned ? '已置顶 · ' : ''}
                      {mailbox.forward_to ? '转发中 · ' : ''}
                      {formatMessageDate(mailbox.created_at)}
                    </small>
                  </div>
                ))}
                {!mailboxes.length && !loading && (
                  <p className="admin-empty">{search.trim() ? '没有匹配的邮箱，试试其他关键词' : '还没有邮箱，去生成一个吧'}</p>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>

      <button
        className={`admin-scroll-top${showTop ? ' is-visible' : ''}`}
        type="button"
        aria-label="回到顶部"
        onClick={() => shellRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
      >
        <ArrowUp size={19} />
      </button>
    </div>
  )
}
