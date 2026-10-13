import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import SavedPage from './SavedPage'
import { json, mockApi, renderPage } from '../test/helpers'
import type { NoticeItem } from '../api'

const saved: NoticeItem = {
  id: 3,
  title: '기숙사 입사 안내',
  titleEn: 'Dorm move-in guide',
  category: '생활',
  department: '생활관',
  postedOn: '2026-10-10',
  deadline: null,
  pinned: false,
  sourceUrl: 'https://www.ajou.ac.kr/3',
  editedAt: null,
}

describe('SavedPage', () => {
  it('lists saved notices with links to them', async () => {
    mockApi({ '/api/me': () => json({ email: 'me@ajou.ac.kr' }), '/api/bookmarks': () => json([saved]) })
    renderPage(<SavedPage />, { url: '/saved', path: '/saved' })

    expect(await screen.findByRole('heading', { name: 'Saved notices' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Dorm move-in guide/ })).toHaveAttribute('href', '/notices/3')
  })

  it('explains how to save when nothing is saved yet', async () => {
    mockApi({ '/api/me': () => json({ email: 'me@ajou.ac.kr' }), '/api/bookmarks': () => json([]) })
    renderPage(<SavedPage />, { url: '/saved', path: '/saved' })

    expect(await screen.findByText('Nothing saved yet.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Browse notices' })).toHaveAttribute('href', '/')
  })

  it('sends signed-out visitors to sign in', async () => {
    mockApi({ '/api/me': () => new Response(null, { status: 401 }) })
    renderPage(<SavedPage />, { url: '/saved', path: '/saved' })

    expect(await screen.findByText('other page')).toBeInTheDocument()
  })
})
