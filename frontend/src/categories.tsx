import type { CSSProperties, ReactNode } from 'react'

// One colour and one small icon per board category, so a list can be scanned by colour.
// Keys are the board's own Korean names (see labels.ts for the English ones).
interface CategoryStyle {
  hue: string
  icon: ReactNode
}

export const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

const STYLES: Record<string, CategoryStyle> = {
  학사: {
    hue: '#4f6bed',
    icon: (
      <>
        <path d="M2 7.5 12 3l10 4.5-10 4.5z" />
        <path d="M6 9.5V15c0 1.5 2.7 3 6 3s6-1.5 6-3V9.5" />
      </>
    ),
  },
  장학: {
    hue: '#d08a10',
    icon: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M14.8 9.2c-.5-.8-1.5-1.3-2.8-1.3-1.7 0-2.8.8-2.8 2s1.1 1.7 2.8 2.1 2.8.9 2.8 2.1-1.1 2-2.8 2c-1.3 0-2.4-.5-2.9-1.4M12 6.5v11" />
      </>
    ),
  },
  취업: {
    hue: '#0e8fb0',
    icon: (
      <>
        <rect x="3" y="7.5" width="18" height="12.5" rx="2.5" />
        <path d="M8.5 7.5V6a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v1.5M3 13h18" />
      </>
    ),
  },
  행사: {
    hue: '#e0457b',
    icon: (
      <>
        <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
        <path d="M3.5 10h17M8 3v4M16 3v4" />
        <path d="m12 12.6.9 1.8 2 .3-1.45 1.4.35 2-1.8-.95-1.8.95.35-2-1.45-1.4 2-.3z" />
      </>
    ),
  },
  비교과: {
    hue: '#8b5cf6',
    icon: <path d="M12 3.5l2.5 5.3 5.8.7-4.3 4 1.1 5.7L12 16.4l-5.1 2.8L8 13.5l-4.3-4 5.8-.7z" />,
  },
  사무: {
    hue: '#5b7083',
    icon: (
      <>
        <rect x="5" y="4" width="14" height="17" rx="2.5" />
        <path d="M9 4.5V3.5h6v1M8.5 10h7M8.5 13.5h7M8.5 17h4" />
      </>
    ),
  },
}

const FALLBACK: CategoryStyle = {
  hue: '#7a8494',
  icon: (
    <>
      <circle cx="6.5" cy="12" r="1.3" />
      <circle cx="12" cy="12" r="1.3" />
      <circle cx="17.5" cy="12" r="1.3" />
    </>
  ),
}

export function categoryStyle(category: string | null): CategoryStyle {
  return (category && STYLES[category]) || FALLBACK
}

/** Inline style that sets --c, the category colour, for the .cat-* classes in index.css. */
export function categoryVars(category: string | null): CSSProperties {
  return { '--c': categoryStyle(category).hue } as CSSProperties
}

/** The board lists "Other" first; put it last so the real categories lead. */
export function sortCategories(categories: string[]): string[] {
  const known = Object.keys(STYLES)
  const rank = (c: string) => {
    const i = known.indexOf(c)
    return i === -1 ? known.length : i
  }
  return [...categories].sort((a, b) => rank(a) - rank(b))
}
