import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, NavLink, Outlet, ScrollRestoration, useLocation, useNavigate } from 'react-router'
import { fetchDesktopSettings, fetchStatus, signOut } from '../api'
import { timeAgo } from '../labels'
import { useMe } from '../useMe'
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

export default function Layout() {
  const me = useMe()
  const { lang, setLang, t } = useI18n()
  const location = useLocation()
  const standalone = useStandaloneWindow()
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
            <div className="flex shrink-0 items-center gap-1">
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
          <nav className="flex flex-wrap items-center justify-end gap-x-1 gap-y-1" aria-label={t('nav.account')}>
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
                <span className="hidden max-w-48 truncate text-sm text-muted sm:inline" title={me.email}>
                  {me.email}
                </span>
                <button onClick={() => logout.mutate()} className="text-sm text-ink-2 hover:text-ink">
                  {t('nav.signOut')}
                </button>
              </>
            ) : me === null ? (
              <NavLink to="/sign-in" className="btn-primary ml-1 rounded-full px-4 py-1.5 text-sm font-medium">
                {t('nav.getAlerts')}
              </NavLink>
            ) : null}
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
      <main className="mx-auto max-w-4xl px-4 py-8">
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
      </footer>
      <BackToTop />
      <ScrollRestoration />
    </div>
  )
}
