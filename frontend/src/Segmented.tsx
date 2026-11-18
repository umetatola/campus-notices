/** A row of mutually exclusive options that looks like one pill (iOS-style segmented control). */
export function Segmented<T extends string | number>(props: {
  label: string
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <div role="group" aria-label={props.label} className="inline-flex rounded-full border border-line bg-surface/80 p-1 shadow-sm">
      {props.options.map((o) => {
        const selected = o.value === props.value
        return (
          <button
            key={String(o.value)}
            type="button"
            aria-pressed={selected}
            onClick={() => props.onChange(o.value)}
            className={`rounded-full px-3.5 py-1.5 text-sm whitespace-nowrap transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${
              selected ? 'btn-primary font-medium' : 'text-ink-2 hover:text-ink'
            }`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
