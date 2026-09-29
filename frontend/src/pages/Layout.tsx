import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, NavLink, Outlet, ScrollRestoration, useNavigate } from 'react-router'
import { signOut } from '../api'
import { useMe } from '../useMe'

export default function Layout() {
  const me = useMe()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const logout = useMutation({
    mutationFn: signOut,
    onSuccess: () => {
      queryClient.setQueryData(['me'], null)
      queryClient.removeQueries({ queryKey: ['subscriptions'] })
      navigate('/')
    },
  })

  const navLink = ({ isActive }: { isActive: boolean }) =>
    `text-sm ${isActive ? 'font-medium text-ink' : 'text-ink-2 hover:text-ink'}`

  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-4">
          <Link to="/" className="text-lg font-semibold tracking-tight text-ink">
            Campus Notices
          </Link>
          <nav className="flex items-center gap-4" aria-label="Account">
            {me ? (
              <>
                <NavLink to="/alerts" className={navLink}>
                  Alerts
                </NavLink>
                <span className="hidden max-w-48 truncate text-sm text-muted sm:inline" title={me.email}>
                  {me.email}
                </span>
                <button onClick={() => logout.mutate()} className="text-sm text-ink-2 hover:text-ink">
                  Sign out
                </button>
              </>
            ) : me === null ? (
              <NavLink
                to="/sign-in"
                className="rounded-md border border-accent px-3 py-1.5 text-sm font-medium text-accent hover:bg-accent-soft"
              >
                Get alerts
              </NavLink>
            ) : null}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6">
        <Outlet />
      </main>
      <footer className="mx-auto max-w-3xl px-4 pb-10 text-xs text-muted">
        Notices are collected from the public Ajou University notice board. Always check the original notice for
        official details.
      </footer>
      <ScrollRestoration />
    </div>
  )
}
