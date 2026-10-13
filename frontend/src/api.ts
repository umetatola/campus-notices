export interface PageResponse<T> {
  items: T[]
  page: number
  size: number
  totalItems: number
  totalPages: number
}

export interface NoticeItem {
  id: number
  title: string
  titleEn: string | null // null until the English summary is written
  category: string | null
  department: string | null
  postedOn: string // yyyy-MM-dd
  deadline: string | null // yyyy-MM-dd
  pinned: boolean
  sourceUrl: string
  editedAt: string | null // set when the university changed the notice after it was first posted
}

export type SummaryStatus = 'PENDING' | 'RUNNING' | 'DONE' | 'FAILED'

export interface Summary {
  status: SummaryStatus
  titleEn: string | null
  summaryEn: string | null
  deadline: string | null
  deadlineNote: string | null
}

export interface Attachment {
  name: string
  url: string
}

export interface NoticeDetail extends Omit<NoticeItem, 'titleEn' | 'deadline'> {
  summary: Summary
  bodyHtml: string | null
  bodyText: string | null
  attachments: Attachment[]
  firstSeenAt: string
  updatedAt: string
}

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function failure(res: Response): Promise<ApiError> {
  // Spring answers with RFC 9457 problem details; "detail" is the human-readable reason
  let message = `Request failed (${res.status})`
  try {
    const body = await res.json()
    if (typeof body?.detail === 'string' && body.detail) message = body.detail
  } catch {
    // not JSON; keep the generic message
  }
  return new ApiError(res.status, message)
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(path, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw await failure(res)
  return res.json() as Promise<T>
}

function readCookie(name: string): string | null {
  const match = document.cookie.split('; ').find((c) => c.startsWith(`${name}=`))
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null
}

/** Writes carry the CSRF token from the XSRF-TOKEN cookie; the first write fetches the cookie. */
async function send<T>(method: 'POST' | 'DELETE', path: string, body?: unknown): Promise<T | null> {
  if (!readCookie('XSRF-TOKEN')) {
    await fetch('/api/csrf')
  }
  const res = await fetch(path, {
    method,
    headers: {
      Accept: 'application/json',
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      'X-XSRF-TOKEN': readCookie('XSRF-TOKEN') ?? '',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!res.ok) throw await failure(res)
  const text = await res.text()
  return text ? (JSON.parse(text) as T) : null
}

export interface NoticeQuery {
  q?: string
  category?: string
  page?: number
  size?: number
}

export function fetchNotices({ q, category, page = 0, size = 20 }: NoticeQuery) {
  const params = new URLSearchParams({ page: String(page), size: String(size) })
  if (q) params.set('q', q)
  if (category) params.set('category', category)
  return getJson<PageResponse<NoticeItem>>(`/api/notices?${params}`)
}

export function fetchNotice(id: number) {
  return getJson<NoticeDetail>(`/api/notices/${id}`)
}

export function fetchCategories() {
  return getJson<string[]>('/api/notices/categories')
}

export interface Me {
  email: string
}

/** The signed-in user, or null. */
export async function fetchMe(): Promise<Me | null> {
  const res = await fetch('/api/me', { headers: { Accept: 'application/json' } })
  if (res.status === 401) return null
  if (!res.ok) throw await failure(res)
  return res.json() as Promise<Me>
}

export function requestSignInLink(email: string) {
  return send<void>('POST', '/api/auth/request-link', { email })
}

export async function verifySignIn(token: string): Promise<Me> {
  return (await send<Me>('POST', '/api/auth/verify', { token }))!
}

export function signOut() {
  return send<void>('POST', '/api/auth/logout')
}

export interface Subscription {
  id: number
  keyword: string
  createdAt: string
}

export function fetchSubscriptions() {
  return getJson<Subscription[]>('/api/subscriptions')
}

export async function addSubscription(keyword: string): Promise<Subscription> {
  return (await send<Subscription>('POST', '/api/subscriptions', { keyword }))!
}

export function removeSubscription(id: number) {
  return send<void>('DELETE', `/api/subscriptions/${id}`)
}

export interface AlertStatus {
  paused: boolean
}

/** Pauses alert emails; authorized by the token from the email link (works signed out). */
export function unsubscribe(token: string) {
  return send<void>('POST', `/api/alerts/unsubscribe?token=${encodeURIComponent(token)}`)
}

export function fetchAlertStatus() {
  return getJson<AlertStatus>('/api/alerts/status')
}

export async function resumeAlerts(): Promise<AlertStatus> {
  return (await send<AlertStatus>('POST', '/api/alerts/resume'))!
}

export interface SiteStatus {
  lastUpdatedAt: string | null
  updatesDelayed: boolean
}

export function fetchStatus() {
  return getJson<SiteStatus>('/api/status')
}
