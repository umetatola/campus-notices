import type { ReactNode } from 'react'

const ICONS = {
  deadlines: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M3.5 10h17M8 3v4M16 3v4M8 14h3" />
    </>
  ),
  saved: <path d="M6.5 3.5h11a1 1 0 0 1 1 1V21l-6.5-4.5L5.5 21V4.5a1 1 0 0 1 1-1z" />,
  alerts: (
    <>
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </>
  ),
}

const TONES = {
  deadlines: 'bg-due-soft text-due',
  saved: 'bg-pin-soft text-pin',
  alerts: 'bg-accent-soft text-accent',
}

/** Title row shared by the inner pages: a coloured icon tile, the heading and an optional intro. */
export function PageHeader({ icon, title, children }: { icon: keyof typeof ICONS; title: string; children?: ReactNode }) {
  return (
    <div className="flex items-start gap-3.5">
      <span className={`grid size-11 shrink-0 place-items-center rounded-2xl ${TONES[icon]}`}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="size-5" aria-hidden="true">
          {ICONS[icon]}
        </svg>
      </span>
      <div className="min-w-0 space-y-1.5 pt-0.5">
        <h1 className="text-[1.65rem] leading-tight font-semibold tracking-tight">{title}</h1>
        {children && <div className="text-ink-2">{children}</div>}
      </div>
    </div>
  )
}
