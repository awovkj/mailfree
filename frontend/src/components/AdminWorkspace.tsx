import {
  ArrowUp,
  ChevronRight,
  LoaderCircle,
  Mail,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserCog,
  UserPlus,
  Users,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api, ApiError, type Role, type Session, type UserRow } from '../lib/api'
import { formatMessageDate } from '../lib/format'
import { MailSidebar, roleLabel } from './MailWorkspace'
import type { Navigate } from './MailWorkspace'

type ShowToast = (message: string, kind?: 'success' | 'error' | 'info') => void

const ROLE_OPTIONS: Array<{ value: Role | 'admin'; label: string }> = [
  { value: 'user', label: '普通用户' },
  { value: 'admin', label: '高级用户' },
  { value: 'guest', label: '演示访客' },
]

interface UserDraft {
  id: number | null
  username: string
  password: string
  role: Role
  mailboxLimit: number
  canSend: boolean
  mailboxes: Array<{ address: string; created_at: string }>
  assignAddress: string
}

function emptyDraft(): UserDraft {
  return {
    id: null,
    username: '',
    password: '',
    role: 'user',
    mailboxLimit: 5,
    canSend: false,
    mailboxes: [],
    assignAddress: '',
  }
}

function rolePillClass(role: Role): string {
  if (role === 'admin') return 'role-pill role-pill--super_admin'
  if (role === 'guest') return 'role-pill role-pill--temporary'
  return 'role-pill'
}

