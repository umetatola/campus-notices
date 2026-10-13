import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { verifySignIn } from '../api'
import { useI18n } from '../i18n'

/** Landing page of the emailed link. Signing in is a POST from here, so mail scanners that open links can't use up the token. */
export default function VerifyPage() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const navigate = useNavigate()
  const { t } = useI18n()
  const queryClient = useQueryClient()

  // a query (not an effect) so the token is sent exactly once, even when React renders twice in development
  const verify = useQuery({
    queryKey: ['verify', token],
    queryFn: () => verifySignIn(token),
    enabled: token.length > 0,
    retry: false,
    staleTime: Infinity,
    gcTime: Infinity,
  })

  useEffect(() => {
    if (verify.data) {
      queryClient.setQueryData(['me'], verify.data)
      navigate('/alerts', { replace: true })
    }
  }, [verify.data, queryClient, navigate])

  if (!token || verify.isError) {
    return (
      <div className="mx-auto max-w-md space-y-3 py-8">
        <h1 className="text-2xl font-semibold">{t('verify.badTitle')}</h1>
        <p className="text-ink-2">{t('verify.badText')}</p>
        <Link to="/sign-in" className="inline-block text-accent underline">
          {t('verify.newLink')}
        </Link>
      </div>
    )
  }
  return <p className="py-8 text-center text-ink-2">{t('verify.signingIn')}</p>
}
