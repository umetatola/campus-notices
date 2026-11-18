import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router'
import { fetchDeadlines } from '../api'
import { useI18n } from '../i18n'
import { DeadlineCalendar } from './DeadlineCalendar'
import { CategoryChip, NoticeRow } from './NoticeListPage'

const RANGES = [14, 30] as const
/** The calendar asks for the longest range the API allows. */
const CALENDAR_DAYS = 60

export default function DeadlinesPage() {
  const { t } = useI18n()
  const [params, setParams] = useSearchParams()
  const calendar = params.get('view') === 'calendar'
  const days = calendar ? CALENDAR_DAYS : params.get('days') === '30' ? 30 : 14
  const deadlines = useQuery({
    queryKey: ['deadlines', days],
    queryFn: () => fetchDeadlines(days),
    placeholderData: keepPreviousData,
  })

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">{t('deadlines.title')}</h1>
        <p className="text-ink-2">{t('deadlines.intro')}</p>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2" role="group" aria-label={t('deadlines.view')}>
          <CategoryChip
            label={t('deadlines.list')}
            selected={!calendar}
            onClick={() => setParams({}, { replace: true })}
          />
          <CategoryChip
            label={t('deadlines.calendar')}
            selected={calendar}
            onClick={() => setParams({ view: 'calendar' }, { replace: true })}
          />
        </div>
        {!calendar && (
          <div className="flex gap-2" role="group" aria-label={t('deadlines.range')}>
            {RANGES.map((d) => (
              <CategoryChip
                key={d}
                label={t(d === 14 ? 'deadlines.twoWeeks' : 'deadlines.month')}
                selected={days === d}
                onClick={() => setParams(d === 14 ? {} : { days: String(d) }, { replace: true })}
              />
            ))}
          </div>
        )}
      </div>
      {deadlines.isPending ? (
        <p className="py-8 text-center text-ink-2">{t('deadlines.loading')}</p>
      ) : deadlines.isError ? (
        <p role="alert" className="text-ink-2">
          {t('deadlines.loadError')}
        </p>
      ) : calendar ? (
        <DeadlineCalendar notices={deadlines.data} days={CALENDAR_DAYS} />
      ) : deadlines.data.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line px-4 py-10 text-center text-ink-2">
          {t('deadlines.empty')}
        </p>
      ) : (
        <ul
          className={`divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface ${
            deadlines.isPlaceholderData ? 'opacity-60' : ''
          }`}
        >
          {deadlines.data.map((n) => (
            <NoticeRow key={n.id} notice={n} />
          ))}
        </ul>
      )}
    </div>
  )
}
