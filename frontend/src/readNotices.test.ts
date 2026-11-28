import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { waitFor } from '@testing-library/react'
import { isRead, markAllRead, markRead, resetReadCache, startSync, stopSync } from './readNotices'
import { json, mockApi } from './test/helpers'

const stored = () => JSON.parse(localStorage.getItem('cn-read') ?? '[]') as number[]

/** The ids sent to POST /api/reads, one array per request. */
function sent(fetch: ReturnType<typeof mockApi>): number[][] {
  return fetch.mock.calls
    .filter(([u, init]) => String(u).endsWith('/api/reads') && init?.method === 'POST')
    .map(([, init]) => JSON.parse(String(init!.body)).ids as number[])
}

function server(reads: number[]) {
  return mockApi({
    '/api/csrf': () => {
      document.cookie = 'XSRF-TOKEN=t'
      return new Response(null, { status: 204 })
    },
    '/api/reads': (_url, init) => (init?.method === 'POST' ? new Response(null, { status: 204 }) : json(reads)),
  })
}

describe('readNotices', () => {
  beforeEach(() => {
    localStorage.clear()
    resetReadCache()
  })
  afterEach(() => {
    localStorage.clear()
    resetReadCache()
  })

  it('remembers reads in this browser without signing in', () => {
    const fetch = server([])
    markRead(4)
    markAllRead([5, 4, 5])

    expect(stored()).toEqual([4, 5])
    expect(isRead(5)).toBe(true)
    expect(sent(fetch)).toEqual([]) // signed out: nothing goes to the server
  })

  it('on sign-in, takes what other devices read and sends what this one read', async () => {
    localStorage.setItem('cn-read', JSON.stringify([1, 2]))
    resetReadCache()
    const fetch = server([9, 2, 8]) // newest first

    await startSync('frank@ajou.ac.kr')

    expect(isRead(9)).toBe(true)
    expect(isRead(8)).toBe(true)
    // older server reads first, then this device's own
    expect(stored()).toEqual([8, 9, 1, 2])
    await waitFor(() => expect(sent(fetch)).toEqual([[1]]))
  })

  it('sends new reads while signed in, and stops after sign-out', async () => {
    const fetch = server([])
    await startSync('frank@ajou.ac.kr')

    markAllRead([3, 4])
    await waitFor(() => expect(sent(fetch)).toEqual([[3, 4]]))

    stopSync()
    markRead(7)
    expect(isRead(7)).toBe(true)
    await new Promise((r) => setTimeout(r, 20))
    expect(sent(fetch)).toEqual([[3, 4]])
  })

  it('sends a long local backlog in batches of 500', async () => {
    const backlog = Array.from({ length: 1200 }, (_, i) => i + 1)
    localStorage.setItem('cn-read', JSON.stringify(backlog))
    resetReadCache()
    const fetch = server([])

    await startSync('frank@ajou.ac.kr')

    // the batches go in parallel, so they can arrive in any order
    await waitFor(() => expect(sent(fetch).map((b) => b.length).sort()).toEqual([200, 500, 500]))
    expect(new Set(sent(fetch).flat()).size).toBe(1200)
  })

  it('keeps working locally when the server is unreachable', async () => {
    mockApi({ '/api/reads': () => new Response(null, { status: 503 }) })

    await startSync('frank@ajou.ac.kr')
    markRead(1)

    expect(isRead(1)).toBe(true)
  })
})
