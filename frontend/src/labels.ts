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

export function categoryName(category: string | null): string {
  if (!category) return 'Uncategorized'
  return CATEGORY_NAMES[category] ?? category
}

const dateFormat = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' })

/** "Today", "Yesterday", or a short date. Dates come as yyyy-MM-dd in Korean time. */
export function postedLabel(isoDate: string, now = new Date()): string {
  const today = kstDate(now)
  const yesterday = kstDate(new Date(now.getTime() - 86_400_000))
  if (isoDate === today) return 'Today'
  if (isoDate === yesterday) return 'Yesterday'
  const [y, m, d] = isoDate.split('-').map(Number)
  return dateFormat.format(new Date(y, m - 1, d))
}

/** "Due today", "Due tomorrow", "Due Oct 6", or null once the date has passed. */
export function dueLabel(isoDate: string | null, now = new Date()): string | null {
  if (!isoDate) return null
  const today = kstDate(now)
  if (isoDate < today) return null
  if (isoDate === today) return 'Due today'
  if (isoDate === kstDate(new Date(now.getTime() + 86_400_000))) return 'Due tomorrow'
  const [y, m, d] = isoDate.split('-').map(Number)
  return `Due ${shortDate.format(new Date(y, m - 1, d))}`
}

const shortDate = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' })

function kstDate(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(d) // en-CA gives yyyy-MM-dd
}
