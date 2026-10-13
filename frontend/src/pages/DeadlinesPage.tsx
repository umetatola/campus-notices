import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router'
import { fetchDeadlines } from '../api'
import { useI18n } from '../i18n'
import { CategoryChip, NoticeRow } from './NoticeListPage'

const RANGES = [14, 30] as const

export default function DeadlinesPage() {
  const { t } = useI18n()
  const [params, setParams] = useSearchParams()
  const days = params.get('days') === '30' ? 30 : 14
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
      {deadlines.isPending ? (
        <p className="py-8 text-center text-ink-2">{t('deadlines.loading')}</p>
      ) : deadlines.isError ? (
        <p role="alert" className="text-ink-2">
          {t('deadlines.loadError')}
        </p>
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
