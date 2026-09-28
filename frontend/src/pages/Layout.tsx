import { Link, Outlet, ScrollRestoration } from 'react-router'

export default function Layout() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-3xl items-baseline justify-between gap-4 px-4 py-4">
          <Link to="/" className="text-lg font-semibold tracking-tight text-ink">
            Campus Notices
          </Link>
          <span className="hidden text-sm text-muted sm:inline">Ajou University notices, in one place</span>
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
