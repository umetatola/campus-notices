import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router'
import DOMPurify from 'dompurify'
import { ApiError, fetchBookmarks, fetchMoreFromDepartment, fetchNotice, removeBookmark, saveBookmark, type Summary } from '../api'
import { useMe } from '../useMe'
import { categoryName, dueLabel, postedLabel } from '../labels'
import { categoryVars } from '../categories'
import { CategoryIcon } from '../CategoryIcon'
import NotFoundPage from './NotFoundPage'
import { NoticeRow } from './NoticeListPage'
import { translate, useI18n, type Lang } from '../i18n'
import { useEnglish, useTranslation } from '../translate'

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

  // English interface without Claude's title: machine translations of the title, office and body
  const machineTitle = useEnglish(notice.data?.summary.titleEn ? null : notice.data?.title)
  const titleEn = notice.data?.summary.titleEn ?? machineTitle
  const department = useEnglish(notice.data?.department) ?? notice.data?.department
  const body = useTranslation(notice.data?.bodyText)
  const [showOriginal, setShowOriginal] = useState(false)

  // go back to the list the user came from (keeps their search), or to the start page on a direct visit
  const back = () => (window.history.state?.idx > 0 ? navigate(-1) : navigate('/'))

  if (!Number.isInteger(noticeId) || (notice.error instanceof ApiError && notice.error.status === 404)) {
    return <NotFoundPage />
  }

  return (
    <article className="space-y-6">
      <button
        onClick={back}
        className="inline-flex items-center gap-1 rounded-full border border-line bg-surface/70 px-3 py-1.5 text-sm text-ink-2 transition hover:border-accent hover:text-accent"
      >
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
          <header style={categoryVars(notice.data.category)} className="card detail-head relative space-y-3 overflow-hidden p-5 hover:transform-none sm:p-7">
            <div className="flex items-center gap-2.5">
              <span className="cat-tile grid size-9 shrink-0 place-items-center rounded-xl">
                <CategoryIcon category={notice.data.category} className="size-[18px]" />
              </span>
              <span className="cat-text text-sm font-semibold">{categoryName(notice.data.category, lang)}</span>
            </div>
            {titleEn && lang === 'en' ? (
              <>
                <h1 className="text-2xl leading-snug font-semibold text-balance">{titleEn}</h1>
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
              {department && (
                <>
                  <span lang={department === notice.data.department ? 'ko' : 'en'}>{department}</span>
                  <span aria-hidden>·</span>
                </>
              )}
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
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <a
                href={notice.data.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary inline-flex items-center rounded-full px-4 py-1.5 text-sm font-medium"
              >
                {t('detail.original')}
              </a>
              <SaveButton noticeId={notice.data.id} />
            </div>
          </header>

          <SummaryCard noticeId={notice.data.id} summary={notice.data.summary} />

          {notice.data.attachments.length > 0 && (
            <section className="rounded-lg border border-line bg-surface p-4">
              <h2 className="text-sm font-semibold text-ink-2">
                {t('detail.attachments', { n: notice.data.attachments.length })}
              </h2>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {notice.data.attachments.map((a) => (
                  <li key={a.url}>
                    <AttachmentLink name={a.name} url={a.url} />
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

          {(body.english || body.pending) && (
            <section className="space-y-3 rounded-lg border border-line bg-surface p-5" aria-labelledby="translated-heading">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 id="translated-heading" className="text-sm font-semibold tracking-wide text-accent uppercase">
                  {t('detail.translatedBody')}
                </h2>
                {body.english && bodyHtml && (
                  <button onClick={() => setShowOriginal(!showOriginal)} className="text-sm text-accent hover:underline">
                    {t(showOriginal ? 'detail.hideOriginal' : 'detail.showOriginal')}
                  </button>
                )}
              </div>
              {body.english ? (
                <p lang="en" className="leading-relaxed whitespace-pre-line">
                  {body.english}
                </p>
              ) : (
                <p className="text-sm text-ink-2">{t('detail.translating')}</p>
              )}
              <p className="text-xs text-muted">{t('detail.machineNote')}</p>
            </section>
          )}

          {/* with a translation the Korean original is shown on request, unless it has pictures the text lacks */}
          {bodyHtml && (!body.english || showOriginal || hasImages) && (
            <div
              lang="ko"
              className="notice-body rounded-lg border border-line bg-surface p-5"
              dangerouslySetInnerHTML={{ __html: bodyHtml }}
            />
          )}

          {notice.data.department && department && (
            <MoreFromDepartment noticeId={notice.data.id} department={department} />
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
    <section className="summary-card space-y-4 rounded-2xl p-5 sm:p-6" aria-labelledby="summary-heading">
      <h2 id="summary-heading" className="flex items-center gap-2 text-sm font-semibold tracking-wide text-accent uppercase">
        <span className="ai-orb grid size-6 place-items-center rounded-lg text-white">
          <svg viewBox="0 0 24 24" fill="currentColor" className="size-3.5" aria-hidden="true">
            <path d="M12 2.5l2.1 5.6a3 3 0 0 0 1.8 1.8l5.6 2.1-5.6 2.1a3 3 0 0 0-1.8 1.8L12 21.5l-2.1-5.6a3 3 0 0 0-1.8-1.8L2.5 12l5.6-2.1a3 3 0 0 0 1.8-1.8z" />
          </svg>
        </span>
        {t('detail.inEnglish')}
      </h2>
      <p lang="en" className="text-[15.5px] leading-relaxed">
        {summary.summaryEn}
      </p>
      {summary.deadline && (
        <div
          className={`flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl px-4 py-3 text-sm ${
            due ? 'bg-due-soft' : 'bg-bg'
          }`}
        >
          <span className={`font-semibold ${due ? 'text-due' : 'text-ink-2'}`}>{due ?? t('detail.deadlinePassed')}</span>
          <span className="text-ink-2">
            {formatDate(summary.deadline, lang)}
            {summary.deadlineNote && ` · ${summary.deadlineNote}`}
          </span>
          {due && (
            <a
              href={`/api/notices/${noticeId}/calendar.ics`}
              download
              className="ml-auto rounded-full border border-due/30 bg-surface px-3 py-1 text-xs font-medium text-due transition hover:border-due"
            >
              {t('detail.addToCalendar')}
            </a>
          )}
        </div>
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

function AttachmentLink({ name, url }: { name: string; url: string }) {
  const english = useEnglish(name)
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2.5 rounded-xl border border-line px-3 py-2.5 text-sm text-ink transition hover:border-accent hover:text-accent"
    >
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="size-4" aria-hidden="true">
          <path d="M14 3.5H7.5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V8z" />
          <path d="M14 3.5V8h4.5M12 11.5v6M9.5 15l2.5 2.5 2.5-2.5" />
        </svg>
      </span>
      <span className="min-w-0 break-all">{english ?? name}</span>
    </a>
  )
}

/** The latest other notices from the same office; hidden when there are none or loading fails. */
function MoreFromDepartment({ noticeId, department }: { noticeId: number; department: string }) {
  const { t } = useI18n()
  const more = useQuery({ queryKey: ['more-from-department', noticeId], queryFn: () => fetchMoreFromDepartment(noticeId) })
  if (!more.data?.length) return null
  return (
    <section className="space-y-2" aria-labelledby="more-from-department">
      <h2 id="more-from-department" className="text-sm font-semibold text-ink-2">
        {t('detail.moreFrom', { department })}
      </h2>
      <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
        {more.data.map((n) => (
          <NoticeRow key={n.id} notice={n} />
        ))}
      </ul>
    </section>
  )
}

/** Save / Saved toggle; only for signed-in users. */
function SaveButton({ noticeId }: { noticeId: number }) {
  const me = useMe()
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const bookmarks = useQuery({ queryKey: ['bookmarks'], queryFn: fetchBookmarks, enabled: !!me })
  const saved = bookmarks.data?.some((b) => b.id === noticeId) ?? false
  const toggle = useMutation({
    mutationFn: (save: boolean) => (save ? saveBookmark(noticeId) : removeBookmark(noticeId)),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['bookmarks'] }),
  })
  if (!me || !bookmarks.isSuccess) return null
  // show the state being asked for while the request runs
  const pressed = toggle.isPending ? toggle.variables : saved
  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        aria-pressed={pressed}
        disabled={toggle.isPending}
        onClick={() => toggle.mutate(!saved)}
        className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
          pressed ? 'border-accent bg-accent-soft text-accent' : 'border-line text-ink-2 hover:text-ink'
        }`}
      >
        {pressed ? `★ ${t('detail.saved')}` : `☆ ${t('detail.save')}`}
      </button>
      {toggle.isError && (
        <span role="alert" className="text-sm text-due">
          {t('detail.saveError')}
        </span>
      )}
    </span>
  )
}

const shortDate: Record<Lang, Intl.DateTimeFormat> = {
  en: new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', timeZone: 'Asia/Seoul' }),
  ko: new Intl.DateTimeFormat('ko', { month: 'long', day: 'numeric', timeZone: 'Asia/Seoul' }),
}

function formatDate(isoDate: string, lang: Lang): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  return longDate[lang].format(new Date(y, m - 1, d))
}
