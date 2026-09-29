import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router'
import DOMPurify from 'dompurify'
import { ApiError, fetchNotice, type Summary } from '../api'
import { categoryName, dueLabel, postedLabel } from '../labels'
import NotFoundPage from './NotFoundPage'

export default function NoticeDetailPage() {
  const { id } = useParams()
  const noticeId = Number(id)
  const navigate = useNavigate()
  const notice = useQuery({
    queryKey: ['notice', noticeId],
    queryFn: () => fetchNotice(noticeId),
    enabled: Number.isInteger(noticeId),
  })

  const rawHtml = notice.data?.bodyHtml
  const bodyHtml = useMemo(() => (rawHtml ? DOMPurify.sanitize(rawHtml) : null), [rawHtml])
  const hasImages = bodyHtml?.includes('<img') ?? false

  // go back to the list the user came from (keeps their search), or to the start page on a direct visit
  const back = () => (window.history.state?.idx > 0 ? navigate(-1) : navigate('/'))

  if (!Number.isInteger(noticeId) || (notice.error instanceof ApiError && notice.error.status === 404)) {
    return <NotFoundPage />
  }

  return (
    <article className="space-y-6">
      <button onClick={back} className="text-sm text-accent hover:underline">
        ← All notices
      </button>

      {notice.isPending ? (
        <div className="space-y-3" aria-label="Loading notice">
          <div className="h-7 w-5/6 animate-pulse rounded bg-line" />
          <div className="h-4 w-1/3 animate-pulse rounded bg-line" />
          <div className="h-40 animate-pulse rounded-lg bg-line" />
        </div>
      ) : notice.isError ? (
        <div className="rounded-lg border border-line bg-surface p-6 text-center">
          <p className="font-medium">Couldn't load this notice.</p>
          <button onClick={() => notice.refetch()} className="mt-3 text-sm text-accent underline">
            Try again
          </button>
        </div>
      ) : (
        <>
          <header className="space-y-2">
            {notice.data.summary.titleEn ? (
              <>
                <h1 className="text-2xl leading-snug font-semibold text-balance">{notice.data.summary.titleEn}</h1>
                <p lang="ko" className="leading-snug text-ink-2">
                  {notice.data.title}
                </p>
              </>
            ) : (
              <h1 lang="ko" className="text-2xl leading-snug font-semibold text-balance">
                {notice.data.title}
              </h1>
            )}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
              <span className="text-accent">{categoryName(notice.data.category)}</span>
              {notice.data.department && (
                <>
                  <span aria-hidden>·</span>
                  <span>{notice.data.department}</span>
                </>
              )}
              <span aria-hidden>·</span>
              <time dateTime={notice.data.postedOn}>Posted {postedLabel(notice.data.postedOn)}</time>
            </div>
            <a
              href={notice.data.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-sm text-accent hover:underline"
            >
              Open the original on ajou.ac.kr ↗
            </a>
          </header>

          <SummaryCard summary={notice.data.summary} />

          {notice.data.attachments.length > 0 && (
            <section className="rounded-lg border border-line bg-surface p-4">
              <h2 className="text-sm font-semibold text-ink-2">
                Attachments ({notice.data.attachments.length})
              </h2>
              <ul className="mt-2 space-y-1.5">
                {notice.data.attachments.map((a) => (
                  <li key={a.url}>
                    <a
                      href={a.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="break-all text-sm text-accent hover:underline"
                    >
                      {a.name}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {!notice.data.bodyText && (
            <p className="rounded-lg bg-accent-soft px-4 py-3 text-sm text-ink-2">
              {hasImages
                ? 'This notice is published as images, shown below.'
                : 'This notice has no text of its own. The details are in the attachments above.'}
            </p>
          )}

          {bodyHtml && (
            <div
              className="notice-body rounded-lg border border-line bg-surface p-5"
              dangerouslySetInnerHTML={{ __html: bodyHtml }}
            />
          )}
        </>
      )}
    </article>
  )
}

function SummaryCard({ summary }: { summary: Summary }) {
  if (summary.status !== 'DONE') {
    return (
      <p className="rounded-lg border border-dashed border-line px-4 py-3 text-sm text-ink-2">
        {summary.status === 'FAILED'
          ? "We couldn't write an English summary for this notice. The original is below."
          : 'English summary coming soon. The original notice is below.'}
      </p>
    )
  }
  const due = dueLabel(summary.deadline)
  return (
    <section className="space-y-3 rounded-lg border border-line bg-surface p-5" aria-labelledby="summary-heading">
      <h2 id="summary-heading" className="text-sm font-semibold tracking-wide text-accent uppercase">
        In English
      </h2>
      <p className="leading-relaxed">{summary.summaryEn}</p>
      {summary.deadline && (
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <span
            className={`rounded px-1.5 py-0.5 text-xs font-medium ${due ? 'bg-due-soft text-due' : 'bg-line text-ink-2'}`}
          >
            {due ?? 'Deadline passed'}
          </span>
          <span className="text-ink-2">
            {formatDate(summary.deadline)}
            {summary.deadlineNote && ` · ${summary.deadlineNote}`}
          </span>
        </p>
      )}
      <p className="text-xs text-muted">
        Written by AI from the Korean notice. Check the original for official details.
      </p>
    </section>
  )
}

const longDate = new Intl.DateTimeFormat('en', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })

function formatDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  return longDate.format(new Date(y, m - 1, d))
}
