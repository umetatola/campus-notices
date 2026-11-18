import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useIsFetching, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { useI18n } from './i18n'
import { applyTheme, applyZoom, savedTheme, savedZoom, ZOOM_STEP, type Theme } from './preferences'

// The buttons every app has: refresh, home, a ⋮ menu (zoom, theme, full screen, print, copy link, open in
// browser, shortcuts), a back-to-top button and keyboard shortcuts.

const iconButton =
  'grid size-8 place-items-center rounded-full border border-line bg-surface/70 text-ink-2 transition hover:border-accent hover:text-accent disabled:pointer-events-none disabled:opacity-35'

function Icon({ children, className = 'size-4' }: { children: ReactNode; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {children}
    </svg>
  )
}

/** A small message at the bottom of the window ("Link copied"). */
function useToast() {
  const [message, setMessage] = useState<string | null>(null)
  useEffect(() => {
    if (!message) return
    const timer = setTimeout(() => setMessage(null), 1800)
    return () => clearTimeout(timer)
  }, [message])
  const toast = message && (
    <div role="status" className="page-enter fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-ink px-4 py-2 text-sm font-medium text-bg shadow-lg">
      {message}
    </div>
  )
  return { toast, show: setMessage }
}

export function RefreshButton({ onDone }: { onDone?: () => void }) {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const fetching = useIsFetching() > 0
  const [spinning, setSpinning] = useState(false)
  const refresh = async () => {
    setSpinning(true)
    // fetch everything on screen again, without reloading the page (forms and scroll position stay)
    await queryClient.invalidateQueries()
    setSpinning(false)
    onDone?.()
  }
  return (
    <button onClick={() => void refresh()} aria-label={t('app.refresh')} title={`${t('app.refresh')} (F5)`} className={iconButton}>
      <Icon className={`size-4 ${spinning || fetching ? 'animate-spin' : ''}`}>
        <path d="M20 11a8 8 0 1 0-2.3 5.7" />
        <path d="M20 4v7h-7" />
      </Icon>
    </button>
  )
}

export function HomeButton() {
  const { t } = useI18n()
  const navigate = useNavigate()
  return (
    <button onClick={() => navigate('/')} aria-label={t('app.home')} title={`${t('app.home')} (Alt+Home)`} className={iconButton}>
      <Icon>
        <path d="M4 11.5 12 4l8 7.5" />
        <path d="M6 10v10h12V10" />
      </Icon>
    </button>
  )
}

