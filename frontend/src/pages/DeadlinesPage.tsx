import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router'
import { fetchDeadlines } from '../api'
import { useI18n } from '../i18n'
import { DeadlineCalendar } from './DeadlineCalendar'
import { NoticeRow } from './NoticeListPage'
import { Segmented } from '../Segmented'
import { StatusCard } from '../StatusCard'
import { PageHeader } from '../PageHeader'

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
      <PageHeader icon="deadlines" title={t('deadlines.title')}>
        <p>{t('deadlines.intro')}</p>
      </PageHeader>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented
          label={t('deadlines.view')}
          value={calendar ? 'calendar' : 'list'}
          options={[
            { value: 'list', label: t('deadlines.list') },
            { value: 'calendar', label: t('deadlines.calendar') },
          ]}
          onChange={(v) => setParams(v === 'calendar' ? { view: 'calendar' } : {}, { replace: true })}
        />
        {!calendar && (
          <Segmented
            label={t('deadlines.range')}
            value={days}
            options={RANGES.map((d) => ({ value: d, label: t(d === 14 ? 'deadlines.twoWeeks' : 'deadlines.month') }))}
            onChange={(d) => setParams(d === 14 ? {} : { days: String(d) }, { replace: true })}
          />
        )}
      </div>
      {deadlines.isPending ? (
        <p className="py-8 text-center text-ink-2">{t('deadlines.loading')}</p>
      ) : deadlines.isError ? (
        <StatusCard kind="error" alert title={t('deadlines.loadError')} />
      ) : calendar ? (
        <DeadlineCalendar notices={deadlines.data} days={CALENDAR_DAYS} />
      ) : deadlines.data.length === 0 ? (
        <StatusCard kind="calendar" title={t('deadlines.empty')} />
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
