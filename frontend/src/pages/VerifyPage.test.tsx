import { describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import VerifyPage from './VerifyPage'
import { json, mockApi, renderPage } from '../test/helpers'

const page = (url: string) => renderPage(<VerifyPage />, { url, path: '/verify' })

describe('VerifyPage', () => {
  it('signs in once with the emailed token and goes to the alerts page', async () => {
    document.cookie = 'XSRF-TOKEN=t'
    const fetch = mockApi({ '/api/auth/verify': () => json({ email: 'a@b.kr' }) })
    const router = page('/verify?token=abc')

    expect(screen.getByText('Signing you in…')).toBeInTheDocument()
    await waitFor(() => expect(router.state.location.pathname).toBe('/alerts'))

    expect(fetch).toHaveBeenCalledTimes(1)
    const [, init] = fetch.mock.calls[0]
    expect(init?.method).toBe('POST')
    expect(init?.body).toBe(JSON.stringify({ token: 'abc' }))
  })

  it('explains an expired or used link and offers a new one', async () => {
    document.cookie = 'XSRF-TOKEN=t'
    mockApi({ '/api/auth/verify': () => json({ detail: 'expired' }, 400) })
    const router = page('/verify?token=old')

    expect(await screen.findByRole('heading', { name: "This sign-in link doesn't work" })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Get a new link' })).toHaveAttribute('href', '/sign-in')
    expect(router.state.location.pathname).toBe('/verify')
  })

  it('does not call the API when the link has no token', () => {
    const fetch = mockApi({})
    page('/verify')
    expect(screen.getByRole('heading', { name: "This sign-in link doesn't work" })).toBeInTheDocument()
    expect(fetch).not.toHaveBeenCalled()
  })
})
