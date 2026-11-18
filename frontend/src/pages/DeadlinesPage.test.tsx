import { afterEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
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

  describe('calendar view', () => {
    afterEach(() => {
      vi.useRealTimers()
    })

    it('shows the month grid, lists the picked day and pages through the months in range', async () => {
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(new Date('2099-01-01T03:00:00Z')) // noon on Jan 1 in Korea
      const fetch = mockApi({
        '/api/notices/deadlines': () =>
          json([
            notice(1, 'Scholarship form', '2099-01-05'),
            notice(2, 'Dorm application', '2099-01-05'),
            notice(3, 'Library survey', '2099-01-20'),
            notice(4, 'Job fair sign-up', '2099-02-10'),
          ]),
      })
      renderPage(<DeadlinesPage />, { url: '/deadlines?view=calendar', path: '/deadlines' })

      expect(await screen.findByRole('heading', { name: 'January 2099' })).toBeInTheDocument()
      expect(fetch.mock.calls.map(([u]) => String(u))).toContain('/api/notices/deadlines?days=60')
      expect(screen.queryByRole('group', { name: 'How far ahead' })).not.toBeInTheDocument()

      // the month's first day with deadlines is open by default
      const jan5 = screen.getByRole('button', { name: 'Monday, January 5: 2 due' })
      expect(jan5).toHaveAttribute('aria-pressed', 'true')
      let day = screen.getByRole('region', { name: 'Due Monday, January 5' })
      expect(within(day).getByText('Scholarship form')).toBeInTheDocument()
      expect(within(day).getByText('Dorm application')).toBeInTheDocument()

      await userEvent.click(screen.getByRole('button', { name: 'Tuesday, January 20: 1 due' }))
      day = screen.getByRole('region', { name: 'Due Tuesday, January 20' })
      expect(within(day).getByText('Library survey')).toBeInTheDocument()
      expect(within(day).queryByText('Scholarship form')).not.toBeInTheDocument()

      expect(screen.getByRole('button', { name: 'Previous month' })).toBeDisabled()
      await userEvent.click(screen.getByRole('button', { name: 'Next month' }))
      expect(screen.getByRole('heading', { name: 'February 2099' })).toBeInTheDocument()
      day = screen.getByRole('region', { name: 'Due Tuesday, February 10' })
      expect(within(day).getByText('Job fair sign-up')).toBeInTheDocument()

      // 60 days from Jan 1 reach Mar 1, so March is the last month
      await userEvent.click(screen.getByRole('button', { name: 'Next month' }))
      expect(screen.getByRole('heading', { name: 'March 2099' })).toBeInTheDocument()
      expect(screen.getByText('No deadlines this month.')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Next month' })).toBeDisabled()
    })

    it('is switched on and off from the view buttons', async () => {
      mockApi({ '/api/notices/deadlines': () => json([]) })
      const router = renderPage(<DeadlinesPage />, { url: '/deadlines?days=30', path: '/deadlines' })

      await userEvent.click(await screen.findByRole('button', { name: 'Calendar' }))
      await waitFor(() => expect(router.state.location.search).toBe('?view=calendar'))
      expect(await screen.findByRole('button', { name: 'Previous month' })).toBeInTheDocument()

      await userEvent.click(screen.getByRole('button', { name: 'List' }))
      await waitFor(() => expect(router.state.location.search).toBe(''))
      expect(await screen.findByText('No deadlines in this period.')).toBeInTheDocument()
    })
  })

  it('says when nothing is due', async () => {
    mockApi({ '/api/notices/deadlines': () => json([]) })
    renderPage(<DeadlinesPage />, { url: '/deadlines', path: '/deadlines' })

    expect(await screen.findByText('No deadlines in this period.')).toBeInTheDocument()
  })
})
