import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryRouter, RouterProvider } from 'react-router'
import Layout from './Layout'
import LangProvider from '../LangProvider'
import { json, mockApi } from '../test/helpers'

describe('language switch', () => {
  it('switches the interface to Korean and remembers it', async () => {
    localStorage.clear()
    mockApi({
      '/api/me': () => new Response(null, { status: 401 }),
      '/api/status': () => json({ lastUpdatedAt: new Date(Date.now() - 5 * 60_000).toISOString(), updatesDelayed: false }),
    })
    const router = createMemoryRouter([{ element: <Layout />, children: [{ path: '/', element: <p>home</p> }] }])
    render(
      <LangProvider>
        <QueryClientProvider client={new QueryClient()}>
          <RouterProvider router={router} />
        </QueryClientProvider>
      </LangProvider>,
    )

    expect(await screen.findByText('Get alerts')).toBeInTheDocument()
    expect(await screen.findByText('Notices updated 5 minutes ago.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Switch language' }))

    expect(screen.getByText('알림 받기')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '언어 바꾸기' })).toHaveTextContent('English')
    expect(document.documentElement.lang).toBe('ko')
    expect(localStorage.getItem('lang')).toBe('ko')
    expect(screen.getByText('공지 업데이트: 5분 전')).toBeInTheDocument()
  })
})

describe('phone layout', () => {
  it('moves the section links into a bottom tab bar', async () => {
    localStorage.clear()
    // a narrow screen: the sm breakpoint does not match
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }))
    mockApi({
      '/api/me': () => json({ email: 'student@ajou.ac.kr' }),
      '/api/status': () => json({ lastUpdatedAt: null, updatesDelayed: false }),
    })
    const router = createMemoryRouter([{ element: <Layout />, children: [{ path: '/', element: <p>home</p> }] }])
    render(
      <LangProvider>
        <QueryClientProvider client={new QueryClient()}>
          <RouterProvider router={router} />
        </QueryClientProvider>
      </LangProvider>,
    )

    const tabs = await screen.findByRole('navigation', { name: 'Main sections' })
    await within(tabs).findByRole('link', { name: 'Saved' }) // once we know who is signed in
    expect(within(tabs).getAllByRole('link').map((a) => a.textContent)).toEqual(['Notices', 'Ask AI', 'Deadlines', 'Saved', 'Alerts'])
    expect(within(tabs).getByRole('link', { name: 'Notices' })).toHaveAttribute('aria-current', 'page')
    // signing out moves to the footer, next to the address
    expect(await screen.findByRole('button', { name: 'Sign out' })).toBeInTheDocument()
    expect(screen.getByText('student@ajou.ac.kr')).toBeInTheDocument()
  })
})
