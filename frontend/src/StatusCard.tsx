import type { ReactNode } from 'react'

const ICONS = {
  empty: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5M8.5 11h5" />
    </>
  ),
  error: (
    <>
      <path d="M12 3.5 21.5 20h-19z" />
      <path d="M12 10v4M12 17h.01" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M3.5 10h17M8 3v4M16 3v4M9.5 15.5l5-3" />
    </>
  ),
}

/** The friendly box shown when a list is empty or could not load. */
export function StatusCard(props: {
  kind: keyof typeof ICONS
  title: string
  hint?: string
  action?: ReactNode
  alert?: boolean
}) {
  return (
    <div role={props.alert ? 'alert' : undefined} className="rounded-2xl border border-dashed border-line bg-surface/60 px-6 py-10 text-center">
      <span
        className={`mx-auto grid size-12 place-items-center rounded-2xl ${
          props.kind === 'error' ? 'bg-due-soft text-due' : 'bg-accent-soft text-accent'
        }`}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="size-6" aria-hidden="true">
          {ICONS[props.kind]}
        </svg>
      </span>
      <p className="mt-4 font-medium">{props.title}</p>
      {props.hint && <p className="mx-auto mt-1 max-w-sm text-sm text-ink-2">{props.hint}</p>}
      {props.action}
    </div>
  )
}
