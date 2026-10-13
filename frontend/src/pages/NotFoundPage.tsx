import { Link } from 'react-router'
import { useI18n } from '../i18n'

export default function NotFoundPage() {
  const { t } = useI18n()
  return (
    <div className="py-16 text-center">
      <h1 className="text-xl font-semibold">{t('notFound.title')}</h1>
      <p className="mt-2 text-ink-2">{t('notFound.text')}</p>
      <Link to="/" className="mt-6 inline-block text-accent underline">
        {t('notFound.link')}
      </Link>
    </div>
  )
}
