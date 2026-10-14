/**
 * Marks every case-insensitive occurrence of `query` in `text`, the way the API's search matches (the whole
 * phrase). Renders text nodes only, so a notice title can never inject markup.
 */
export default function Highlight({ text, query }: { text: string; query?: string }) {
  const needle = query?.trim().toLowerCase()
  const haystack = text.toLowerCase()
  // a few characters change length when lowercased (e.g. "İ"); then indexes wouldn't line up, so don't mark
  if (!needle || haystack.length !== text.length) return <>{text}</>
  const parts: React.ReactNode[] = []
  let from = 0
  for (let at = haystack.indexOf(needle); at !== -1; at = haystack.indexOf(needle, from)) {
    if (at > from) parts.push(text.slice(from, at))
    parts.push(
      <mark key={at} className="rounded-sm bg-due-soft px-0.5 text-inherit">
        {text.slice(at, at + needle.length)}
      </mark>,
    )
    from = at + needle.length
  }
  if (from < text.length) parts.push(text.slice(from))
  return <>{parts}</>
}
