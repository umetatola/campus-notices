import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Navigate } from 'react-router'
import { requestSignInLink } from '../api'
import { useMe } from '../useMe'

export default function SignInPage() {
  const me = useMe()
  const [email, setEmail] = useState('')
  const request = useMutation({ mutationFn: (address: string) => requestSignInLink(address) })

  if (me) return <Navigate to="/alerts" replace />

  if (request.isSuccess) {
    return (
      <div className="mx-auto max-w-md space-y-3 py-8">
        <h1 className="text-2xl font-semibold">Check your email</h1>
        <p className="text-ink-2">
          If <span className="font-medium text-ink">{request.variables}</span> can receive mail, a sign-in link is on its
          way. It works once and expires in 15 minutes.
        </p>
        <p className="text-sm text-muted">
          Nothing arrived? Check your spam folder, or{' '}
          <button className="text-accent underline" onClick={() => request.reset()}>
            try again
          </button>
          .
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-md space-y-5 py-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Sign in</h1>
        <p className="text-ink-2">
          Get an email when a new notice mentions the words you care about. No password: we email you a sign-in link.
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
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@ajou.ac.kr"
          className="w-full rounded-lg border border-line bg-surface px-4 py-3 text-base placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
        />
        {request.isError && (
          <p role="alert" className="text-sm text-due">
            {request.error.message}. Please try again.
          </p>
        )}
        <button
          type="submit"
          disabled={request.isPending}
          className="w-full rounded-lg bg-accent px-4 py-3 font-medium text-surface disabled:opacity-60"
        >
          {request.isPending ? 'Sending…' : 'Email me a sign-in link'}
        </button>
      </form>
    </div>
  )
}
