import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router'
import DOMPurify from 'dompurify'
import { ApiError, fetchNotice, type Summary } from '../api'
import { categoryName, dueLabel, postedLabel } from '../labels'
import NotFoundPage from './NotFoundPage'
import { translate, useI18n, type Lang } from '../i18n'

export default function NoticeDetailPage() {
  const { id } = useParams()
  const noticeId = Number(id)
  const navigate = useNavigate()
  const { lang, t } = useI18n()
  const notice = useQuery({
    queryKey: ['notice', noticeId],
    queryFn: () => fetchNotice(noticeId),
    enabled: Number.isInteger(noticeId),
  })

  const rawHtml = notice.data?.bodyHtml
  // Image-only notices are common and their images rarely have alt text; give each one a name for screen readers.
  const bodyHtml = useMemo(() => {
    if (!rawHtml) return null
    const body = DOMPurify.sanitize(rawHtml, { RETURN_DOM: true }) as HTMLElement
    const images = Array.from(body.querySelectorAll('img'))
    images.forEach((img, i) => {
      if (!img.getAttribute('alt')?.trim()) {
        img.setAttribute('alt', translate(lang, 'detail.imageAlt', { n: i + 1, total: images.length }))
      }
    })
    return body.innerHTML
  }, [rawHtml, lang])
  const hasImages = bodyHtml?.includes('<img') ?? false

  // go back to the list the user came from (keeps their search), or to the start page on a direct visit
  const back = () => (window.history.state?.idx > 0 ? navigate(-1) : navigate('/'))

  if (!Number.isInteger(noticeId) || (notice.error instanceof ApiError && notice.error.status === 404)) {
    return <NotFoundPage />
  }

  return (
    <article className="space-y-6">
      <button onClick={back} className="text-sm text-accent hover:underline">
        {t('detail.back')}
      </button>

      {notice.isPending ? (
        <div className="space-y-3" aria-label={t('detail.loading')}>
          <div className="h-7 w-5/6 animate-pulse rounded bg-line" />
          <div className="h-4 w-1/3 animate-pulse rounded bg-line" />
          <div className="h-40 animate-pulse rounded-lg bg-line" />
        </div>
      ) : notice.isError ? (
        <div className="rounded-lg border border-line bg-surface p-6 text-center">
          <p className="font-medium">{t('detail.loadError')}</p>
          <button onClick={() => notice.refetch()} className="mt-3 text-sm text-accent underline">
            {t('common.tryAgain')}
          </button>
        </div>
      ) : (
        <>
          <header className="space-y-2">
            {notice.data.summary.titleEn && lang === 'en' ? (
              <>
                <h1 className="text-2xl leading-snug font-semibold text-balance">{notice.data.summary.titleEn}</h1>
                <p lang="ko" className="leading-snug text-ink-2">
                  {notice.data.title}
                </p>
              </>
            ) : notice.data.summary.titleEn ? (
              <>
                <h1 lang="ko" className="text-2xl leading-snug font-semibold text-balance">
                  {notice.data.title}
                </h1>
                <p lang="en" className="leading-snug text-ink-2">
                  {notice.data.summary.titleEn}
                </p>
              </>
            ) : (
              <h1 lang="ko" className="text-2xl leading-snug font-semibold text-balance">
                {notice.data.title}
              </h1>
            )}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
              <span className="text-accent">{categoryName(notice.data.category, lang)}</span>
              {notice.data.department && (
                <>
                  <span aria-hidden>·</span>
                  <span>{notice.data.department}</span>
                </>
              )}
              <span aria-hidden>·</span>
              <time dateTime={notice.data.postedOn}>
                {t('detail.posted', { date: postedLabel(notice.data.postedOn, undefined, lang) })}
              </time>
              {notice.data.editedAt && (
                <>
                  <span aria-hidden>·</span>
                  <time dateTime={notice.data.editedAt} title={t('detail.editedHint')} className="font-medium text-ink-2">
                    {t('detail.edited', { date: shortDate[lang].format(new Date(notice.data.editedAt)) })}
                  </time>
                </>
              )}
            </div>
            <a
              href={notice.data.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-sm text-accent hover:underline"
            >
              {t('detail.original')}
            </a>
          </header>

          <SummaryCard noticeId={notice.data.id} summary={notice.data.summary} />

          {notice.data.attachments.length > 0 && (
            <section className="rounded-lg border border-line bg-surface p-4">
              <h2 className="text-sm font-semibold text-ink-2">
                {t('detail.attachments', { n: notice.data.attachments.length })}
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
              {hasImages ? t('detail.imagesOnly') : t('detail.attachmentsOnly')}
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

function SummaryCard({ noticeId, summary }: { noticeId: number; summary: Summary }) {
  const { lang, t } = useI18n()
  if (summary.status !== 'DONE') {
    return (
      <p className="rounded-lg border border-dashed border-line px-4 py-3 text-sm text-ink-2">
        {summary.status === 'FAILED' ? t('detail.summaryFailed') : t('detail.summaryPending')}
      </p>
    )
  }
  const due = dueLabel(summary.deadline, undefined, lang)
  return (
    <section className="space-y-3 rounded-lg border border-line bg-surface p-5" aria-labelledby="summary-heading">
      <h2 id="summary-heading" className="text-sm font-semibold tracking-wide text-accent uppercase">
        {t('detail.inEnglish')}
      </h2>
      <p lang="en" className="leading-relaxed">
        {summary.summaryEn}
      </p>
      {summary.deadline && (
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <span
            className={`rounded px-1.5 py-0.5 text-xs font-medium ${due ? 'bg-due-soft text-due' : 'bg-line text-ink-2'}`}
          >
            {due ?? t('detail.deadlinePassed')}
          </span>
          <span className="text-ink-2">
            {formatDate(summary.deadline, lang)}
            {summary.deadlineNote && ` · ${summary.deadlineNote}`}
          </span>
          {due && (
            <a
              href={`/api/notices/${noticeId}/calendar.ics`}
              download
              className="text-accent hover:underline"
            >
              {t('detail.addToCalendar')}
            </a>
          )}
        </p>
      )}
      <p className="text-xs text-muted">
        {t('detail.aiNote')}
      </p>
    </section>
  )
}

const longDate = {
  en: new Intl.DateTimeFormat('en', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }),
  ko: new Intl.DateTimeFormat('ko', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' }),
}

const shortDate: Record<Lang, Intl.DateTimeFormat> = {
  en: new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', timeZone: 'Asia/Seoul' }),
  ko: new Intl.DateTimeFormat('ko', { month: 'long', day: 'numeric', timeZone: 'Asia/Seoul' }),
}

function formatDate(isoDate: string, lang: Lang): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  return longDate[lang].format(new Date(y, m - 1, d))
}
