import { describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
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
