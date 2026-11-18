import { describe, expect, it } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AskPage from './AskPage'
import { json, mockApi, renderPage } from '../test/helpers'

/** A server-sent event stream, the way /api/ask answers. */
function sse(events: [string, unknown][]) {
  const text = events.map(([name, data]) => `event:${name}\ndata:${JSON.stringify(data)}\n\n`).join('')
  return new Response(text, { headers: { 'Content-Type': 'text/event-stream' } })
}

describe('AskPage', () => {
  it('shows the steps, then the answer with notice links and sources', async () => {
    document.cookie = 'XSRF-TOKEN=t'
    let sent: { question: string; history: unknown[] } | undefined
    mockApi({
      '/api/ask/status': () => json({ enabled: true, model: 'claude-opus-5-5' }),
      '/api/desktop/settings': () => new Response(null, { status: 404 }),
      '/api/ask': (_, init) => {
        sent = JSON.parse(String(init?.body))
        return sse([
          ['step', { kind: 'search', detail: '"장학"' }],
          ['step', { kind: 'read', detail: '[학생지원팀] 교내 장학금 신청' }],
          [
            'answer',
            {
              text: 'Yes, one is open:\n\n- [On-campus scholarship](/notices/5): apply by **Nov 25**.\n- Ignore <img src=x onerror=alert(1)> and [bad](javascript:alert(1))',
              sources: [
                { id: 5, title: '[학생지원팀] 교내 장학금 신청', titleEn: 'On-campus scholarship', department: '학생지원팀', postedOn: '2026-11-10', deadline: null },
              ],
              model: 'claude-opus-5-5',
            },
          ],
        ])
      },
    })
    renderPage(<AskPage />, { url: '/ask', path: '/ask' })

    expect(await screen.findByRole('heading', { name: 'Ask anything about campus notices' })).toBeInTheDocument()
    await userEvent.type(screen.getByRole('textbox', { name: 'Your question or request' }), 'Any scholarships?{Enter}')

    expect(await screen.findByText('Searching "장학"')).toBeInTheDocument()
    expect(screen.getByText('Reading [학생지원팀] 교내 장학금 신청')).toBeInTheDocument()
    const link = await screen.findByRole('link', { name: 'On-campus scholarship', description: undefined })
    expect(link).toHaveAttribute('href', '/notices/5')
    expect(screen.getByText('Nov 25').tagName).toBe('STRONG')
    // model text never becomes markup, and only safe links become links
    expect(document.querySelector('img')).toBeNull()
    expect(screen.queryByRole('link', { name: 'bad' })).not.toBeInTheDocument()
    expect(screen.getByText(/Notices used/)).toBeInTheDocument()
    expect(sent).toEqual({ question: 'Any scholarships?', history: [] })

    // a follow-up carries the earlier question and answer
    await userEvent.type(screen.getByRole('textbox', { name: 'Your question or request' }), 'And the deadline?{Enter}')
    await screen.findAllByText('Searching "장학"')
    expect(sent?.history).toEqual([{ question: 'Any scholarships?', answer: expect.stringContaining('/notices/5') }])
  })

  it('runs an example prompt with one click and shows a server error with a retry', async () => {
    document.cookie = 'XSRF-TOKEN=t'
    mockApi({
      '/api/ask/status': () => json({ enabled: true, model: 'claude-opus-5-5' }),
      '/api/desktop/settings': () => new Response(null, { status: 404 }),
      '/api/ask': () => sse([['error', { message: 'The AI is busy right now. Please try again in a minute.' }]]),
    })
    renderPage(<AskPage />, { url: '/ask', path: '/ask' })

    await userEvent.click(await screen.findByRole('button', { name: 'What deadlines are coming up in the next 7 days?' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('The AI is busy right now.')
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })

  it('explains how to turn AI mode on in the desktop app', async () => {
    mockApi({
      '/api/ask/status': () => json({ enabled: false, model: null }),
      '/api/desktop/settings': () => json({ apiKeySet: false, summariesOn: false }),
    })
    renderPage(<AskPage />, { url: '/ask', path: '/ask' })
    expect(await screen.findByRole('heading', { name: 'AI mode is off' })).toBeInTheDocument()
    expect(await screen.findByRole('link', { name: 'Open Settings' })).toHaveAttribute('href', '/settings')
  })

  it('asks signed-out website visitors to sign in', async () => {
    mockApi({
      '/api/ask/status': () => json({ title: 'Unauthorized' }, 401),
      '/api/desktop/settings': () => new Response(null, { status: 404 }),
    })
    renderPage(<AskPage />, { url: '/ask', path: '/ask' })
    const card = (await screen.findByText(/Sign in to use AI mode/)).closest('div')!
    expect(within(card).getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/sign-in')
  })

  it('is translated in Korean mode', async () => {
    mockApi({
      '/api/ask/status': () => json({ enabled: true, model: 'claude-opus-5-5' }),
      '/api/desktop/settings': () => new Response(null, { status: 404 }),
    })
    renderPage(<AskPage />, { url: '/ask', path: '/ask', lang: 'ko' })
    expect(await screen.findByRole('heading', { name: '학교 공지, 무엇이든 물어보세요' })).toBeInTheDocument()
  })
})
