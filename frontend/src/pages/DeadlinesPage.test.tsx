import { describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DeadlinesPage from './DeadlinesPage'
import { json, mockApi, renderPage } from '../test/helpers'
import type { NoticeItem } from '../api'

const notice = (id: number, titleEn: string, deadline: string): NoticeItem => ({
  id,
  title: `공지 ${id}`,
  titleEn,
  category: '장학',
  department: null,
  postedOn: '2026-10-01',
  deadline,
  pinned: false,
  sourceUrl: `https://www.ajou.ac.kr/${id}`,
  editedAt: null,
})

describe('DeadlinesPage', () => {
  it('lists upcoming deadlines and widens the range from the URL', async () => {
    const fetch = mockApi({
      '/api/notices/deadlines': (url) =>
        json(
          url.searchParams.get('days') === '30'
            ? [notice(1, 'Scholarship form', '2099-01-02'), notice(2, 'Dorm application', '2099-01-20')]
            : [notice(1, 'Scholarship form', '2099-01-02')],
        ),
    })
    const router = renderPage(<DeadlinesPage />, { url: '/deadlines', path: '/deadlines' })

    expect(await screen.findByText('Scholarship form')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next 2 weeks' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByText('Dorm application')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Next 30 days' }))
    expect(await screen.findByText('Dorm application')).toBeInTheDocument()
    await waitFor(() => expect(router.state.location.search).toBe('?days=30'))
    expect(fetch.mock.calls.map(([u]) => String(u))).toContain('/api/notices/deadlines?days=30')
  })

  it('says when nothing is due', async () => {
    mockApi({ '/api/notices/deadlines': () => json([]) })
    renderPage(<DeadlinesPage />, { url: '/deadlines', path: '/deadlines' })

    expect(await screen.findByText('No deadlines in this period.')).toBeInTheDocument()
  })
})
