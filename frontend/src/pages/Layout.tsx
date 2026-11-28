import type { ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, NavLink, Outlet, ScrollRestoration, useLocation, useNavigate } from 'react-router'
import { fetchDesktopSettings, fetchStatus, signOut } from '../api'
import { timeAgo } from '../labels'
import { useMe } from '../useMe'
import { useReadSync } from '../readNotices'
import { useWide } from '../useWide'
import { useI18n } from '../i18n'
import { useHistoryNav, useStandaloneWindow } from '../useHistoryNav'
import { AppMenu, BackToTop, HomeButton, RefreshButton } from '../AppChrome'

function Arrow({ direction }: { direction: 'back' | 'forward' }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4" aria-hidden="true">
      {direction === 'back' ? <path d="M12.5 4.5 7 10l5.5 5.5" /> : <path d="M7.5 4.5 13 10l-5.5 5.5" />}
    </svg>
  )
}

function HistoryButtons() {
  const { t } = useI18n()
  const { canGoBack, canGoForward, back, forward } = useHistoryNav()
  const button =
    'grid size-8 place-items-center rounded-full border border-line bg-surface/70 text-ink-2 transition hover:border-accent hover:text-accent disabled:pointer-events-none disabled:opacity-35'
  return (
    <div className="flex shrink-0 items-center gap-1">
      <button onClick={back} disabled={!canGoBack} aria-label={t('nav.back')} title={`${t('nav.back')} (Alt+←)`} className={button}>
        <Arrow direction="back" />
      </button>
      <button onClick={forward} disabled={!canGoForward} aria-label={t('nav.forward')} title={`${t('nav.forward')} (Alt+→)`} className={button}>
        <Arrow direction="forward" />
      </button>
    </div>
  )
}

const TAB_ICONS: Record<string, ReactNode> = {
  home: (
    <>
      <path d="M4 10.5 12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5H15v-5.5H9v5.5H5.5A1.5 1.5 0 0 1 4 19z" />
    </>
  ),
  ask: <path d="M12 3l2 5.2a3 3 0 0 0 1.8 1.8L21 12l-5.2 2a3 3 0 0 0-1.8 1.8L12 21l-2-5.2A3 3 0 0 0 8.2 14L3 12l5.2-2A3 3 0 0 0 10 8.2z" />,
  deadlines: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M3.5 10h17M8 3v4M16 3v4M8 14h3" />
    </>
  ),
  saved: <path d="M6.5 3.5h11a1 1 0 0 1 1 1V21l-6.5-4.5L5.5 21V4.5a1 1 0 0 1 1-1z" />,
  alerts: (
    <>
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </>
  ),
}

