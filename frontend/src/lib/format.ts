const DAY = 24 * 60 * 60 * 1000

export function formatMessageDate(value: string | number | Date): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const now = new Date()
  const sameDay = date.toDateString() === now.toDateString()
  if (sameDay) {
    return new Intl.DateTimeFormat('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date)
  }
  const yesterday = new Date(now.getTime() - DAY)
  if (date.toDateString() === yesterday.toDateString()) return '昨天'
  if (now.getTime() - date.getTime() < 6 * DAY) {
    return new Intl.DateTimeFormat('zh-CN', { weekday: 'short' }).format(date)
  }
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date).replace(/\//g, '-')
}

export function formatFullDate(value: string | number | Date): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

export function extractAddress(sender: string): { name: string; address: string } {
  const value = (sender || '').trim()
  const bracket = value.match(/^(.*?)<([^>]+)>\s*$/)
  if (bracket) {
    const name = bracket[1].trim().replace(/^["']|["']$/g, '')
    return { name: name || bracket[2], address: bracket[2] }
  }
  return { name: value, address: value }
}

export function senderLabel(sender: string): string {
  const { name } = extractAddress(sender)
  return name || '未知发件人'
}

export function domainOf(address: string): string {
  const at = address.lastIndexOf('@')
  return at >= 0 ? address.slice(at + 1).toLowerCase() : ''
}

export function localPartOf(address: string): string {
  const at = address.lastIndexOf('@')
  return at >= 0 ? address.slice(0, at) : address
}

export async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value)
    return true
  } catch {
    return false
  }
}

const VERIFICATION_PATTERN = /(?:验证码|校验码| confirmation code| verification code| code)\D{0,12}(\d{4,8})/i

export function extractVerificationCode(...sources: Array<string | null | undefined>): string {
  for (const source of sources) {
    if (!source) continue
    const match = source.match(VERIFICATION_PATTERN)
    if (match) return match[1]
  }
  return ''
}
