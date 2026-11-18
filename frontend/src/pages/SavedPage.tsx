import { useQuery } from '@tanstack/react-query'
import { Link, Navigate } from 'react-router'
import { fetchBookmarks } from '../api'
import { useMe } from '../useMe'
import { useI18n } from '../i18n'
import { NoticeRow } from './NoticeListPage'
import { PageHeader } from '../PageHeader'
import { StatusCard } from '../StatusCard'

export default function SavedPage() {
  const me = useMe()
  const { t } = useI18n()
  const bookmarks = useQuery({ queryKey: ['bookmarks'], queryFn: fetchBookmarks, enabled: !!me })

  if (me === null) return <Navigate to="/sign-in" replace />
  if (me === undefined || bookmarks.isPending) return <p className="py-8 text-center text-ink-2">{t('saved.loading')}</p>

  return (
    <div className="space-y-6">
      <PageHeader icon="saved" title={t('saved.title')} />
      {bookmarks.isError ? (
        <StatusCard kind="error" alert title={t('saved.loadError')} />
      ) : bookmarks.data.length === 0 ? (
        <StatusCard
          kind="empty"
          title={t('saved.empty')}
          hint={t('saved.emptyHint')}
          action={
            <Link to="/" className="btn-primary mt-5 inline-block rounded-full px-5 py-2 text-sm font-medium">
              {t('saved.backToList')}
            </Link>
          }
        />
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
          {bookmarks.data.map((n) => (
            <NoticeRow key={n.id} notice={n} />
          ))}
        </ul>
      )}
    </div>
  )
}
