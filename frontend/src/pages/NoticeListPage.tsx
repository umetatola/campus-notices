import { useEffect, useEffectEvent, useRef, useState, type CSSProperties } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router'
import Highlight from '../Highlight'
import { fetchCategories, fetchNotices, fetchStatus, type NoticeItem } from '../api'
import { categoryName, dueLabel, kstDate, postedLabel, timeAgo } from '../labels'
import { categoryVars, sortCategories } from '../categories'
import { CategoryIcon } from '../CategoryIcon'
import { useI18n } from '../i18n'
import { useEnglish } from '../translate'

const PAGE_SIZE = 20

export default function NoticeListPage() {
  // Search, category and page live in the URL, so every view can be shared or bookmarked.
  const [params, setParams] = useSearchParams()
  const { lang, t } = useI18n()
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
  const status = useQuery({ queryKey: ['status'], queryFn: fetchStatus, refetchInterval: 60_000 })
  // the big welcome only on the plain first page; a search or filter gets straight to the results
  const landing = !q && !category && page === 0

  return (
    <div className="space-y-5">
      {landing && (
        <section className="pt-2 pb-1 sm:pt-6">
          <h1 className="hero-title text-[1.9rem] leading-tight font-semibold tracking-tight sm:text-[2.6rem]">
            {t('home.title')}
          </h1>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-2 sm:text-base">{t('home.subtitle')}</p>
          {notices.data && (
            <p className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
              <span className="inline-flex items-center gap-2 font-medium text-ink">
                <span className="new-dot inline-block size-2 rounded-full" aria-hidden="true" />
                {t('home.stats', { n: notices.data.totalItems.toLocaleString(lang) })}
              </span>
              {status.data?.lastUpdatedAt && (
                <span>
                  {t('footer.updated', {
                    time: timeAgo(status.data.lastUpdatedAt, new Date(status.dataUpdatedAt), lang),
                  })}
                </span>
              )}
            </p>
          )}
        </section>
      )}

      <SearchBox value={q} onSearch={(value) => update({ q: value || null, page: null })} />

      <div
        className="chip-row -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0"
        role="group"
        aria-label={t('list.filterLabel')}
      >
        <CategoryChip label={t('list.all')} selected={!category} onClick={() => update({ category: null, page: null })} />
        {sortCategories(categories.data ?? []).map((c) => (
          <CategoryChip
            key={c}
            category={c}
            label={categoryName(c, lang)}
            sublabel={lang === 'ko' ? undefined : c}
            selected={category === c}
            onClick={() => update({ category: c, page: null })}
          />
        ))}
      </div>

      {notices.isPending ? (
        <ListSkeleton />
      ) : notices.isError ? (
        <div className="rounded-lg border border-line bg-surface p-6 text-center">
          <p className="font-medium">{t('list.loadError')}</p>
          <p className="mt-1 text-sm text-ink-2">{t('list.loadErrorHint')}</p>
          <button
            onClick={() => notices.refetch()}
            className="btn-primary mt-4 rounded-full px-5 py-2 text-sm font-medium"
          >
            {t('common.tryAgain')}
          </button>
        </div>
      ) : notices.data.items.length === 0 ? (
        <div className="rounded-lg border border-line bg-surface p-8 text-center">
          <p className="font-medium">{t('list.empty')}</p>
          <p className="mt-1 text-sm text-ink-2">{t('list.emptyHint')}</p>
        </div>
      ) : (
        <>
          <p className={landing ? 'sr-only' : 'text-sm text-muted'} aria-live="polite">
            {t(notices.data.totalItems === 1 ? 'list.count.one' : 'list.count.other', {
              n: notices.data.totalItems.toLocaleString(lang),
            })}
          </p>
          <ul
            className={`divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface ${
              notices.isPlaceholderData ? 'opacity-60' : ''
            }`}
          >
            {notices.data.items.map((n) => (
              <NoticeRow key={n.id} notice={n} query={q} />
            ))}
          </ul>
          <Pager
            page={notices.data.page}
            totalPages={notices.data.totalPages}
            onChange={(p) => update({ page: p === 0 ? null : String(p) })}
          />
          <a href={feedUrl(q, category)} className="inline-block text-sm text-muted hover:text-accent hover:underline">
            {t('list.feed')}
          </a>
        </>
      )}
    </div>
  )
}

/** The Atom feed for the current search and category. */
function feedUrl(q: string, category: string): string {
  const params = new URLSearchParams()
  if (q) params.set('q', q)
  if (category) params.set('category', category)
  const query = params.toString()
  return `/api/notices/feed.xml${query ? `?${query}` : ''}`
}

function SearchBox({ value, onSearch }: { value: string; onSearch: (value: string) => void }) {
  const { t } = useI18n()
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

  // "/" jumps to the search box from anywhere on the page, like on GitHub or YouTube
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return
      if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return
      e.preventDefault()
      input.current?.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="search-field flex items-center gap-3 px-4">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="size-5 shrink-0 text-muted" aria-hidden="true">
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <label htmlFor="search" className="sr-only">
        {t('list.searchLabel')}
      </label>
      <input
        ref={input}
        id="search"
        type="search"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t('list.searchPlaceholder')}
        className="min-w-0 flex-1 bg-transparent py-3.5 text-base text-ink placeholder:text-muted focus:outline-none"
      />
      {!text && (
        <kbd className="kbd hidden sm:inline-block" aria-hidden="true">
          /
        </kbd>
      )}
    </div>
  )
}