function UserDialog({
  draft,
  saving,
  error,
  onChange,
  onClose,
  onSave,
  onDelete,
  onAssign,
  onUnassign,
}: {
  draft: UserDraft
  saving: boolean
  error: string
  onChange: (patch: Partial<UserDraft>) => void
  onClose: () => void
  onSave: () => void
  onDelete: () => void
  onAssign: (address: string) => void
  onUnassign: (address: string) => void
}) {
  const isEdit = draft.id !== null

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div
      className="admin-dialog-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section className="admin-dialog" role="dialog" aria-modal="true" aria-label={isEdit ? '编辑用户' : '创建用户'}>
        <header>
          <div>
            <UserCog size={17} />
            <h2>{isEdit ? `编辑用户 · ${draft.username}` : '创建用户'}</h2>
          </div>
          <button className="icon-button" type="button" aria-label="关闭" onClick={onClose}>
            <X size={16} />
          </button>
        </header>

        <div className="admin-dialog__body">
          <div className="admin-form">
            <label>
              <span>用户名</span>
              <input
                value={draft.username}
                placeholder="登录用户名"
                spellCheck={false}
                autoComplete="off"
                disabled={isEdit || saving}
                onChange={(event) => onChange({ username: event.target.value })}
              />
            </label>

            <label>
              <span>{isEdit ? '重置密码（留空则不修改）' : '初始密码'}</span>
              <input
                type="password"
                value={draft.password}
                placeholder={isEdit ? '留空保持现有密码' : '设置登录密码'}
                autoComplete="new-password"
                disabled={saving}
                onChange={(event) => onChange({ password: event.target.value })}
              />
            </label>

            <div className="admin-form__row">
              <label>
                <span>角色</span>
                <select
                  value={draft.role}
                  disabled={saving}
                  onChange={(event) => onChange({ role: event.target.value as Role })}
                >
                  {ROLE_OPTIONS.map((option) => (
                    <option value={option.value} key={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>邮箱上限</span>
                <input
                  type="number"
                  min={0}
                  max={9999}
                  value={draft.mailboxLimit}
                  disabled={saving}
                  onChange={(event) => onChange({ mailboxLimit: Number(event.target.value) || 0 })}
                />
              </label>
            </div>

            <label className="admin-form__check">
              <input
                type="checkbox"
                checked={draft.canSend}
                disabled={saving}
                onChange={(event) => onChange({ canSend: event.target.checked })}
              />
              <span>允许对外发送邮件</span>
            </label>
          </div>

          {isEdit && (
            <div className="admin-dialog__mailboxes">
              <h3>
                <Mail size={14} />
                关联邮箱（{draft.mailboxes.length}）
              </h3>
              <div>
                {draft.mailboxes.map((mailbox) => (
                  <span key={mailbox.address}>
                    <strong>{mailbox.address}</strong>
                    <small>{formatMessageDate(mailbox.created_at)}</small>
                    <button
                      className="icon-button icon-button--small icon-button--danger"
                      type="button"
                      aria-label={`取消关联 ${mailbox.address}`}
                      data-tooltip="取消关联"
                      disabled={saving}
                      onClick={() => onUnassign(mailbox.address)}
                    >
                      <Trash2 size={13} />
                    </button>
                  </span>
                ))}
                {!draft.mailboxes.length && <small className="admin-empty">该用户尚未关联邮箱</small>}
              </div>
              <div className="admin-form__row">
                <input
                  value={draft.assignAddress}
                  placeholder="输入邮箱地址，如 alice@example.com"
                  spellCheck={false}
                  disabled={saving}
                  onChange={(event) => onChange({ assignAddress: event.target.value })}
                />
                <button
                  className="button button--secondary"
                  type="button"
                  disabled={saving || !draft.assignAddress.trim()}
                  onClick={() => onAssign(draft.assignAddress.trim())}
                >
                  关联邮箱
                </button>
              </div>
            </div>
          )}

          {error && <p className="inline-error"><X size={14} />{error}</p>}
        </div>

        <footer>
          {isEdit ? (
            <button className="button button--secondary admin-dialog__danger" type="button" disabled={saving} onClick={onDelete}>
              <Trash2 size={15} />
              删除用户
            </button>
          ) : (
            <span />
          )}
          <div className="admin-dialog__actions">
            <button className="button button--secondary" type="button" disabled={saving} onClick={onClose}>
              取消
            </button>
            <button className="button button--primary" type="button" disabled={saving} onClick={onSave}>
              {saving ? <LoaderCircle className="spin" size={15} /> : <UserCheck size={15} />}
              {isEdit ? '保存修改' : '创建用户'}
            </button>
          </div>
        </footer>
      </section>
    </div>
  )
}

export function AdminWorkspace({
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
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [stuck, setStuck] = useState(false)
  const [showTop, setShowTop] = useState(false)
  const [draft, setDraft] = useState<UserDraft | null>(null)
  const [saving, setSaving] = useState(false)
  const [dialogError, setDialogError] = useState('')
  const sentinelRef = useRef<HTMLDivElement>(null)
  const shellRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true)
    try {
      const list = await api.users(200, 0)
      setUsers(list || [])
    } catch (error) {
      showToast(error instanceof Error ? error.message : '加载用户失败', 'error')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [showToast])

  useEffect(() => {
    void load()
  }, [load])

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

  const keyword = search.trim().toLowerCase()
  const visibleUsers = useMemo(
    () => (keyword ? users.filter((user) => user.username.toLowerCase().includes(keyword)) : users),
    [keyword, users],
  )

  const adminCount = users.filter((user) => user.role === 'admin').length
  const sendableCount = users.filter((user) => Number(user.can_send) === 1).length

  async function openEdit(user: UserRow) {
    setDialogError('')
    let mailboxes: Array<{ address: string; created_at: string }> = []
    try {
      mailboxes = await api.userMailboxes(user.id)
    } catch {
      // 部分部署不支持该接口，忽略
    }
    setDraft({
      id: user.id,
      username: user.username,
      password: '',
      role: user.role === 'mailbox' ? 'user' : user.role,
      mailboxLimit: user.mailbox_limit ?? 5,
      canSend: Number(user.can_send) === 1,
      mailboxes: mailboxes || [],
      assignAddress: '',
    })
  }

  function openCreate() {
    setDialogError('')
    setDraft(emptyDraft())
  }

  async function saveDraft() {
    if (!draft || saving) return
    if (!draft.username.trim()) {
      setDialogError('请填写用户名')
      return
    }
    if (draft.id === null && !draft.password) {
      setDialogError('创建用户需要设置初始密码')
      return
    }
    setSaving(true)
    setDialogError('')
    try {
      if (draft.id === null) {
        await api.createUser({
          username: draft.username.trim(),
          password: draft.password,
          role: draft.role,
          mailboxLimit: draft.mailboxLimit,
        })
        showToast(`用户 ${draft.username.trim()} 已创建`)
      } else {
        const payload: Record<string, unknown> = {
          role: draft.role,
          mailboxLimit: draft.mailboxLimit,
          can_send: draft.canSend,
        }
        if (draft.password) payload.password = draft.password
        await api.updateUser(draft.id, payload)
        showToast('用户信息已更新')
      }
      setDraft(null)
      await load(true)
    } catch (error) {
      setDialogError(error instanceof ApiError ? error.message : '保存失败，请稍后重试')
    } finally {
      setSaving(false)
    }
  }

  async function deleteDraft() {
    if (!draft || draft.id === null || saving) return
    if (!window.confirm(`确定删除用户 “${draft.username}”？此操作不可恢复。`)) return
    setSaving(true)
    setDialogError('')
    try {
      await api.deleteUser(draft.id)
      showToast(`用户 ${draft.username} 已删除`)
      setDraft(null)
      await load(true)
    } catch (error) {
      setDialogError(error instanceof ApiError ? error.message : '删除失败，请稍后重试')
    } finally {
      setSaving(false)
    }
  }

  async function assign(address: string) {
    if (!draft) return
    try {
      await api.assignMailbox(draft.username, address)
      const mailboxes = await api.userMailboxes(draft.id!)
      setDraft({ ...draft, mailboxes: mailboxes || [], assignAddress: '' })
      showToast(`已关联邮箱 ${address}`)
    } catch (error) {
      showToast(error instanceof ApiError ? error.message : '关联失败', 'error')
    }
  }

  async function unassign(address: string) {
    if (!draft) return
    if (!window.confirm(`取消关联 ${address}？`)) return
    try {
      await api.unassignMailbox(draft.username, address)
      const mailboxes = await api.userMailboxes(draft.id!)
      setDraft({ ...draft, mailboxes: mailboxes || [] })
      showToast(`已取消关联 ${address}`)
    } catch (error) {
      showToast(error instanceof ApiError ? error.message : '取消关联失败', 'error')
    }
  }

  return (
    <div className="mail-layout mail-layout--admin">
      <MailSidebar
        session={session}
        folder="inbox"
        unreadCount={0}
        adminView="admin"
        onFolderChange={() => onNavigate('app')}
        onNavigate={onNavigate}
        onLogout={onLogout}
      />

      <div className="admin-scroll-shell delayed-scrollbar" ref={shellRef}>
        <div className="admin-workspace page-content-enter">
          <div className={`admin-workspace__header user-management__header${stuck ? ' is-stuck' : ''}`}>
            <span className="admin-workspace__icon"><UserCog size={22} /></span>
            <div className="admin-workspace__heading">
              <p className="eyebrow">USER MANAGEMENT · {roleLabel(session)}</p>
              <h1>用户管理</h1>
              <p>管理账号角色、发信权限、邮箱配额与关联关系。</p>
            </div>
            <div className="user-header-actions">
              <button className="button button--secondary" type="button" aria-label="刷新用户列表" data-tooltip="刷新用户列表" disabled={refreshing} onClick={() => void load()}>
                <RefreshCw className={refreshing ? 'spin' : undefined} size={16} />
                <span>刷新</span>
              </button>
              <button className="button button--primary user-add-button" type="button" onClick={openCreate}>
                <UserPlus size={16} />
                <span>创建用户</span>
              </button>
            </div>
            <span className="admin-page-header__sentinel" ref={sentinelRef} />
          </div>

          <section className="user-summary" aria-label="用户统计">
            <div>
              <Users size={19} />
              <span>
                <strong>{loading ? '—' : users.length}</strong>
                <small>用户总数</small>
              </span>
            </div>
            <div>
              <ShieldCheck size={19} />
              <span>
                <strong>{loading ? '—' : adminCount}</strong>
                <small>管理员</small>
              </span>
            </div>
            <div>
              <Send size={19} />
              <span>
                <strong>{loading ? '—' : sendableCount}</strong>
                <small>可发信用户</small>
              </span>
            </div>
          </section>

          <section className="user-directory">
            <header>
              <div>
                <h2>用户目录</h2>
                <p>{keyword ? `匹配 “${keyword}” 的 ${visibleUsers.length} 个用户` : `共 ${users.length} 个用户`}</p>
              </div>
              <label className="user-search">
                <Search size={14} />
                <input
                  value={search}
                  placeholder="搜索用户名…"
                  spellCheck={false}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </label>
            </header>

            <div className="user-list-heading" aria-hidden="true">
              <span>用户</span>
              <span>角色</span>
              <span>能力</span>
              <span>邮箱</span>
              <span>状态</span>
              <span />
            </div>

            {loading ? (
              <div className="user-list-state" role="status">
                <LoaderCircle className="spin" size={19} />
                正在加载用户…
              </div>
            ) : visibleUsers.length ? (
              visibleUsers.map((user) => (
                <button className="managed-user-row" type="button" key={user.id} onClick={() => void openEdit(user)}>
                  <span className="managed-user-identity">
                    <span className="managed-user-avatar">{user.username.slice(0, 1).toUpperCase()}</span>
                    <span>
                      <strong>{user.username}</strong>
                      <small>创建于 {formatMessageDate(user.created_at)}</small>
                    </span>
                  </span>

                  <span className={rolePillClass(user.role)}>
                    {user.role === 'admin' ? (user.username === 'admin' ? '管理员' : '高级用户') : user.role === 'guest' ? '访客' : user.role === 'mailbox' ? '邮箱' : '用户'}
                  </span>

                  <span className="user-capabilities" title={Number(user.can_send) === 1 ? '允许发信' : '禁止发信'}>
                    <Send size={13} style={{ opacity: Number(user.can_send) === 1 ? 1 : 0.3 }} />
                    <small>{Number(user.can_send) === 1 ? '可发信' : '只收信'}</small>
                  </span>

                  <span className="user-mailbox-usage">
                    <strong>{user.mailbox_count ?? 0} / {user.mailbox_limit}</strong>
                    <small>邮箱用量</small>
                  </span>

                  <span className="user-status is-active">
                    <span />
                    正常
                  </span>

                  <ChevronRight size={16} />
                </button>
              ))
            ) : (
              <div className="user-list-state">
                {keyword ? `没有匹配 “${keyword}” 的用户` : '暂无用户，点击右上角创建'}
              </div>
            )}
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

      {draft && (
        <UserDialog
          draft={draft}
          saving={saving}
          error={dialogError}
          onChange={(patch) => setDraft((current) => (current ? { ...current, ...patch } : current))}
          onClose={() => setDraft(null)}
          onSave={() => void saveDraft()}
          onDelete={() => void deleteDraft()}
          onAssign={(address) => void assign(address)}
          onUnassign={(address) => void unassign(address)}
        />
      )}
    </div>
  )
}
