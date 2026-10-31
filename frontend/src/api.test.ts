import { beforeEach, describe, expect, it } from 'vitest'
import { ApiError, fetchMe, fetchNotices, removeBookmark, saveBookmark, setAlertFrequency } from './api'
import { json, mockApi } from './test/helpers'

const clearCookie = () => {
  document.cookie = 'XSRF-TOKEN=; expires=Thu, 01 Jan 1970 00:00:00 GMT'
}

describe('api', () => {
  beforeEach(clearCookie)

  it('builds the notice query and leaves out empty filters', async () => {
    const fetch = mockApi({ '/api/notices': () => json({ items: [], page: 0, size: 20, totalItems: 0, totalPages: 0 }) })
    await fetchNotices({ q: '장학', category: '', page: 2 })
    const url = new URL(String(fetch.mock.calls[0][0]), 'http://localhost')
    expect(Object.fromEntries(url.searchParams)).toEqual({ page: '2', size: '20', q: '장학' })
  })

  it('turns a problem-details response into an ApiError with its detail', async () => {
    mockApi({ '/api/notices': () => json({ detail: 'Too many requests' }, 429) })
    const error = await fetchNotices({}).catch((e) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 429, message: 'Too many requests' })
  })

  it('falls back to a generic message when the error body is not JSON', async () => {
    mockApi({ '/api/notices': () => new Response('<html>', { status: 502 }) })
    await expect(fetchNotices({})).rejects.toMatchObject({ status: 502, message: 'Request failed (502)' })
  })

  it('fetchMe returns null when signed out and throws on other errors', async () => {
    mockApi({ '/api/me': () => new Response(null, { status: 401 }) })
    expect(await fetchMe()).toBeNull()
    mockApi({ '/api/me': () => new Response(null, { status: 500 }) })
    await expect(fetchMe()).rejects.toMatchObject({ status: 500 })
  })

  it('fetches the CSRF cookie before the first write, then sends it back', async () => {
    const fetch = mockApi({
      '/api/csrf': () => {
        document.cookie = 'XSRF-TOKEN=tok%3D1'
        return new Response(null, { status: 204 })
      },
      '/api/bookmarks/7': () => new Response(null, { status: 204 }),
    })
    await saveBookmark(7)
    await removeBookmark(7)

    expect(fetch.mock.calls.map(([u]) => String(u))).toEqual(['/api/csrf', '/api/bookmarks/7', '/api/bookmarks/7'])
    const [, put] = fetch.mock.calls[1]
    expect(put?.method).toBe('PUT')
    expect((put!.headers as Record<string, string>)['X-XSRF-TOKEN']).toBe('tok=1')
    expect(put?.body).toBeUndefined()
  })

  it('sends JSON bodies and parses JSON replies', async () => {
    document.cookie = 'XSRF-TOKEN=t'
    const fetch = mockApi({ '/api/alerts/frequency': () => json({ paused: false, frequency: 'DAILY' }) })
    expect(await setAlertFrequency('DAILY')).toEqual({ paused: false, frequency: 'DAILY' })
    const [, init] = fetch.mock.calls[0]
    expect((init!.headers as Record<string, string>)['Content-Type']).toBe('application/json')
    expect(init?.body).toBe(JSON.stringify({ frequency: 'DAILY' }))
  })
})
