import { useState } from 'react'
import type { NoticeItem } from '../api'
import { useI18n, type Lang } from '../i18n'
import { kstDate } from '../labels'
import { useEnglish } from '../translate'
import { NoticeRow } from './NoticeListPage'

const DAY_MS = 86_400_000
const SHOWN_PER_DAY = 2
const BLANK = 'min-h-14 border-b border-r border-line bg-bg/50 sm:min-h-24'

/**
 * Month grid of deadlines, from this month to the one holding the last day in range. Picking a day lists its
 * notices underneath; by default that is the month's first day with a deadline.
 */
export function DeadlineCalendar({ notices, days }: { notices: NoticeItem[]; days: number }) {
  const { lang, t } = useI18n()
  const [now] = useState(() => new Date())
  const today = kstDate(now)
  const months = monthsBetween(today.slice(0, 7), kstDate(new Date(now.getTime() + (days - 1) * DAY_MS)).slice(0, 7))
  const [monthIndex, setMonthIndex] = useState(0)
  const [picked, setPicked] = useState<string | null>(null)

  const byDate = new Map<string, NoticeItem[]>()
  for (const n of notices) {
    if (n.deadline) byDate.set(n.deadline, [...(byDate.get(n.deadline) ?? []), n])
  }
  const month = months[monthIndex]
  const datesInMonth = [...byDate.keys()].filter((d) => d.startsWith(month)).sort()
  const selected = picked?.startsWith(month) && byDate.has(picked) ? picked : (datesInMonth[0] ?? null)

  const [year, monthNumber] = month.split('-').map(Number)
  const leadingBlanks = new Date(year, monthNumber - 1, 1).getDay()
  const daysInMonth = new Date(year, monthNumber, 0).getDate()

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-lg border border-line bg-surface">
        <div className="flex items-center justify-between border-b border-line px-3 py-2">
          <MonthButton
            label={t('calendar.prev')}
            disabled={monthIndex === 0}
            onClick={() => setMonthIndex(monthIndex - 1)}
            arrow="‹"
          />
          <h2 className="font-semibold" aria-live="polite">
            {new Intl.DateTimeFormat(lang, { year: 'numeric', month: 'long' }).format(new Date(year, monthNumber - 1, 1))}
          </h2>
          <MonthButton
            label={t('calendar.next')}
            disabled={monthIndex === months.length - 1}
            onClick={() => setMonthIndex(monthIndex + 1)}
            arrow="›"
          />
        </div>
        <div className="grid grid-cols-7 border-b border-line text-center text-xs font-medium text-muted">
          {weekdayNames(lang).map((name) => (
            <div key={name} className="py-1.5">
              {name}
            </div>
          ))}
        </div>
        {/* -mb-px tucks the last row's bottom border under the frame; every 7th cell drops its right border */}
        <div className="-mb-px grid grid-cols-7 [&>*:nth-child(7n)]:border-r-0">
          {Array.from({ length: leadingBlanks }, (_, i) => (
            <div key={`blank-${i}`} className={BLANK} />
          ))}
          {Array.from({ length: daysInMonth }, (_, i) => {
            const date = `${month}-${String(i + 1).padStart(2, '0')}`
            return (
              <DayCell
                key={date}
                date={date}
                day={i + 1}
                notices={byDate.get(date) ?? []}
                isToday={date === today}
                isPast={date < today}
                selected={date === selected}
                onPick={() => setPicked(date)}
              />
            )
          })}
          {Array.from({ length: (7 - ((leadingBlanks + daysInMonth) % 7)) % 7 }, (_, i) => (
            <div key={`trail-${i}`} className={BLANK} />
          ))}
        </div>
      </div>

      {selected ? (
        <section className="space-y-2" aria-label={t('calendar.dueOn', { date: longDate(selected, lang) })}>
          <h3 className="font-medium text-ink-2">{t('calendar.dueOn', { date: longDate(selected, lang) })}</h3>
          <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
            {(byDate.get(selected) ?? []).map((n) => (
              <NoticeRow key={n.id} notice={n} />
            ))}
          </ul>
        </section>
      ) : (
        <p className="rounded-lg border border-dashed border-line px-4 py-8 text-center text-ink-2">
          {t('calendar.noneThisMonth')}
        </p>
      )}
    </div>
  )
}

