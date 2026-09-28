import { useEffect, useEffectEvent, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router'
import { fetchCategories, fetchNotices, type NoticeItem } from '../api'
import { categoryName, postedLabel } from '../labels'

const PAGE_SIZE = 20

export default function NoticeListPage() {
  // Search, category and page live in the URL, so every view can be shared or bookmarked.
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const category = params.get('category') ?? ''
  const page = Math.max(0, Number(params.get('page') ?? 0) || 0)

  const update = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params)
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value)
      else next.delete(key)
    }
    setParams(next)
  }

  const notices = useQuery({
    queryKey: ['notices', { q, category, page }],
    queryFn: () => fetchNotices({ q, category, page, size: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  })
  const categories = useQuery({ queryKey: ['categories'], queryFn: fetchCategories, staleTime: 10 * 60_000 })

  return (
    <div className="space-y-5">
      <SearchBox value={q} onSearch={(value) => update({ q: value || null, page: null })} />

      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by category">
        <CategoryChip label="All" selected={!category} onClick={() => update({ category: null, page: null })} />
        {categories.data?.map((c) => (
          <CategoryChip
            key={c}
            label={categoryName(c)}
            sublabel={c}
            selected={category === c}
            onClick={() => update({ category: c, page: null })}
          />
        ))}
      </div>

      {notices.isPending ? (
        <ListSkeleton />
      ) : notices.isError ? (
        <div className="rounded-lg border border-line bg-surface p-6 text-center">
          <p className="font-medium">Couldn't load notices.</p>
          <p className="mt-1 text-sm text-ink-2">Check your connection and try again.</p>
          <button
            onClick={() => notices.refetch()}
            className="mt-4 rounded-md bg-accent px-4 py-2 text-sm font-medium text-surface"
          >
            Try again
          </button>
        </div>
      ) : notices.data.items.length === 0 ? (
        <div className="rounded-lg border border-line bg-surface p-8 text-center">
          <p className="font-medium">No notices match.</p>
          <p className="mt-1 text-sm text-ink-2">Try a different word, or clear the category filter.</p>
        </div>
      ) : (
        <>
          <p className="text-sm text-muted" aria-live="polite">
            {notices.data.totalItems.toLocaleString('en')} notice{notices.data.totalItems === 1 ? '' : 's'}
          </p>
          <ul
            className={`divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface ${
              notices.isPlaceholderData ? 'opacity-60' : ''
            }`}
          >
            {notices.data.items.map((n) => (
              <NoticeRow key={n.id} notice={n} />
            ))}
          </ul>
          <Pager
            page={notices.data.page}
            totalPages={notices.data.totalPages}
            onChange={(p) => update({ page: p === 0 ? null : String(p) })}
          />
        </>
      )}
    </div>
  )
}

function SearchBox({ value, onSearch }: { value: string; onSearch: (value: string) => void }) {
  const [text, setText] = useState(value)
  const [lastValue, setLastValue] = useState(value)

  // follow the URL when it changes elsewhere (back button, a link)
  if (value !== lastValue) {
    setLastValue(value)
    setText(value)
  }

  const search = useEffectEvent((next: string) => onSearch(next))

  // search 300 ms after the user stops typing
  useEffect(() => {
    if (text.trim() === value) return
    const timer = setTimeout(() => search(text.trim()), 300)
    return () => clearTimeout(timer)
  }, [text, value])

  return (
    <div>
      <label htmlFor="search" className="sr-only">
        Search notice titles
      </label>
      <input
        id="search"
        type="search"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Search titles, e.g. 장학 or 기숙사"
        className="w-full rounded-lg border border-line bg-surface px-4 py-3 text-base text-ink placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
      />
    </div>
  )
}

function CategoryChip(props: { label: string; sublabel?: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={props.onClick}
      aria-pressed={props.selected}
      className={`rounded-full border px-3 py-1.5 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${
        props.selected
          ? 'border-accent bg-accent text-surface'
          : 'border-line bg-surface text-ink-2 hover:border-accent hover:text-ink'
      }`}
    >
      {props.label}
      {props.sublabel && props.sublabel !== props.label && (
        <span className={`ml-1.5 text-xs ${props.selected ? 'opacity-80' : 'text-muted'}`}>{props.sublabel}</span>
      )}
    </button>
  )
}

function NoticeRow({ notice }: { notice: NoticeItem }) {
  return (
    <li>
      <Link
        to={`/notices/${notice.id}`}
        className="block px-4 py-3.5 transition-colors hover:bg-bg focus:bg-bg focus:outline-none"
      >
        <div className="flex items-start gap-2">
          {notice.pinned && (
            <span className="mt-0.5 shrink-0 rounded bg-pin-soft px-1.5 py-0.5 text-xs font-medium text-pin">
              Pinned
            </span>
          )}
          <span className="font-medium leading-snug text-ink">{notice.title}</span>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
          <span className="text-accent">{categoryName(notice.category)}</span>
          {notice.department && (
            <>
              <span aria-hidden>·</span>
              <span>{notice.department}</span>
            </>
          )}
          <span aria-hidden>·</span>
          <time dateTime={notice.postedOn}>{postedLabel(notice.postedOn)}</time>
        </div>
      </Link>
    </li>
  )
}

function Pager({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (p: number) => void }) {
  if (totalPages <= 1) return null
  const button =
    'rounded-md border border-line bg-surface px-3 py-1.5 text-sm disabled:opacity-40 enabled:hover:border-accent'
  return (
    <nav className="flex items-center justify-between" aria-label="Pages">
      <button className={button} disabled={page === 0} onClick={() => onChange(page - 1)}>
        ← Newer
      </button>
      <span className="text-sm text-muted">
        Page {page + 1} of {totalPages}
      </span>
      <button className={button} disabled={page + 1 >= totalPages} onClick={() => onChange(page + 1)}>
        Older →
      </button>
    </nav>
  )
}

function ListSkeleton() {
  return (
    <ul className="divide-y divide-line rounded-lg border border-line bg-surface" aria-label="Loading notices">
      {Array.from({ length: 6 }, (_, i) => (
        <li key={i} className="space-y-2 px-4 py-4">
          <div className="h-4 w-3/4 animate-pulse rounded bg-line" />
          <div className="h-3 w-1/3 animate-pulse rounded bg-line" />
        </li>
      ))}
    </ul>
  )
}