function ShortcutsDialog({ onClose }: { onClose: () => void }) {
  const { t } = useI18n()
  const close = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    close.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  const rows: [string, string][] = [
    ['Alt + ←', t('app.keyBack')],
    ['Alt + →', t('app.keyForward')],
    ['F5', t('app.keyRefresh')],
    ['Alt + Home', t('app.keyHome')],
    ['Ctrl + K', t('app.keyAsk')],
    ['Ctrl + = / − / 0', t('app.keyZoom')],
    ['?', t('app.keyShortcuts')],
  ]
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4 backdrop-blur-sm" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-title"
        className="page-enter card w-full max-w-sm p-6"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id="shortcuts-title" className="text-lg font-semibold">
            {t('app.shortcuts')}
          </h2>
          <button ref={close} onClick={onClose} aria-label={t('app.close')} className={iconButton}>
            <Icon>
              <path d="M6 6l12 12M18 6 6 18" />
            </Icon>
          </button>
        </div>
        <dl className="space-y-2.5 text-sm">
          {rows.map(([keys, what]) => (
            <div key={keys} className="flex items-center justify-between gap-4">
              <dt className="text-ink-2">{what}</dt>
              <dd>
                <kbd className="rounded-md border border-line bg-bg px-2 py-0.5 font-mono text-xs text-ink shadow-[0_1px_0_var(--line)]">
                  {keys}
                </kbd>
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  )
}

export function AppMenu({ standalone }: { standalone: boolean }) {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [shortcuts, setShortcuts] = useState(false)
  const [theme, setTheme] = useState<Theme>(savedTheme)
  const [zoom, setZoom] = useState(savedZoom)
  const [fullScreen, setFullScreen] = useState(() => !!document.fullscreenElement)
  const { toast, show } = useToast()
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)

  const zoomTo = (z: number) => setZoom(applyZoom(z))
  const themeTo = (next: Theme) => {
    applyTheme(next)
    setTheme(next)
  }

  // keyboard shortcuts for the whole app
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && e.target.closest('input, textarea, select, [contenteditable]')
      const mod = e.ctrlKey || e.metaKey
      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        navigate('/ask')
      } else if (e.altKey && e.key === 'Home') {
        e.preventDefault()
        navigate('/')
      } else if (mod && (e.key === '=' || e.key === '+')) {
        e.preventDefault()
        setZoom((z) => applyZoom(z + ZOOM_STEP))
      } else if (mod && e.key === '-') {
        e.preventDefault()
        setZoom((z) => applyZoom(z - ZOOM_STEP))
      } else if (mod && e.key === '0') {
        e.preventDefault()
        setZoom(applyZoom(1))
      } else if (e.key === '?' && !typing) {
        e.preventDefault()
        setShortcuts(true)
      }
    }
    const onFullScreen = () => setFullScreen(!!document.fullscreenElement)
    window.addEventListener('keydown', onKey)
    document.addEventListener('fullscreenchange', onFullScreen)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('fullscreenchange', onFullScreen)
    }
  }, [navigate])

  // close on outside click / Escape; arrow keys move between items
  useEffect(() => {
    if (!open) return
    const items = () => [...(root.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]') ?? [])]
    items()[0]?.focus()
    const onDown = (e: MouseEvent) => !root.current?.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        trigger.current?.focus()
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        const all = items()
        const i = all.indexOf(document.activeElement as HTMLElement)
        all[(i + (e.key === 'ArrowDown' ? 1 : all.length - 1)) % all.length]?.focus()
      }
    }
    document.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  const run = (fn: () => void) => () => {
    setOpen(false)
    fn()
  }
  const item = 'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-ink transition hover:bg-accent-soft focus:bg-accent-soft focus:outline-none'
  const chip = (active: boolean) =>
    `flex-1 rounded-md px-2 py-1 text-xs font-medium transition ${active ? 'bg-surface text-accent shadow-sm' : 'text-ink-2 hover:text-ink'}`

  return (
    <div ref={root} className="relative">
      <button
        ref={trigger}
        onClick={() => setOpen((o) => !o)}
        aria-label={t('app.menu')}
        aria-haspopup="menu"
        aria-expanded={open}
        className={iconButton}
      >
        <Icon>
          <circle cx="12" cy="5" r="1" />
          <circle cx="12" cy="12" r="1" />
          <circle cx="12" cy="19" r="1" />
        </Icon>
      </button>

      {open && (
        <div role="menu" aria-label={t('app.menu')} className="page-enter card absolute top-10 right-0 z-30 w-64 space-y-1 p-2 hover:transform-none">
          <div className="flex items-center justify-between px-3 py-1.5 text-sm">
            <span className="text-ink-2">{t('app.zoom')}</span>
            <div className="flex items-center gap-1">
              <button role="menuitem" onClick={() => zoomTo(zoom - ZOOM_STEP)} aria-label={t('app.zoomOut')} className={`${iconButton} size-7`}>
                −
              </button>
              <button role="menuitem" onClick={() => zoomTo(1)} aria-label={t('app.zoomReset')} className="w-12 rounded-md py-1 text-center text-xs font-medium tabular-nums hover:bg-accent-soft">
                {Math.round(zoom * 100)}%
              </button>
              <button role="menuitem" onClick={() => zoomTo(zoom + ZOOM_STEP)} aria-label={t('app.zoomIn')} className={`${iconButton} size-7`}>
                +
              </button>
            </div>
          </div>
          <div className="px-3 py-1.5">
            <p className="mb-1.5 text-sm text-ink-2">{t('app.theme')}</p>
            <div className="flex gap-1 rounded-lg bg-bg p-1" role="group" aria-label={t('app.theme')}>
              {(['system', 'light', 'dark'] as Theme[]).map((th) => (
                <button key={th} role="menuitemradio" aria-checked={theme === th} onClick={() => themeTo(th)} className={chip(theme === th)}>
                  {t(th === 'system' ? 'app.themeSystem' : th === 'light' ? 'app.themeLight' : 'app.themeDark')}
                </button>
              ))}
            </div>
          </div>
          <div className="my-1 border-t border-line" />
          {document.fullscreenEnabled && (
            <button
              role="menuitem"
              className={item}
              onClick={run(() => void (fullScreen ? document.exitFullscreen() : document.documentElement.requestFullscreen()))}
            >
              <Icon>
                <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
              </Icon>
              {fullScreen ? t('app.exitFullScreen') : t('app.fullScreen')}
              <kbd className="ml-auto text-xs text-muted">F11</kbd>
            </button>
          )}
          <button role="menuitem" className={item} onClick={run(() => window.print())}>
            <Icon>
              <path d="M7 9V3h10v6M7 17H4v-7h16v7h-3" />
              <path d="M7 14h10v7H7z" />
            </Icon>
            {t('app.print')}
            <kbd className="ml-auto text-xs text-muted">Ctrl+P</kbd>
          </button>
          <button
            role="menuitem"
            className={item}
            onClick={run(() =>
              navigator.clipboard?.writeText(window.location.href).then(
                () => show(t('app.copied')),
                () => {},
              ),
            )}
          >
            <Icon>
              <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
              <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
            </Icon>
            {t('app.copyLink')}
          </button>
          {standalone && (
            <button role="menuitem" className={item} onClick={run(() => window.open(window.location.href, '_blank', 'noopener'))}>
              <Icon>
                <path d="M14 4h6v6M20 4l-9 9" />
                <path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
              </Icon>
              {t('app.openInBrowser')}
            </button>
          )}
          <button role="menuitem" className={item} onClick={run(() => setShortcuts(true))}>
            <Icon>
              <rect x="3" y="6" width="18" height="12" rx="2" />
              <path d="M7 10h.01M11 10h.01M15 10h.01M7 14h10" />
            </Icon>
            {t('app.shortcuts')}
            <kbd className="ml-auto text-xs text-muted">?</kbd>
          </button>
        </div>
      )}
      {shortcuts && <ShortcutsDialog onClose={() => setShortcuts(false)} />}
      {toast}
    </div>
  )
}

/** Appears after scrolling down a screen; smooth-scrolls back to the top. */
export function BackToTop() {
  const { t } = useI18n()
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > window.innerHeight * 0.8)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  if (!visible) return null
  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label={t('app.backToTop')}
      title={t('app.backToTop')}
      className="btn-primary page-enter fixed right-6 bottom-6 z-30 grid size-11 place-items-center rounded-full print:hidden"
    >
      <Icon className="size-5">
        <path d="M12 19V5M5.5 11.5 12 5l6.5 6.5" />
      </Icon>
    </button>
  )
}
