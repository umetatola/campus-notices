import type { ReactNode } from 'react'
import { Link } from 'react-router'

/**
 * Renders the small Markdown subset the AI is asked to write: paragraphs, "- " bullets, **bold** and links.
 * Builds React elements (never HTML strings), so model output can't inject markup. Links to /notices/N stay in
 * the app; http(s) links open in a new tab; anything else is shown as plain text.
 */
export default function AnswerText({ text }: { text: string }) {
  const blocks: ReactNode[] = []
  let bullets: string[] = []
  let paragraph: string[] = []

  const flushParagraph = () => {
    if (paragraph.length) {
      blocks.push(<p key={blocks.length}>{inline(paragraph.join(' '))}</p>)
      paragraph = []
    }
  }
  const flushBullets = () => {
    if (bullets.length) {
      blocks.push(
        <ul key={blocks.length} className="space-y-1.5 pl-1">
          {bullets.map((b, i) => (
            <li key={i} className="flex gap-2.5">
              <span className="mt-[0.6em] size-1.5 shrink-0 rounded-full bg-accent" aria-hidden="true" />
              <span>{inline(b)}</span>
            </li>
          ))}
        </ul>,
      )
      bullets = []
    }
  }

  for (const raw of text.split('\n')) {
    const line = raw.trim()
    const bullet = /^[-*•]\s+(.*)$/.exec(line) ?? /^\d+[.)]\s+(.*)$/.exec(line)
    if (!line) {
      flushParagraph()
      flushBullets()
    } else if (bullet) {
      flushParagraph()
      bullets.push(bullet[1])
    } else {
      flushBullets()
      // headings aren't asked for, but if one slips through show it as a bold line
      const heading = /^#{1,6}\s+(.*)$/.exec(line)
      paragraph.push(heading ? `**${heading[1]}**` : line)
    }
  }
  flushParagraph()
  flushBullets()
  return <div className="space-y-3 leading-relaxed">{blocks}</div>
}

const TOKEN = /\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*/g

function inline(text: string): ReactNode[] {
  const out: ReactNode[] = []
  let last = 0
  for (const m of text.matchAll(TOKEN)) {
    if (m.index > last) out.push(text.slice(last, m.index))
    const key = out.length
    if (m[3] !== undefined) {
      out.push(
        <strong key={key} className="font-semibold text-ink">
          {m[3]}
        </strong>,
      )
    } else {
      const [label, href] = [m[1], m[2]]
      const notice = /^\/notices\/(\d+)$/.exec(href)
      if (notice) {
        out.push(
          <Link key={key} to={href} className="font-medium text-accent underline decoration-accent/30 underline-offset-2 hover:decoration-accent">
            {label}
          </Link>,
        )
      } else if (/^https?:\/\//.test(href)) {
        out.push(
          <a key={key} href={href} target="_blank" rel="noreferrer" className="text-accent underline underline-offset-2">
            {label}
          </a>,
        )
      } else {
        out.push(label)
      }
    }
    last = m.index + m[0].length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}
