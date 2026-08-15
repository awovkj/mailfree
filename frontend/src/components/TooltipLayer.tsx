import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal, flushSync } from 'react-dom'

const TOOLTIP_EXIT_MS = 170

type TooltipTarget = {
  element: HTMLElement
  content: string
}

type TooltipPosition = {
  left: number
  top: number
  arrowLeft: number
  side: 'top' | 'bottom'
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum)
}

function resolveTooltipPosition(
  anchor: { top: number; right: number; bottom: number; left: number; width: number; height: number },
  tooltip: { width: number; height: number },
  viewport: { width: number; height: number },
): TooltipPosition {
  const margin = 10
  const gap = 9
  const roomAbove = anchor.top - gap - tooltip.height >= margin
  const roomBelow = anchor.bottom + gap + tooltip.height <= viewport.height - margin
  const side = roomAbove || !roomBelow ? 'top' : 'bottom'
  const maximumLeft = Math.max(margin, viewport.width - tooltip.width - margin)
  const left = clamp(
    anchor.left + anchor.width / 2 - tooltip.width / 2,
    margin,
    maximumLeft,
  )
  const preferredTop = side === 'top'
    ? anchor.top - gap - tooltip.height
    : anchor.bottom + gap
  const maximumTop = Math.max(margin, viewport.height - tooltip.height - margin)
  const top = clamp(preferredTop, margin, maximumTop)
  const arrowLeft = clamp(
    anchor.left + anchor.width / 2 - left,
    11,
    Math.max(11, tooltip.width - 11),
  )
  return { left, top, arrowLeft, side }
}

export function TooltipLayer() {
  const [target, setTarget] = useState<TooltipTarget | null>(null)
  const [position, setPosition] = useState<TooltipPosition>({
    left: 0,
    top: 0,
    arrowLeft: 16,
    side: 'top',
  })
  const [ready, setReady] = useState(false)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const unmountTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastShownAtRef = useRef(0)

  useEffect(() => {
    let inputModality: 'keyboard' | 'pointer' = 'pointer'

    const clearTimer = (timer: typeof showTimerRef | typeof hideTimerRef) => {
      if (!timer.current) return
      clearTimeout(timer.current)
      timer.current = null
    }

    const close = (delay = 0) => {
      clearTimer(showTimerRef)
      clearTimer(hideTimerRef)
      clearTimer(unmountTimerRef)
      hideTimerRef.current = setTimeout(() => {
        flushSync(() => setReady(false))
        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        unmountTimerRef.current = setTimeout(
          () => setTarget(null),
          reducedMotion ? 0 : TOOLTIP_EXIT_MS,
        )
      }, delay)
    }

    const open = (element: HTMLElement, delay: number) => {
      const content = element.dataset.tooltip?.trim()
      if (!content) return
      clearTimer(showTimerRef)
      const fast = Date.now() - lastShownAtRef.current < 400
      const effectiveDelay = inputModality === 'keyboard' || fast ? 0 : delay
      showTimerRef.current = setTimeout(() => {
        clearTimer(hideTimerRef)
        clearTimer(unmountTimerRef)
        setTarget({ element, content })
        lastShownAtRef.current = Date.now()
      }, effectiveDelay)
    }

    const onPointerOver = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return
      const element = (event.target as Element | null)?.closest<HTMLElement>('[data-tooltip]')
      if (!element) return
      inputModality = 'pointer'
      if (target?.element === element) {
        clearTimer(hideTimerRef)
        return
      }
      open(element, 480)
    }

    const onPointerOut = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return
      const element = (event.target as Element | null)?.closest<HTMLElement>('[data-tooltip]')
      if (!element || element.contains(event.relatedTarget as Node)) return
      if (target?.element === element) close(40)
      else clearTimer(showTimerRef)
    }

    const onFocusIn = (event: FocusEvent) => {
      const element = (event.target as Element | null)?.closest<HTMLElement>('[data-tooltip]')
      if (!element || element.matches(':is(input, textarea)')) return
      inputModality = 'keyboard'
      if (target?.element === element) {
        clearTimer(hideTimerRef)
        return
      }
      open(element, 0)
    }

    const onFocusOut = (event: FocusEvent) => {
      const element = (event.target as Element | null)?.closest<HTMLElement>('[data-tooltip]')
      if (!element || element.contains(event.relatedTarget as Node)) return
      if (target?.element === element) close(0)
      else clearTimer(showTimerRef)
    }

    const onPointerDown = () => close(0)
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close(0)
    }
    const onScroll = (event: Event) => {
      if (target && event.target instanceof Node && !target.element.contains(event.target)) close(0)
    }

    document.addEventListener('pointerover', onPointerOver)
    document.addEventListener('pointerout', onPointerOut)
    document.addEventListener('focusin', onFocusIn)
    document.addEventListener('focusout', onFocusOut)
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('scroll', onScroll, true)
    return () => {
      document.removeEventListener('pointerover', onPointerOver)
      document.removeEventListener('pointerout', onPointerOut)
      document.removeEventListener('focusin', onFocusIn)
      document.removeEventListener('focusout', onFocusOut)
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('scroll', onScroll, true)
      clearTimer(showTimerRef)
      clearTimer(hideTimerRef)
      clearTimer(unmountTimerRef)
    }
  }, [target])

  useLayoutEffect(() => {
    if (!target || !tooltipRef.current) return
    const anchor = target.element.getBoundingClientRect()
    const size = {
      width: tooltipRef.current.offsetWidth,
      height: tooltipRef.current.offsetHeight,
    }
    setPosition(resolveTooltipPosition(anchor, size, {
      width: window.innerWidth,
      height: window.innerHeight,
    }))
    const frame = requestAnimationFrame(() => setReady(true))
    return () => cancelAnimationFrame(frame)
  }, [target])

  if (!target) return null

  return createPortal(
    <div
      className={`omni-tooltip${ready ? ' is-visible' : ''}`}
      data-side={position.side}
      style={{ left: position.left, top: position.top }}
      ref={tooltipRef}
      role="tooltip"
    >
      {target.content}
      <span className="omni-tooltip__arrow" style={{ left: position.arrowLeft }} />
    </div>,
    document.body,
  )
}
