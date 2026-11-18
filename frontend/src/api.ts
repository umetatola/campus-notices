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
async function send<T>(method: 'POST' | 'PUT' | 'DELETE', path: string, body?: unknown): Promise<T | null> {
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

// ---- AI mode ----

export interface AskStatus {
  enabled: boolean
  model: string | null
}

export function fetchAskStatus() {
  return getJson<AskStatus>('/api/ask/status')
}

export interface AskSource {
  id: number
  title: string
  titleEn: string | null
  department: string | null
  postedOn: string
  deadline: string | null
}

export type AskEvent =
  | { type: 'step'; kind: 'search' | 'read'; detail: string }
  | { type: 'answer'; text: string; sources: AskSource[]; model: string }
  | { type: 'error'; message: string }

export interface AskTurn {
  question: string
  answer: string
}

/** Asks the AI; each search, notice read and the final answer arrive through `onEvent` (server-sent events). */
export async function ask(question: string, history: AskTurn[], onEvent: (e: AskEvent) => void, signal?: AbortSignal) {
  if (!readCookie('XSRF-TOKEN')) {
    await fetch('/api/csrf')
  }
  const res = await fetch('/api/ask', {
    method: 'POST',
    headers: {
      Accept: 'text/event-stream',
      'Content-Type': 'application/json',
      'X-XSRF-TOKEN': readCookie('XSRF-TOKEN') ?? '',
    },
    body: JSON.stringify({ question, history }),
    signal,
  })
  if (!res.ok || !res.body) throw await failure(res)

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader()
  let buffer = ''
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += value.replace(/\r\n/g, '\n')
    // events are separated by a blank line: "event: step\ndata: {...}\n\n"
    let end
    while ((end = buffer.indexOf('\n\n')) >= 0) {
      const raw = buffer.slice(0, end)
      buffer = buffer.slice(end + 2)
      let name = 'message'
      const data: string[] = []
      for (const line of raw.split('\n')) {
        if (line.startsWith('event:')) name = line.slice(6).trim()
        else if (line.startsWith('data:')) data.push(line.slice(5).replace(/^ /, ''))
      }
      if (!data.length) continue
      const payload = JSON.parse(data.join('\n'))
      if (name === 'step' || name === 'answer' || name === 'error') onEvent({ type: name, ...payload })
    }
  }
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

/** Notices due today or in the next `days` days, soonest first. */
export function fetchDeadlines(days = 14) {
  return getJson<NoticeItem[]>(`/api/notices/deadlines?days=${days}`)
}

/** The latest other notices from the same department (at most 5). */
export function fetchMoreFromDepartment(id: number) {
  return getJson<NoticeItem[]>(`/api/notices/${id}/more-from-department`)
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

export interface KeywordPreview {
  keyword: string
  days: number
  count: number
  examples: { id: number; title: string; titleEn: string | null; postedOn: string }[]
}

/** How many recent notices a keyword would have matched (same rule as real alerts). */
export function previewKeyword(keyword: string) {
  return getJson<KeywordPreview>(`/api/subscriptions/preview?${new URLSearchParams({ keyword })}`)
}

/** Saved notices, most recently saved first. */
export function fetchBookmarks() {
  return getJson<NoticeItem[]>('/api/bookmarks')
}

export function saveBookmark(noticeId: number) {
  return send<void>('PUT', `/api/bookmarks/${noticeId}`)
}

export function removeBookmark(noticeId: number) {
  return send<void>('DELETE', `/api/bookmarks/${noticeId}`)
}

export type AlertFrequency = 'INSTANT' | 'DAILY'

export interface AlertStatus {
  paused: boolean
  frequency: AlertFrequency
}

/** Pauses alert emails; authorized by the token from the email link (works signed out). */
export function unsubscribe(token: string) {
  return send<void>('POST', `/api/alerts/unsubscribe?token=${encodeURIComponent(token)}`)
}

export function fetchAlertStatus() {
  return getJson<AlertStatus>('/api/alerts/status')
}

/** Instant emails, or one daily digest after 08:00 Korean time. */
export async function setAlertFrequency(frequency: AlertFrequency): Promise<AlertStatus> {
  return (await send<AlertStatus>('PUT', '/api/alerts/frequency', { frequency }))!
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

/** Desktop app only (404 on the website). `summariesOn` is what the running app does; it follows the key after a restart. */
export interface DesktopSettings {
  apiKeySet: boolean
  apiKeyHint: string | null
  summariesOn: boolean
  /** False when Windows offers no tray icon to quit from. */
  backgroundAvailable: boolean
  keepRunning: boolean
  startedAt: string
}

export function fetchDesktopSettings() {
  return getJson<DesktopSettings>('/api/desktop/settings')
}

/** An empty key removes it. */
export async function saveApiKey(apiKey: string) {
  return (await send<DesktopSettings>('PUT', '/api/desktop/settings/api-key', { apiKey }))!
}

/** Applies at once, no restart needed. */
export async function setKeepRunning(enabled: boolean) {
  return (await send<DesktopSettings>('PUT', '/api/desktop/settings/keep-running', { enabled }))!
}

/** Desktop app only: machine translation of Korean notice text, same order as `texts`. */
export async function translateTexts(texts: string[]) {
  return (await send<{ translations: string[] }>('POST', '/api/desktop/translate', { texts }))!.translations
}

export async function restartApp() {
  await send('POST', '/api/desktop/restart')
}