/** Bottom navigation on phones, where the header has no room for the links. */
function TabBar({ signedIn }: { signedIn: boolean }) {
  const { t } = useI18n()
  const tabs: [string, string, string][] = [
    ['/', 'home', t('nav.home')],
    ['/ask', 'ask', t('nav.ask')],
    ['/deadlines', 'deadlines', t('nav.deadlines')],
    signedIn ? ['/saved', 'saved', t('nav.saved')] : ['/sign-in', 'alerts', t('nav.getAlerts')],
  ]
  if (signedIn) tabs.push(['/alerts', 'alerts', t('nav.alerts')])
  return (
    <nav className="tabbar fixed inset-x-0 bottom-0 z-30 border-t border-line/70 sm:hidden print:hidden" aria-label={t('nav.tabs')}>
      <ul className="mx-auto flex max-w-md justify-around px-2 pt-1.5 pb-1.5">
        {tabs.map(([to, icon, label]) => (
          <li key={to} className="flex-1">
            <NavLink to={to} end={to === '/'} className="flex flex-col items-center gap-0.5 rounded-xl py-1 text-[11px] font-medium text-muted transition">
              <span className="tab-icon grid h-7 w-12 place-items-center rounded-full transition">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="size-[21px]" aria-hidden="true">
                  {TAB_ICONS[icon]}
                </svg>
              </span>
              <span className="max-w-full truncate px-1">{label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}

export default function Layout() {
  const me = useMe()
  // signed in, the bold "unread" titles agree across the user's devices
  useReadSync()
  const { lang, setLang, t } = useI18n()
  const location = useLocation()
  const standalone = useStandaloneWindow()
  const wide = useWide()
  const status = useQuery({ queryKey: ['status'], queryFn: fetchStatus, refetchInterval: 60_000 })
  // answers only in the desktop app, which is where the Settings page applies
  const desktop = useQuery({ queryKey: ['desktop-settings'], queryFn: fetchDesktopSettings, retry: false })
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const logout = useMutation({
    mutationFn: signOut,
    onSuccess: () => {
      queryClient.setQueryData(['me'], null)
      queryClient.removeQueries({ queryKey: ['subscriptions'] })
      queryClient.removeQueries({ queryKey: ['bookmarks'] })
      navigate('/')
    },
  })

  const navLink = ({ isActive }: { isActive: boolean }) =>
    `rounded-full px-3 py-1.5 text-sm transition ${
      isActive ? 'bg-accent-soft font-medium text-accent' : 'text-ink-2 hover:bg-accent-soft/60 hover:text-ink'
    }`
  // the desktop app and an installed phone app have no browser toolbar, so they get their own arrows
  const showArrows = desktop.isSuccess || standalone

  return (
    <div className="min-h-screen">
      <div className="backdrop print:hidden" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <header className="glass sticky top-0 z-20 border-b border-line/70 print:hidden">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className={`shrink-0 items-center gap-1 ${showArrows ? 'flex' : 'hidden sm:flex'}`}>
              {showArrows && <HistoryButtons />}
              <RefreshButton />
              {showArrows && <HomeButton />}
            </div>
            <Link to="/" className="group flex shrink-0 items-center gap-2.5 text-lg font-semibold tracking-tight text-ink">
              <span className="brand-mark grid size-8 place-items-center rounded-[10px] text-white transition group-hover:rotate-[-6deg] group-hover:scale-105">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-[18px]" aria-hidden="true">
                  <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                  <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
                </svg>
              </span>
              <span>
                Campus <span className="text-accent">Notices</span>
              </span>
            </Link>
          </div>
          <nav className="flex items-center justify-end gap-x-1" aria-label={t('nav.account')}>
            {wide && (
            <div className="flex items-center gap-x-1">
            <NavLink
              to="/ask"
              className={({ isActive }) =>
                `group flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition ${
                  isActive ? 'bg-accent-soft text-accent' : 'text-ink hover:bg-accent-soft/60'
                }`
              }
            >
              <span className="ai-orb grid size-5 place-items-center rounded-md text-white transition group-hover:scale-110">
                <svg viewBox="0 0 24 24" fill="currentColor" className="size-3" aria-hidden="true">
                  <path d="M12 2.5l2.1 5.6a3 3 0 0 0 1.8 1.8l5.6 2.1-5.6 2.1a3 3 0 0 0-1.8 1.8L12 21.5l-2.1-5.6a3 3 0 0 0-1.8-1.8L2.5 12l5.6-2.1a3 3 0 0 0 1.8-1.8z" />
                </svg>
              </span>
              {t('nav.ask')}
            </NavLink>
            <NavLink to="/deadlines" className={navLink}>
              {t('nav.deadlines')}
            </NavLink>
            {desktop.isSuccess && (
              <NavLink to="/settings" className={navLink}>
                {t('nav.settings')}
              </NavLink>
            )}
            {me ? (
              <>
                <NavLink to="/saved" className={navLink}>
                  {t('nav.saved')}
                </NavLink>
                <NavLink to="/alerts" className={navLink}>
                  {t('nav.alerts')}
                </NavLink>
                <span
                  className="brand-mark ml-1.5 grid size-8 place-items-center rounded-full text-sm font-semibold text-white uppercase"
                  title={me.email}
                >
                  <span aria-hidden="true">{me.email.charAt(0)}</span>
                  <span className="sr-only">{me.email}</span>
                </span>
                <button onClick={() => logout.mutate()} className="rounded-full px-2.5 py-1.5 text-sm text-ink-2 transition hover:bg-accent-soft/60 hover:text-ink">
                  {t('nav.signOut')}
                </button>
              </>
            ) : me === null ? (
              <NavLink to="/sign-in" className="btn-primary ml-1 rounded-full px-4 py-1.5 text-sm font-medium">
                {t('nav.getAlerts')}
              </NavLink>
            ) : null}
            </div>
            )}
            <button
              onClick={() => setLang(lang === 'en' ? 'ko' : 'en')}
              aria-label={t('nav.switchLanguage')}
              lang={lang === 'en' ? 'ko' : 'en'}
              className="ml-1 rounded-full border border-line px-3 py-1.5 text-sm text-ink-2 transition hover:border-accent hover:text-accent"
            >
              {lang === 'en' ? '한국어' : 'English'}
            </button>
            <span className="ml-1">
              <AppMenu standalone={showArrows} />
            </span>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 pt-6 pb-8 sm:pt-8">
        <div key={location.pathname} className="page-enter">
          <Outlet />
        </div>
      </main>
      <footer className="mx-auto max-w-4xl px-4 pb-10 text-xs text-muted print:hidden">
        {status.data && (
          <p className={status.data.updatesDelayed ? 'mb-1 font-medium text-due' : 'mb-1'}>
            {status.data.lastUpdatedAt === null
              ? t('footer.neverUpdated')
              : t(status.data.updatesDelayed ? 'footer.delayed' : 'footer.updated', {
                  time: timeAgo(status.data.lastUpdatedAt, new Date(status.dataUpdatedAt), lang),
                })}
          </p>
        )}
        {t('footer.note')}
        {me && !wide && (
          <p className="mt-3 flex items-center gap-2">
            <span className="truncate">{me.email}</span>
            <button onClick={() => logout.mutate()} className="shrink-0 font-medium text-ink-2 underline">
              {t('nav.signOut')}
            </button>
          </p>
        )}
      </footer>
      {/* room for the tab bar on phones */}
      {!wide && (
        <>
          <div className="h-20 print:hidden" aria-hidden="true" />
          <TabBar signedIn={!!me} />
        </>
      )}
      <BackToTop />
      <ScrollRestoration />
    </div>
  )
}