export function CategoryChip(props: {
  label: string
  sublabel?: string
  category?: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={props.onClick}
      aria-pressed={props.selected}
      style={props.category ? categoryVars(props.category) : ({ '--c': 'var(--accent)' } as CSSProperties)}
      className="cat-chip inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm whitespace-nowrap transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
    >
      {props.category ? (
        <CategoryIcon category={props.category} className="size-3.5" />
      ) : (
        <span className="cat-dot size-1.5 rounded-full" aria-hidden="true" />
      )}
      {props.label}
      {props.sublabel && props.sublabel !== props.label && (
        <span className={`text-xs ${props.selected ? 'opacity-80' : 'text-muted'}`}>{props.sublabel}</span>
      )}
    </button>
  )
}

export function NoticeRow({ notice, query }: { notice: NoticeItem; query?: string }) {
  const { lang, t } = useI18n()
  const due = dueLabel(notice.deadline, undefined, lang)
  // Claude's English title when there is one, otherwise a machine translation (English interface only)
  const machineTitle = useEnglish(notice.titleEn ? null : notice.title)
  const titleEn = notice.titleEn ?? machineTitle
  const department = useEnglish(notice.department) ?? notice.department
  // the reader's language first; the other one underneath
  const main = lang === 'ko' || !titleEn ? notice.title : titleEn
  const second = !titleEn ? null : lang === 'ko' ? titleEn : notice.title
  const [today] = useState(() => kstDate(new Date()))
  const isNew = notice.postedOn === today
  return (
    <li>
      <Link
        to={`/notices/${notice.id}`}
        style={categoryVars(notice.category)}
        className="notice-row flex items-start gap-3.5 px-4 py-4 transition-colors focus:outline-none focus-visible:bg-accent-soft/50 sm:px-5"
      >
        <span className="cat-tile mt-0.5 grid size-10 shrink-0 place-items-center rounded-xl" title={categoryName(notice.category, lang)}>
          <CategoryIcon category={notice.category} className="size-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            {notice.pinned && (
              <span className="mt-0.5 shrink-0 rounded-md bg-pin-soft px-1.5 py-0.5 text-xs font-medium text-pin">
                {t('list.pinned')}
              </span>
            )}
            <div className="min-w-0">
              <span lang={main === notice.title ? 'ko' : 'en'} className="font-medium leading-snug text-ink">
                <Highlight text={main} query={query} />
              </span>
              {second && (
                <span lang={second === notice.title ? 'ko' : 'en'} className="mt-0.5 block text-sm leading-snug text-ink-2">
                  <Highlight text={second} query={query} />
                </span>
              )}
            </div>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted">
            {due && (
              <span className="inline-flex items-center gap-1 rounded-md bg-due-soft px-1.5 py-0.5 text-xs font-medium text-due">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className="size-3" aria-hidden="true">
                  <circle cx="12" cy="13" r="8" />
                  <path d="M12 9v4l2.5 2M9 2.5h6" />
                </svg>
                {due}
              </span>
            )}
            {notice.editedAt && (
              <span className="rounded-md border border-line px-1.5 py-0.5 text-xs font-medium text-ink-2">
                {t('list.edited')}
              </span>
            )}
            <span className="cat-text font-medium">{categoryName(notice.category, lang)}</span>
            {department && (
              <>
                <span aria-hidden>·</span>
                <span lang={department === notice.department ? 'ko' : 'en'}>{department}</span>
              </>
            )}
            <span aria-hidden className="sm:hidden">
              ·
            </span>
            <time dateTime={notice.postedOn} className="sm:hidden">
              {postedLabel(notice.postedOn, undefined, lang)}
            </time>
          </div>
        </div>
        <div className="hidden shrink-0 flex-col items-end gap-1.5 pt-0.5 text-right sm:flex">
          <time dateTime={notice.postedOn} className="text-[13px] whitespace-nowrap text-muted">
            {postedLabel(notice.postedOn, undefined, lang)}
          </time>
          {isNew && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent">
              <span className="new-dot size-1.5 rounded-full" aria-hidden="true" />
              {t('list.new')}
            </span>
          )}
        </div>
      </Link>
    </li>
  )
}

function Pager({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (p: number) => void }) {
  const { t } = useI18n()
  if (totalPages <= 1) return null
  const button =
    'rounded-md border border-line bg-surface px-3 py-1.5 text-sm disabled:opacity-40 enabled:hover:border-accent'
  return (
    <nav className="flex items-center justify-between" aria-label={t('list.pages')}>
      <button className={button} disabled={page === 0} onClick={() => onChange(page - 1)}>
        {t('list.newer')}
      </button>
      <span className="text-sm text-muted">
        {t('list.pageOf', { page: page + 1, total: totalPages })}
      </span>
      <button className={button} disabled={page + 1 >= totalPages} onClick={() => onChange(page + 1)}>
        {t('list.older')}
      </button>
    </nav>
  )
}

function ListSkeleton() {
  const { t } = useI18n()
  return (
    <ul className="divide-y divide-line rounded-lg border border-line bg-surface" aria-label={t('list.loading')}>
      {Array.from({ length: 6 }, (_, i) => (
        <li key={i} className="space-y-2 px-4 py-4">
          <div className="h-4 w-3/4 animate-pulse rounded bg-line" />
          <div className="h-3 w-1/3 animate-pulse rounded bg-line" />
        </li>
      ))}
    </ul>
  )
}
