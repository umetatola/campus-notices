import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryRouter, RouterProvider } from 'react-router'
import Layout from './Layout'
import LangProvider from '../LangProvider'
import { mockApi } from '../test/helpers'

describe('language switch', () => {
  it('switches the interface to Korean and remembers it', async () => {
    localStorage.clear()
    mockApi({ '/api/me': () => new Response(null, { status: 401 }) })
    const router = createMemoryRouter([{ element: <Layout />, children: [{ path: '/', element: <p>home</p> }] }])
    render(
      <LangProvider>
        <QueryClientProvider client={new QueryClient()}>
          <RouterProvider router={router} />
        </QueryClientProvider>
      </LangProvider>,
    )

    expect(await screen.findByText('Get alerts')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Switch language' }))

    expect(screen.getByText('알림 받기')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '언어 바꾸기' })).toHaveTextContent('English')
    expect(document.documentElement.lang).toBe('ko')
    expect(localStorage.getItem('lang')).toBe('ko')
  })
})
