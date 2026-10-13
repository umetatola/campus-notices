import { translate, type Lang } from './i18n'

// The board's own categories are Korean; show an English name next to them.
const CATEGORY_NAMES: Record<string, string> = {
  학사: 'Academic',
  장학: 'Scholarships',
  취업: 'Careers',
  행사: 'Events',
  비교과: 'Extracurricular',
  사무: 'Administration',
  기타: 'Other',
}

export function categoryName(category: string | null, lang: Lang = 'en'): string {
  if (!category) return lang === 'ko' ? '미분류' : 'Uncategorized'
  return lang === 'ko' ? category : (CATEGORY_NAMES[category] ?? category)
}

const longDate = {
  en: new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }),
  ko: new Intl.DateTimeFormat('ko', { month: 'long', day: 'numeric', year: 'numeric' }),
}
const shortDate = {
  en: new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }),
  ko: new Intl.DateTimeFormat('ko', { month: 'long', day: 'numeric' }),
}

/** "Today", "Yesterday", or a short date. Dates come as yyyy-MM-dd in Korean time. */
export function postedLabel(isoDate: string, now = new Date(), lang: Lang = 'en'): string {
  const today = kstDate(now)
  const yesterday = kstDate(new Date(now.getTime() - 86_400_000))
  if (isoDate === today) return translate(lang, 'date.today')
  if (isoDate === yesterday) return translate(lang, 'date.yesterday')
  return longDate[lang].format(localDate(isoDate))
}

/** "Due today", "Due tomorrow", "Due Oct 6", or null once the date has passed. */
export function dueLabel(isoDate: string | null, now = new Date(), lang: Lang = 'en'): string | null {
  if (!isoDate) return null
  const today = kstDate(now)
  if (isoDate < today) return null
  if (isoDate === today) return translate(lang, 'due.today')
  if (isoDate === kstDate(new Date(now.getTime() + 86_400_000))) return translate(lang, 'due.tomorrow')
  return translate(lang, 'due.date', { date: shortDate[lang].format(localDate(isoDate)) })
}

/** "5 minutes ago", "2 hours ago", "5분 전", from an ISO timestamp. */
export function timeAgo(isoInstant: string, now = new Date(), lang: Lang = 'en'): string {
  const seconds = Math.max(0, Math.round((now.getTime() - new Date(isoInstant).getTime()) / 1000))
  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' })
  if (seconds < 60) return rtf.format(0, 'second')
  if (seconds < 3600) return rtf.format(-Math.floor(seconds / 60), 'minute')
  if (seconds < 86_400) return rtf.format(-Math.floor(seconds / 3600), 'hour')
  return rtf.format(-Math.floor(seconds / 86_400), 'day')
}

function localDate(isoDate: string): Date {
  const [y, m, d] = isoDate.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function kstDate(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(d) // en-CA gives yyyy-MM-dd
}
