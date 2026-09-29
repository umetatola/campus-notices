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

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(path, { headers: { Accept: 'application/json' } })
  if (!res.ok) {
    throw new ApiError(res.status, `Request failed (${res.status})`)
  }
  return res.json() as Promise<T>
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
