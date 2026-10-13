import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import UnsubscribePage from './UnsubscribePage'
import { json, mockApi, renderPage } from '../test/helpers'

const page = (url: string) => renderPage(<UnsubscribePage />, { url, path: '/unsubscribe' })

describe('UnsubscribePage', () => {
  it('asks before unsubscribing, then confirms', async () => {
    document.cookie = 'XSRF-TOKEN=t'
    const fetch = mockApi({ '/api/alerts/unsubscribe': () => new Response(null, { status: 204 }) })
    page('/unsubscribe?token=abc_123')

    // opening the page alone does nothing (mail scanners follow links)
    expect(screen.getByRole('heading', { name: 'Stop alert emails?' })).toBeInTheDocument()
    expect(fetch).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: 'Unsubscribe' }))

    expect(await screen.findByRole('heading', { name: "You're unsubscribed" })).toBeInTheDocument()
    const [url, init] = fetch.mock.calls.at(-1)!
    expect(String(url)).toBe('/api/alerts/unsubscribe?token=abc_123')
    expect(init?.method).toBe('POST')
  })

  it('explains an invalid link', async () => {
    document.cookie = 'XSRF-TOKEN=t'
    mockApi({ '/api/alerts/unsubscribe': () => json({ detail: 'This unsubscribe link is not valid' }, 404) })
    page('/unsubscribe?token=nope')

    await userEvent.click(screen.getByRole('button', { name: 'Unsubscribe' }))
    expect(await screen.findByRole('heading', { name: "This link doesn't work" })).toBeInTheDocument()
  })

  it('handles a link without a token', () => {
    page('/unsubscribe')
    expect(screen.getByRole('heading', { name: "This link doesn't work" })).toBeInTheDocument()
  })
})
