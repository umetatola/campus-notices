import { describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import NoticeDetailPage from './NoticeDetailPage'
import { json, mockApi, renderPage } from '../test/helpers'
import type { NoticeDetail } from '../api'

const detail = (over: Partial<NoticeDetail> = {}): NoticeDetail => ({
  id: 7,
  title: '수강 철회 기간 안내',
  category: '학사',
  department: '학사팀',
  postedOn: '2026-10-01',
  pinned: false,
  sourceUrl: 'https://www.ajou.ac.kr/kr/ajou/notice.do?articleNo=7',
  editedAt: null,
  summary: {
    status: 'DONE',
    titleEn: 'Course withdrawal period',
    summaryEn: 'Students can withdraw from courses online until the deadline.',
    deadline: '2099-12-31',
    deadlineNote: 'until 17:00',
  },
  bodyHtml: '<p>본문</p>',
  bodyText: '본문',
  attachments: [{ name: '안내문.pdf', url: 'https://www.ajou.ac.kr/file/1' }],
  firstSeenAt: '2026-10-01T09:00:00Z',
  updatedAt: '2026-10-01T09:00:00Z',
  ...over,
})

const show = (notice: NoticeDetail | null) => {
  mockApi({ '/api/notices/7': () => (notice ? json(notice) : json({ detail: 'Not found' }, 404)) })
  renderPage(<NoticeDetailPage />, { url: '/notices/7', path: '/notices/:id' })
}

describe('NoticeDetailPage', () => {
  it('shows the English summary, deadline, attachments and original link', async () => {
    show(detail())

    expect(await screen.findByRole('heading', { level: 1, name: 'Course withdrawal period' })).toBeInTheDocument()
    expect(screen.getByText('Students can withdraw from courses online until the deadline.')).toBeInTheDocument()
    expect(screen.getByText(/until 17:00/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '안내문.pdf' })).toHaveAttribute('href', 'https://www.ajou.ac.kr/file/1')
    expect(screen.getByRole('link', { name: /Open the original/ })).toHaveAttribute('rel', 'noopener noreferrer')
    expect(screen.getByRole('link', { name: 'Add to calendar' })).toHaveAttribute('href', '/api/notices/7/calendar.ics')
  })

  it('says when the notice was edited, in Korean time', async () => {
    show(detail({ editedAt: '2026-10-12T16:30:00Z' })) // Oct 13, 01:30 in Seoul

    const edited = await screen.findByText('Edited Oct 13')
    expect(edited).toHaveAttribute('dateTime', '2026-10-12T16:30:00Z')
    expect(edited).toHaveAttribute('title', expect.stringContaining('changed this notice'))
  })

  it('shows no edit mark for an unedited notice', async () => {
    show(detail())
    await screen.findByRole('heading', { level: 1 })
    expect(screen.queryByText(/^Edited/)).not.toBeInTheDocument()
  })

  it('lets a signed-in user save and unsave the notice', async () => {
    document.cookie = 'XSRF-TOKEN=t'
    let saved = false
    const calls: string[] = []
    mockApi({
      '/api/notices/7': () => json(detail()),
      '/api/me': () => json({ email: 'me@ajou.ac.kr' }),
      '/api/bookmarks': () => json(saved ? [{ ...detail(), titleEn: null, deadline: null }] : []),
      '/api/bookmarks/7': (_, init) => {
        calls.push(init?.method ?? 'GET')
        saved = init?.method === 'PUT'
        return new Response(null, { status: 204 })
      },
    })
    renderPage(<NoticeDetailPage />, { url: '/notices/7', path: '/notices/:id' })

    const button = await screen.findByRole('button', { name: /Save/ })
    expect(button).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(button)
    await waitFor(() => expect(screen.getByRole('button', { name: /Saved/ })).toHaveAttribute('aria-pressed', 'true'))
    await userEvent.click(screen.getByRole('button', { name: /Saved/ }))
    await waitFor(() => expect(screen.getByRole('button', { name: /Save/ })).toHaveAttribute('aria-pressed', 'false'))
    expect(calls).toEqual(['PUT', 'DELETE'])
  })

  it('has no save button when signed out', async () => {
    show(detail())
    await screen.findByRole('heading', { level: 1 })
    expect(screen.queryByRole('button', { name: /Save/ })).not.toBeInTheDocument()
  })

  it('offers no calendar link once the deadline has passed', async () => {
    const summary = { ...detail().summary, deadline: '2020-01-31' }
    show(detail({ summary }))

    expect(await screen.findByText('Deadline passed')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Add to calendar' })).not.toBeInTheDocument()
  })

  it('removes scripts and event handlers from the notice body', async () => {
    show(detail({ bodyHtml: '<p>안내</p><img src="x" onerror="alert(1)"><script>alert(2)</script>' }))

    await screen.findByText('안내')
    const body = document.querySelector('.notice-body')!
    expect(body.querySelector('script')).toBeNull()
    expect(body.querySelector('img')).not.toHaveAttribute('onerror')
  })

  it('names images that have no alt text', async () => {
    show(detail({ bodyHtml: '<p>안내</p><img src="/1.png"><img src="/2.png" alt="포스터">', bodyText: null }))

    await screen.findByText('안내')
    expect(screen.getByAltText('Notice image 1 of 2')).toBeInTheDocument()
    expect(screen.getByAltText('포스터')).toBeInTheDocument()
  })

  it('explains when the English summary is not ready yet', async () => {
    show(detail({ summary: { status: 'PENDING', titleEn: null, summaryEn: null, deadline: null, deadlineNote: null } }))

    expect(await screen.findByRole('heading', { level: 1, name: '수강 철회 기간 안내' })).toBeInTheDocument()
    expect(screen.getByText(/English summary coming soon/)).toBeInTheDocument()
  })

  it('shows the not-found page for a missing notice', async () => {
    show(null)
    expect(await screen.findByRole('heading', { name: /not found/i })).toBeInTheDocument()
  })
})