function DayCell(props: {
  date: string
  day: number
  notices: NoticeItem[]
  isToday: boolean
  isPast: boolean
  selected: boolean
  onPick: () => void
}) {
  const { lang, t } = useI18n()
  const count = props.notices.length
  const base = 'min-h-14 border-b border-r border-line p-1 text-left sm:min-h-24 sm:p-1.5'
  const number = (
    <span
      className={`inline-flex size-6 items-center justify-center rounded-full text-xs ${
        props.isToday ? 'bg-accent font-semibold text-surface' : props.isPast ? 'text-muted' : 'text-ink'
      }`}
    >
      {props.day}
    </span>
  )
  if (count === 0) {
    return <div className={`${base} ${props.isPast ? 'bg-bg/50' : ''}`}>{number}</div>
  }
  return (
    <button
      onClick={props.onPick}
      aria-pressed={props.selected}
      aria-label={`${longDate(props.date, lang)}: ${t('calendar.count', { count })}`}
      className={`${base} flex flex-col gap-1 transition-colors hover:bg-accent-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/40 ${
        props.selected ? 'bg-accent-soft ring-2 ring-inset ring-accent' : ''
      }`}
    >
      <span className="flex items-center justify-between">
        {number}
        <span className="rounded-full bg-due px-1.5 text-xs font-semibold text-surface sm:hidden">{count}</span>
      </span>
      {props.notices.slice(0, SHOWN_PER_DAY).map((n) => (
        <CellTitle key={n.id} notice={n} />
      ))}
      {count > SHOWN_PER_DAY && (
        <span className="hidden px-1 text-xs text-muted sm:block">
          {t('calendar.more', { count: count - SHOWN_PER_DAY })}
        </span>
      )}
    </button>
  )
}

function CellTitle({ notice }: { notice: NoticeItem }) {
  const { lang } = useI18n()
  const machineTitle = useEnglish(notice.titleEn ? null : notice.title)
  const english = notice.titleEn ?? machineTitle
  const showEnglish = lang === 'en' && !!english
  return (
    <span
      lang={showEnglish ? 'en' : 'ko'}
      className="hidden truncate rounded bg-due-soft px-1 text-xs leading-5 text-due sm:block"
    >
      {showEnglish ? english : notice.title}
    </span>
  )
}

function MonthButton(props: { label: string; arrow: string; disabled: boolean; onClick: () => void }) {
  return (
    <button
      onClick={props.onClick}
      disabled={props.disabled}
      aria-label={props.label}
      className="size-8 rounded-full text-lg text-ink-2 transition-colors hover:bg-bg hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:opacity-30 disabled:hover:bg-transparent"
    >
      <span aria-hidden>{props.arrow}</span>
    </button>
  )
}

/** 'yyyy-MM' months from `first` to `last`, both included. */
function monthsBetween(first: string, last: string): string[] {
  const months: string[] = []
  let [y, m] = first.split('-').map(Number)
  for (let month = first; month <= last; month = `${y}-${String(m).padStart(2, '0')}`) {
    months.push(month)
    m = m === 12 ? 1 : m + 1
    if (m === 1) y++
  }
  return months
}

/** Sunday-first short weekday names; 2023-01-01 was a Sunday. */
function weekdayNames(lang: Lang): string[] {
  const format = new Intl.DateTimeFormat(lang, { weekday: 'short' })
  return Array.from({ length: 7 }, (_, i) => format.format(new Date(2023, 0, 1 + i)))
}

function longDate(isoDate: string, lang: Lang): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  return new Intl.DateTimeFormat(lang, { month: 'long', day: 'numeric', weekday: 'long' }).format(new Date(y, m - 1, d))
}
