import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SignInPage from './SignInPage'
import { json, mockApi, renderPage } from '../test/helpers'

describe('SignInPage', () => {
  it('requests a sign-in link with the CSRF token and confirms', async () => {
    const fetch = mockApi({
      '/api/me': () => new Response(null, { status: 401 }),
      '/api/csrf': () => {
        document.cookie = 'XSRF-TOKEN=token-123'
        return new Response(null, { status: 204 })
      },
      '/api/auth/request-link': () => new Response(null, { status: 202 }),
    })
    renderPage(<SignInPage />, { url: '/sign-in', path: '/sign-in' })

    await userEvent.type(await screen.findByLabelText('Email'), ' me@ajou.ac.kr ')
    await userEvent.click(screen.getByRole('button', { name: 'Email me a sign-in link' }))

    expect(await screen.findByRole('heading', { name: 'Check your email' })).toBeInTheDocument()
    expect(screen.getByText('me@ajou.ac.kr')).toBeInTheDocument()
    const [, init] = fetch.mock.calls.find(([u]) => String(u).endsWith('/api/auth/request-link'))!
    expect(init?.method).toBe('POST')
    expect(new Headers(init?.headers).get('X-XSRF-TOKEN')).toBe('token-123')
    expect(JSON.parse(String(init?.body))).toEqual({ email: 'me@ajou.ac.kr' })
  })

  it('shows the server message when the request fails', async () => {
    document.cookie = 'XSRF-TOKEN=t'
    mockApi({
      '/api/me': () => new Response(null, { status: 401 }),
      '/api/auth/request-link': () => json({ detail: 'Too many requests' }, 429),
    })
    renderPage(<SignInPage />, { url: '/sign-in', path: '/sign-in' })

    await userEvent.type(await screen.findByLabelText('Email'), 'me@ajou.ac.kr')
    await userEvent.click(screen.getByRole('button', { name: 'Email me a sign-in link' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Too many requests. Please try again.')
  })

  it('sends signed-in users to their alerts', async () => {
    mockApi({ '/api/me': () => json({ email: 'me@ajou.ac.kr' }) })
    renderPage(<SignInPage />, { url: '/sign-in', path: '/sign-in' })
    expect(await screen.findByText('other page')).toBeInTheDocument()
  })

  it('is translated in Korean mode', async () => {
    mockApi({ '/api/me': () => new Response(null, { status: 401 }) })
    renderPage(<SignInPage />, { url: '/sign-in', path: '/sign-in', lang: 'ko' })
    expect(await screen.findByRole('heading', { name: '로그인' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '로그인 링크 받기' })).toBeInTheDocument()
  })
})
