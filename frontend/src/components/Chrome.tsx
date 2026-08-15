import { AlertCircle, CheckCircle2, Info, LoaderCircle, Monitor, Moon, RefreshCw, Sun } from 'lucide-react'
import { useEffect, useState, useSyncExternalStore } from 'react'
import {
  getThemePreference,
  setThemePreference,
  subscribeTheme,
} from '../lib/theme'
import { MailfreeLogo } from './MailfreeLogo'

export function Brand() {
  return (
    <span className="brand">
      <span className="brand-mark" aria-hidden="true"><MailfreeLogo size={18} /></span>
      <span>Mailfree</span>
    </span>
  )
}

export function ThemeToggle({ labeled = false }: { labeled?: boolean }) {
  const preference = useSyncExternalStore(
    subscribeTheme,
    getThemePreference,
    getThemePreference,
  )
  const choices = [
    { value: 'light' as const, label: '亮色', Icon: Sun },
    { value: 'dark' as const, label: '暗色', Icon: Moon },
    { value: 'system' as const, label: '跟随系统', Icon: Monitor },
  ]
  return (
    <div
      className={`theme-selector ${labeled ? 'is-labeled' : ''}`}
      role="radiogroup"
      aria-label="界面主题"
    >
      {choices.map(({ value, label, Icon }) => (
        <button
          className={preference === value ? 'is-selected' : ''}
          type="button"
          role="radio"
          aria-checked={preference === value}
          aria-label={label}
          data-tooltip={label}
          key={value}
          onClick={() => setThemePreference(value)}
        >
          <Icon size={15} />
          {labeled && <span>{label}</span>}
        </button>
      ))}
    </div>
  )
}

export function PageLoader() {
  return (
    <div className="page-loader" role="status" aria-label="正在打开 Mailfree">
      <div className="opening-splash" aria-hidden="true">
        <span className="opening-splash__mark"><MailfreeLogo size={35} /></span>
        <span className="opening-splash__copy">
          <strong>Mailfree</strong>
          <small>FREE TEMPORARY MAIL · SIMPLE &amp; FAST</small>
        </span>
        <span className="opening-splash__track"><span /></span>
      </div>
      <span className="sr-only">正在打开 Mailfree</span>
    </div>
  )
}

export function ConnectionError({ message, retry }: { message: string; retry: () => void }) {
  return (
    <main className="center-page">
      <section className="auth-card error-card">
        <span className="auth-symbol auth-symbol--danger"><AlertCircle size={27} /></span>
        <p className="eyebrow">CONNECTION ERROR</p>
        <h1>暂时无法连接邮箱</h1>
        <p>{message}</p>
        <button className="button button--primary" type="button" onClick={retry}>
          <RefreshCw size={16} /> 重新连接
        </button>
      </section>
    </main>
  )
}

export type ToastKind = 'success' | 'error' | 'info'

export function Toast({ message, kind, onClose }: { message: string; kind: ToastKind; onClose: () => void }) {
  useEffect(() => {
    const timer = window.setTimeout(onClose, kind === 'error' ? 5200 : 3200)
    return () => window.clearTimeout(timer)
  }, [kind, message, onClose])

  const Icon = kind === 'success' ? CheckCircle2 : kind === 'error' ? AlertCircle : Info
  return (
    <div
      className="toast"
      role={kind === 'error' ? 'alert' : 'status'}
      style={kind === 'error' ? {
        borderColor: 'color-mix(in srgb, var(--danger) 25%, transparent)',
        background: 'var(--danger-soft)',
        color: 'var(--danger)',
      } : kind === 'info' ? {
        borderColor: 'color-mix(in srgb, var(--text) 14%, transparent)',
        background: 'var(--surface)',
        color: 'var(--text-secondary)',
      } : undefined}
    >
      <Icon size={16} />
      <span>{message}</span>
    </div>
  )
}

export function useToast() {
  const [toast, setToast] = useState<{ message: string; kind: ToastKind; key: number } | null>(null)
  return {
    toast,
    showToast: (message: string, kind: ToastKind = 'success') =>
      setToast({ message, kind, key: Date.now() }),
    dismissToast: () => setToast(null),
  }
}

export function SpinnerLabel({ text }: { text: string }) {
  return (
    <span className="list-state" role="status">
      <LoaderCircle className="spin" size={21} />
      <span>{text}</span>
    </span>
  )
}
