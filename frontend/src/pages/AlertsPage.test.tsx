import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
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
      '/api/alerts/status': () => json({ paused }),
      '/api/alerts/resume': () => {
        paused = false
        return json({ paused: false })
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
      '/api/alerts/status': () => json({ paused: false }),
    })
    renderPage(<AlertsPage />, { url: '/alerts', path: '/alerts' })

    expect(await screen.findByText(/don't follow any keywords yet/)).toBeInTheDocument()
    expect(screen.queryByText('Alerts are paused.')).not.toBeInTheDocument()
  })
})
