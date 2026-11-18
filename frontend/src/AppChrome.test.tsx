import { afterEach, describe, expect, it } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Layout from './pages/Layout'
import { json, mockApi, renderPage } from './test/helpers'

function api() {
  let statusCalls = 0
  mockApi({
    '/api/status': () => {
      statusCalls++
      return json({ lastUpdatedAt: '2026-11-18T00:00:00Z', updatesDelayed: false })
    },
    '/api/me': () => new Response(null, { status: 401 }),
    '/api/desktop/settings': () => new Response(null, { status: 404 }),
  })
  return () => statusCalls
}

afterEach(() => {
  document.documentElement.removeAttribute('data-theme')
  document.documentElement.style.removeProperty('zoom')
  localStorage.clear()
})

describe('app toolbar and menu', () => {
  it('refreshes the data on screen without reloading the page', async () => {
    const calls = api()
    renderPage(<Layout />)
    await screen.findByText(/Notices updated/)
    const before = calls()
    await userEvent.click(screen.getByRole('button', { name: 'Refresh' }))
    expect(calls()).toBeGreaterThan(before)
  })

  it('switches theme and zoom, and remembers them', async () => {
    api()
    renderPage(<Layout />)
    await userEvent.click(await screen.findByRole('button', { name: 'More options' }))
    expect(screen.getByRole('menu')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('menuitemradio', { name: 'Dark' }))
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
    expect(localStorage.getItem('cn-theme')).toBe('dark')
    expect(screen.getByRole('menuitemradio', { name: 'Dark' })).toHaveAttribute('aria-checked', 'true')

    await userEvent.click(screen.getByRole('menuitem', { name: 'Zoom in' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Zoom in' }))
    expect(document.documentElement.style.getPropertyValue('zoom')).toBe('1.2')
    await userEvent.click(screen.getByRole('menuitem', { name: 'Reset zoom' }))
    expect(document.documentElement.style.getPropertyValue('zoom')).toBe('')

    await userEvent.click(screen.getByRole('menuitemradio', { name: 'System' }))
    expect(document.documentElement).not.toHaveAttribute('data-theme')

    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('shows the keyboard shortcuts with ?, and closes them with Escape', async () => {
    api()
    renderPage(<Layout />)
    await screen.findByText(/Notices updated/)
    fireEvent.keyDown(window, { key: '?' })
    expect(screen.getByRole('dialog', { name: 'Keyboard shortcuts' })).toHaveTextContent('Ctrl + K')
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('Ctrl+K opens AI mode', async () => {
    api()
    const router = renderPage(<Layout />)
    await screen.findByText(/Notices updated/)
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    expect(router.state.location.pathname).toBe('/ask')
  })
})
