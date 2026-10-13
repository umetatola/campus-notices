import type { ReactElement } from 'react'
import { render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { vi } from 'vitest'
import { LangContext, type Lang } from '../i18n'

/** Renders one page at `url` (matched by `path`) with a fresh query cache; returns the router to inspect the URL. */
export function renderPage(element: ReactElement, { url = '/', path = '/', lang = 'en' as Lang } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const router = createMemoryRouter(
    [
      { path, element },
      { path: '*', element: <p>other page</p> },
    ],
    { initialEntries: [url] },
  )
  render(
    <LangContext value={{ lang, setLang: () => {} }}>
      <QueryClientProvider client={client}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </LangContext>,
  )
  return router
}

type Handler = (url: URL, init?: RequestInit) => Response | Promise<Response>

/** Replaces fetch with a function that answers by path; unknown paths get 404. Returns the mock for assertions. */
export function mockApi(routes: Record<string, Handler>) {
  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), 'http://localhost')
    const handler = routes[url.pathname]
    return handler ? handler(url, init) : new Response(null, { status: 404 })
  })
  vi.stubGlobal('fetch', fn)
  return fn
}

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
