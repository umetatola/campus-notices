import { describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import NoticeListPage from './NoticeListPage'
import { json, mockApi, renderPage } from '../test/helpers'
import type { NoticeItem, PageResponse } from '../api'

const notice = (over: Partial<NoticeItem>): NoticeItem => ({
  id: 1,
  title: '2학기 장학금 신청 안내',
  titleEn: 'Fall scholarship applications',
  category: '장학',
  department: '학생지원팀',
  postedOn: '2026-10-01',
  deadline: null,
  pinned: false,
  sourceUrl: 'https://www.ajou.ac.kr/kr/ajou/notice.do?articleNo=1',
  ...over,
})

const page = (items: NoticeItem[], extra: Partial<PageResponse<NoticeItem>> = {}): PageResponse<NoticeItem> => ({
  items,
  page: 0,
  size: 20,
  totalItems: items.length,
  totalPages: 1,
  ...extra,
})

function api(notices: (url: URL) => PageResponse<NoticeItem>) {
  return mockApi({
    '/api/notices': (url) => json(notices(url)),
    '/api/notices/categories': () => json(['장학', '학사']),
  })
}

describe('NoticeListPage', () => {
  it('shows English titles with the Korean original, and a pinned badge', async () => {
    api(() => page([notice({ pinned: true }), notice({ id: 2, titleEn: null, title: '도서관 휴관 안내' })]))
    renderPage(<NoticeListPage />)

    expect(await screen.findByText('Fall scholarship applications')).toBeInTheDocument()
    expect(screen.getByText('2학기 장학금 신청 안내')).toHaveAttribute('lang', 'ko')
    expect(screen.getByText('Pinned')).toBeInTheDocument()
    // no English title yet: the Korean title is shown on its own
    expect(screen.getByText('도서관 휴관 안내')).toBeInTheDocument()
    expect(screen.getByText('2 notices')).toBeInTheDocument()
    expect(screen.getAllByRole('link')[0]).toHaveAttribute('href', '/notices/1')
  })

  it('searches after typing stops and keeps the query in the URL', async () => {
    const fetch = api((url) => page(url.searchParams.get('q') ? [] : [notice({})]))
    const router = renderPage(<NoticeListPage />)
    await screen.findByText('Fall scholarship applications')

    await userEvent.type(screen.getByRole('searchbox', { name: 'Search notices' }), '  dorm ')

    await waitFor(() => expect(router.state.location.search).toBe('?q=dorm'))
    expect(await screen.findByText('No notices match.')).toBeInTheDocument()
    const searched = fetch.mock.calls.map(([u]) => String(u)).filter((u) => u.includes('q=dorm'))
    expect(searched).toHaveLength(1) // one request after the pause, not one per key
  })

  it('filters by category and resets the page', async () => {
    api(() => page([notice({})], { totalPages: 3 }))
    const router = renderPage(<NoticeListPage />, { url: '/?page=2' })

    await userEvent.click(await screen.findByRole('button', { name: /Scholarships/ }))

    expect(router.state.location.search).toBe('?category=%EC%9E%A5%ED%95%99')
    expect(screen.getByRole('button', { name: /Scholarships/ })).toHaveAttribute('aria-pressed', 'true')
  })

  it('pages through results', async () => {
    api((url) => page([notice({})], { page: Number(url.searchParams.get('page')), totalPages: 3 }))
    const router = renderPage(<NoticeListPage />)

    await userEvent.click(await screen.findByRole('button', { name: 'Older →' }))
    await waitFor(() => expect(router.state.location.search).toBe('?page=1'))
    expect(await screen.findByText('Page 2 of 3')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '← Newer' })).toBeEnabled()
  })

  it('offers a retry when loading fails', async () => {
    let fail = true
    mockApi({
      '/api/notices': () => (fail ? json({ detail: 'down' }, 503) : json(page([notice({})]))),
      '/api/notices/categories': () => json([]),
    })
    renderPage(<NoticeListPage />)

    expect(await screen.findByText("Couldn't load notices.")).toBeInTheDocument()
    fail = false
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('Fall scholarship applications')).toBeInTheDocument()
  })
})
