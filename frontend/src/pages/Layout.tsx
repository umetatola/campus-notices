import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, NavLink, Outlet, ScrollRestoration, useNavigate } from 'react-router'
import { fetchStatus, signOut } from '../api'
import { timeAgo } from '../labels'
import { useMe } from '../useMe'
import { useI18n } from '../i18n'

export default function Layout() {
  const me = useMe()
  const { lang, setLang, t } = useI18n()
  const status = useQuery({ queryKey: ['status'], queryFn: fetchStatus, refetchInterval: 60_000 })
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
    `text-sm ${isActive ? 'font-medium text-ink' : 'text-ink-2 hover:text-ink'}`

  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-4">
          <Link to="/" className="shrink-0 text-lg font-semibold tracking-tight text-ink">
            Campus Notices
          </Link>
          <nav className="flex flex-wrap items-center justify-end gap-x-4 gap-y-1" aria-label={t('nav.account')}>
            <NavLink to="/deadlines" className={navLink}>
              {t('nav.deadlines')}
            </NavLink>
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
              <NavLink
                to="/sign-in"
                className="rounded-md border border-accent px-3 py-1.5 text-sm font-medium text-accent hover:bg-accent-soft"
              >
                {t('nav.getAlerts')}
              </NavLink>
            ) : null}
            <button
              onClick={() => setLang(lang === 'en' ? 'ko' : 'en')}
              aria-label={t('nav.switchLanguage')}
              lang={lang === 'en' ? 'ko' : 'en'}
              className="rounded-md px-2 py-1 text-sm text-ink-2 hover:bg-accent-soft hover:text-ink"
            >
              {lang === 'en' ? '한국어' : 'English'}
            </button>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6">
        <Outlet />
      </main>
      <footer className="mx-auto max-w-3xl px-4 pb-10 text-xs text-muted">
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
      <ScrollRestoration />
    </div>
  )
}
