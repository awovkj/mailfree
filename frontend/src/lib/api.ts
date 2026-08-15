export type Role = 'admin' | 'user' | 'guest' | 'mailbox'

export interface Session {
  authenticated: boolean
  role: Role
  username: string
  strictAdmin: boolean
  mailboxAddress?: string
}

export interface LoginResult {
  success: boolean
  role: Role
  can_send?: number
  mailbox_limit?: number
  mailbox?: string
}

export interface EmailSummary {
  id: number
  sender: string
  to_addrs: string
  subject: string
  received_at: string
  is_read: number
  preview: string
  verification_code?: string | null
}

export interface EmailDetail extends EmailSummary {
  content: string
  html_content: string
  download: string
}

export interface SentSummary {
  id: number
  resend_id: string | null
  recipients: string
  subject: string
  created_at: string
  status: string
}

export interface SentDetail extends SentSummary {
  from_addr: string
  html_content: string
  text_content: string
  scheduled_at: string | null
}

export interface MailboxItem {
  id: number
  address: string
  created_at: string
  is_pinned: number
  password_is_default: number
  can_login: number
  forward_to: string | null
  is_favorite: number
}

export interface Quota {
  limit: number
  used: number
  remaining: number
  note?: string
}

export interface UserRow {
  id: number
  username: string
  role: Role
  can_send: number
  mailbox_limit: number
  created_at: string
  mailbox_count?: number
}

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    credentials: 'include',
    headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
    ...init,
  })
  if (!response.ok) {
    let message = `请求失败 (${response.status})`
    try {
      const text = await response.text()
      if (text && !text.startsWith('<')) message = text
    } catch {
      // keep default message
    }
    throw new ApiError(message, response.status)
  }
  const contentType = response.headers.get('Content-Type') || ''
  if (!contentType.includes('application/json')) {
    return undefined as T
  }
  return response.json() as Promise<T>
}

function query(parameters: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(parameters)) {
    if (value !== undefined && value !== '') search.set(key, String(value))
  }
  const text = search.toString()
  return text ? `?${text}` : ''
}

export const api = {
  session: () => request<Session>('/api/session'),
  login: (username: string, password: string) =>
    request<LoginResult>('/api/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  logout: () => request<{ success: boolean }>('/api/logout', { method: 'POST' }),

  domains: () => request<string[]>('/api/domains'),
  generateMailbox: (length?: number, domainIndex = 0) =>
    request<{ email: string; expires: number }>(`/api/generate${query({ length, domainIndex })}`),
  createMailbox: (local: string, domainIndex = 0) =>
    request<{ email: string; expires: number }>('/api/create', {
      method: 'POST',
      body: JSON.stringify({ local, domainIndex }),
    }),

  mailboxes: (
    parameters: {
      q?: string
      page?: number
      size?: number
      domain?: string
      login?: string
      favorite?: string
      forward?: string
    } = {},
  ) => request<{ list: MailboxItem[]; total: number }>(`/api/mailboxes${query(parameters)}`),
  mailboxInfo: (address: string) =>
    request<{ id: number | null; address: string; is_favorite: boolean; forward_to: string | null; can_login: boolean }>(
      `/api/mailbox/info${query({ address })}`,
    ),
  pinMailbox: (address: string) =>
    request<{ success: boolean; isPinned: boolean }>(`/api/mailboxes/pin${query({ address })}`, { method: 'POST' }),
  quota: () => request<Quota>('/api/user/quota'),

  emails: (mailbox: string, limit = 20) =>
    request<EmailSummary[]>(`/api/emails${query({ mailbox, limit })}`),
  emailDetail: (id: number | string) => request<EmailDetail>(`/api/email/${id}`),
  deleteEmail: (id: number | string) =>
    request<{ success: boolean; deleted: boolean }>(`/api/email/${id}`, { method: 'DELETE' }),
  clearEmails: (mailbox: string) =>
    request<{ success: boolean; deletedCount: number }>(`/api/emails${query({ mailbox })}`, { method: 'DELETE' }),

  sent: (from: string, limit = 20) =>
    request<SentSummary[]>(`/api/sent${query({ from, limit })}`),
  sentDetail: (id: number | string) => request<SentDetail>(`/api/sent/${id}`),

  send: (payload: { from: string; to: string; subject: string; html: string; fromName?: string }) =>
    request<{ success: boolean; id?: string }>('/api/send', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  users: (limit = 100, offset = 0, sort = 'desc') =>
    request<UserRow[]>(`/api/users${query({ limit, offset, sort })}`),
  createUser: (payload: { username: string; password?: string; role?: string; mailboxLimit?: number }) =>
    request<UserRow>('/api/users', { method: 'POST', body: JSON.stringify(payload) }),
  updateUser: (id: number, payload: Partial<{ role: string; can_send: boolean | number; mailboxLimit: number; password: string }>) =>
    request<{ success: boolean }>(`/api/users/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deleteUser: (id: number) =>
    request<{ success: boolean }>(`/api/users/${id}`, { method: 'DELETE' }),
  userMailboxes: (id: number) =>
    request<Array<{ address: string; created_at: string }>>(`/api/users/${id}/mailboxes`),
  assignMailbox: (username: string, address: string) =>
    request<{ success: boolean }>('/api/users/assign', {
      method: 'POST',
      body: JSON.stringify({ username, address }),
    }),
  unassignMailbox: (username: string, address: string) =>
    request<{ success: boolean }>('/api/users/unassign', {
      method: 'POST',
      body: JSON.stringify({ username, address }),
    }),

  toggleMailboxLogin: (address: string) =>
    request<{ success: boolean; can_login: boolean }>('/api/mailboxes/toggle-login', {
      method: 'POST',
      body: JSON.stringify({ address }),
    }),
  setMailboxPassword: (address: string, password: string) =>
    request<{ success: boolean }>('/api/mailboxes/change-password', {
      method: 'POST',
      body: JSON.stringify({ address, password }),
    }),
  setMailboxForward: (address: string, forwardTo: string) =>
    request<{ success: boolean }>('/api/mailbox/forward', {
      method: 'POST',
      body: JSON.stringify({ address, forward_to: forwardTo }),
    }),
  toggleMailboxFavorite: (address: string) =>
    request<{ success: boolean }>('/api/mailbox/favorite', {
      method: 'POST',
      body: JSON.stringify({ address }),
    }),
  deleteMailbox: (address: string) =>
    request<{ success: boolean }>(`/api/mailboxes${query({ address })}`, { method: 'DELETE' }),
  changeOwnMailboxPassword: (address: string, oldPassword: string, newPassword: string) =>
    request<{ success: boolean }>('/api/mailbox/password', {
      method: 'PUT',
      body: JSON.stringify({ address, oldPassword, newPassword }),
    }),
}
