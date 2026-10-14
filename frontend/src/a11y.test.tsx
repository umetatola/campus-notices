import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryRouter, RouterProvider } from 'react-router'
import axe from 'axe-core'
import { routes } from './routes'
import { LangContext, type Lang } from './i18n'
import { json, mockApi } from './test/helpers'

const notice = {
  id: 7,
  title: '[학사] 수강 철회 안내',
  titleEn: 'Course withdrawal',
  category: '학사',
  department: '학사팀',
  postedOn: '2026-10-01',
  deadline: '2099-12-31',
  pinned: true,
  sourceUrl: 'https://www.ajou.ac.kr/7',
  editedAt: '2026-10-12T03:00:00Z',
}

function api(signedIn: boolean) {
  mockApi({
    '/api/notices': () => json({ items: [notice], page: 0, size: 20, totalItems: 41, totalPages: 3 }),
    '/api/notices/categories': () => json(['학사', '장학']),
    '/api/notices/7/more-from-department': () => json([{ ...notice, id: 9 }]),
    '/api/notices/deadlines': () => json([{ ...notice, deadline: '2099-12-31' }]),
    '/api/notices/7': () =>
      json({
        ...notice,
        summary: { status: 'DONE', titleEn: 'Course withdrawal', summaryEn: 'Withdraw online.', deadline: '2099-12-31', deadlineNote: null },
        bodyHtml: '<p>본문 <img src="/a.png"></p>',
        bodyText: '본문',
        attachments: [{ name: '안내.pdf', url: 'https://www.ajou.ac.kr/f' }],
        firstSeenAt: '2026-10-01T00:00:00Z',
        updatedAt: '2026-10-01T00:00:00Z',
      }),
    '/api/me': () => (signedIn ? json({ email: 'me@ajou.ac.kr' }) : new Response(null, { status: 401 })),
    '/api/subscriptions': () => json([{ id: 1, keyword: '장학', createdAt: '2026-10-01T00:00:00Z' }]),
    '/api/alerts/status': () => json({ paused: true, frequency: 'INSTANT' }),
    '/api/bookmarks': () => json([notice]),
    '/api/status': () => json({ lastUpdatedAt: '2026-10-01T00:00:00Z', updatesDelayed: false }),
  })
}

async function check(url: string, ready: string | RegExp, { signedIn = false, lang = 'en' as Lang } = {}) {
  api(signedIn)
  const router = createMemoryRouter(routes, { initialEntries: [url] })
  const { container } = render(
    <LangContext value={{ lang, setLang: () => {} }}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </LangContext>,
  )
  await screen.findByText(ready)
  const result = await axe.run(container, {
    // jsdom has no layout or computed colors, so contrast can't be checked here
    rules: { 'color-contrast': { enabled: false } },
  })
  const problems = result.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(' ')).join(', ')})`)
  expect(problems).toEqual([])
}

describe('accessibility (axe)', () => {
  it('notice list', () => check('/', 'Course withdrawal'))
  it('notice list in Korean', () => check('/', '[학사] 수강 철회 안내', { lang: 'ko' }))
  it('notice page', () => check('/notices/7', 'Withdraw online.'))
  it('deadlines', () => check('/deadlines', 'Upcoming deadlines'))
  it('sign-in', () => check('/sign-in', 'Email me a sign-in link'))
  it('alerts', () => check('/alerts', 'Turn alerts back on', { signedIn: true }))
  it('saved notices', () => check('/saved', 'Saved notices', { signedIn: true }))
  it('notice page, signed in', () => check('/notices/7', /Save/, { signedIn: true }))
  it('unsubscribe', () => check('/unsubscribe?token=abc', 'Stop alert emails?'))
  it('not found', () => check('/nowhere', 'Page not found'))
})
