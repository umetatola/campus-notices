import { useQuery } from '@tanstack/react-query'
import { Link, Navigate } from 'react-router'
import { fetchBookmarks } from '../api'
import { useMe } from '../useMe'
import { useI18n } from '../i18n'
import { NoticeRow } from './NoticeListPage'

export default function SavedPage() {
  const me = useMe()
  const { t } = useI18n()
  const bookmarks = useQuery({ queryKey: ['bookmarks'], queryFn: fetchBookmarks, enabled: !!me })

  if (me === null) return <Navigate to="/sign-in" replace />
  if (me === undefined || bookmarks.isPending) return <p className="py-8 text-center text-ink-2">{t('saved.loading')}</p>

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{t('saved.title')}</h1>
      {bookmarks.isError ? (
        <p role="alert" className="text-ink-2">
          {t('saved.loadError')}
        </p>
      ) : bookmarks.data.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line px-4 py-10 text-center">
          <p className="font-medium">{t('saved.empty')}</p>
          <p className="mt-1 text-sm text-ink-2">{t('saved.emptyHint')}</p>
          <Link to="/" className="mt-4 inline-block text-sm text-accent hover:underline">
            {t('saved.backToList')}
          </Link>
        </div>
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
