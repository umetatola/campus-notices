import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Navigate } from 'react-router'
import { requestSignInLink } from '../api'
import { useMe } from '../useMe'
import { useI18n } from '../i18n'

export default function SignInPage() {
  const me = useMe()
  const { t } = useI18n()
  const [email, setEmail] = useState('')
  const request = useMutation({ mutationFn: (address: string) => requestSignInLink(address) })

  if (me) return <Navigate to="/alerts" replace />

  if (request.isSuccess) {
    return (
      <div className="card mx-auto max-w-md space-y-3 p-7 text-center hover:transform-none sm:mt-6">
        <MailIcon />
        <h1 className="text-2xl font-semibold">{t('signIn.checkTitle')}</h1>
        <p className="text-ink-2">
          {t('signIn.checkBefore')}
          <span className="font-medium text-ink">{request.variables}</span>
          {t('signIn.checkAfter')}
        </p>
        <p className="text-sm text-muted">
          {t('signIn.nothingArrived')}
          <button className="text-accent underline" onClick={() => request.reset()}>
            {t('signIn.tryAgainLink')}
          </button>
          .
        </p>
      </div>
    )
  }

  return (
    <div className="card mx-auto max-w-md space-y-6 p-7 hover:transform-none sm:mt-6 sm:p-8">
      <div className="space-y-2">
        <BellIcon />
        <h1 className="text-2xl font-semibold">{t('signIn.title')}</h1>
        <p className="text-ink-2">
          {t('signIn.intro')}
        </p>
      </div>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          request.mutate(email.trim())
        }}
      >
        <label htmlFor="email" className="block text-sm font-medium">
          {t('signIn.email')}
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@ajou.ac.kr"
          className="w-full rounded-xl border border-line bg-bg px-4 py-3 text-base placeholder:text-muted focus:border-accent focus:bg-surface focus:outline-none focus:ring-4 focus:ring-accent/15"
        />
        {request.isError && (
          <p role="alert" className="text-sm text-due">
            {t('signIn.errorSuffix', { message: request.error.message })}
          </p>
        )}
        <button
          type="submit"
          disabled={request.isPending}
          className="btn-primary w-full rounded-xl px-4 py-3 font-medium"
        >
          {request.isPending ? t('signIn.sending') : t('signIn.submit')}
        </button>
      </form>
      <ul className="space-y-2.5 border-t border-line pt-5 text-sm text-ink-2">
        {(['signIn.perkAlerts', 'signIn.perkSaved', 'signIn.perkAsk'] as const).map((key) => (
          <li key={key} className="flex items-start gap-2.5">
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true">
              <path d="m4.5 10.5 3.5 3.5 7.5-8" />
            </svg>
            {t(key)}
          </li>
        ))}
      </ul>
    </div>
  )
}

function BellIcon() {
  return (
    <span className="brand-mark mb-3 grid size-11 place-items-center rounded-2xl text-white">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-5" aria-hidden="true">
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      </svg>
    </span>
  )
}

function MailIcon() {
  return (
    <span className="brand-mark mx-auto mb-2 grid size-12 place-items-center rounded-2xl text-white">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-5" aria-hidden="true">
        <rect x="3" y="5" width="18" height="14" rx="2.5" />
        <path d="m4 7 8 6 8-6" />
      </svg>
    </span>
  )
}
