import { describe, expect, it } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AlertsPage from './AlertsPage'
import { json, mockApi, renderPage } from '../test/helpers'

describe('AlertsPage', () => {
  it('shows paused alerts and turns them back on', async () => {
    document.cookie = 'XSRF-TOKEN=t'
    let paused = true
    mockApi({
      '/api/me': () => json({ email: 'me@ajou.ac.kr' }),
      '/api/subscriptions': () => json([{ id: 1, keyword: '장학', createdAt: '2026-10-01T00:00:00Z' }]),
      '/api/alerts/status': () => json({ paused, frequency: 'INSTANT' }),
      '/api/alerts/resume': () => {
        paused = false
        return json({ paused: false, frequency: 'INSTANT' })
      },
    })
    renderPage(<AlertsPage />, { url: '/alerts', path: '/alerts' })

    expect(await screen.findByText('Alerts are paused.')).toBeInTheDocument()
    expect(screen.getByText('장학')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Turn alerts back on' }))
    expect(screen.queryByText('Alerts are paused.')).not.toBeInTheDocument()
  })

  it('shows no banner while alerts are on', async () => {
    mockApi({
      '/api/me': () => json({ email: 'me@ajou.ac.kr' }),
      '/api/subscriptions': () => json([]),
      '/api/alerts/status': () => json({ paused: false, frequency: 'INSTANT' }),
    })
    renderPage(<AlertsPage />, { url: '/alerts', path: '/alerts' })

    expect(await screen.findByText(/don't follow any keywords yet/)).toBeInTheDocument()
    expect(screen.queryByText('Alerts are paused.')).not.toBeInTheDocument()
  })

  it('switches to one daily email', async () => {
    document.cookie = 'XSRF-TOKEN=t'
    let frequency = 'INSTANT'
    mockApi({
      '/api/me': () => json({ email: 'me@ajou.ac.kr' }),
      '/api/subscriptions': () => json([]),
      '/api/alerts/status': () => json({ paused: false, frequency }),
      '/api/alerts/frequency': (_, init) => {
        frequency = JSON.parse(String(init?.body)).frequency
        return json({ paused: false, frequency })
      },
    })
    renderPage(<AlertsPage />, { url: '/alerts', path: '/alerts' })

    expect(await screen.findByRole('radio', { name: /As they come/ })).toBeChecked()
    await userEvent.click(screen.getByRole('radio', { name: /Once a day/ }))
    await waitFor(() => expect(screen.getByRole('radio', { name: /Once a day/ })).toBeChecked())
    expect(frequency).toBe('DAILY')
  })

  it('previews what a keyword would have matched before following it', async () => {
    const asked: string[] = []
    mockApi({
      '/api/me': () => json({ email: 'me@ajou.ac.kr' }),
      '/api/subscriptions': () => json([{ id: 1, keyword: '장학', createdAt: '2026-10-01T00:00:00Z' }]),
      '/api/alerts/status': () => json({ paused: false, frequency: 'INSTANT' }),
      '/api/subscriptions/preview': (url) => {
        const keyword = url.searchParams.get('keyword')!
        asked.push(keyword)
        return keyword === 'visa'
          ? json({
              keyword,
              days: 30,
              count: 4,
              examples: [
                { id: 7, title: '[국제처] 비자 연장 안내', titleEn: '[OIA] Visa extension', postedOn: '2026-11-17' },
                { id: 6, title: '[국제처] 체류 안내', titleEn: null, postedOn: '2026-11-10' },
              ],
            })
          : json({ keyword, days: 30, count: 0, examples: [] })
      },
    })
    renderPage(<AlertsPage />, { url: '/alerts', path: '/alerts' })
    const box = await screen.findByRole('textbox', { name: 'Keyword to follow' })

    await userEvent.type(box, 'visa')
    expect(await screen.findByText('"visa" matched 4 notices in the last 30 days.')).toBeInTheDocument()
    const examples = screen.getByRole('list', { name: 'Recent notices this keyword matched' })
    expect(within(examples).getByRole('link', { name: '[OIA] Visa extension' })).toHaveAttribute('href', '/notices/7')
    // falls back to the Korean title until the English summary exists
    expect(within(examples).getByRole('link', { name: '[국제처] 체류 안내' })).toHaveAttribute('href', '/notices/6')
    // typing is debounced: one request for the whole word, not one per letter
    expect(asked).toEqual(['visa'])

    await userEvent.clear(box)
    await userEvent.type(box, 'zzz')
    expect(await screen.findByText(/"zzz" matched no notices/)).toBeInTheDocument()

    // nothing to preview for a keyword already followed, or a single letter
    await userEvent.clear(box)
    await userEvent.type(box, '장학')
    await userEvent.clear(box)
    await userEvent.type(box, 'x')
    await new Promise((r) => setTimeout(r, 500))
    expect(asked).toEqual(['visa', 'zzz'])
    expect(screen.queryByText(/matched/)).not.toBeInTheDocument()
  })

  it('is translated in Korean mode', async () => {
    mockApi({
      '/api/me': () => json({ email: 'me@ajou.ac.kr' }),
      '/api/subscriptions': () => json([]),
      '/api/alerts/status': () => json({ paused: true, frequency: 'INSTANT' }),
    })
    renderPage(<AlertsPage />, { url: '/alerts', path: '/alerts', lang: 'ko' })
    expect(await screen.findByRole('heading', { name: '내 알림' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '알림 다시 켜기' })).toBeInTheDocument()
  })
})
