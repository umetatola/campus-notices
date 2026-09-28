import { Link } from 'react-router'

export default function NotFoundPage() {
  return (
    <div className="py-16 text-center">
      <h1 className="text-xl font-semibold">Page not found</h1>
      <p className="mt-2 text-ink-2">The page you opened doesn't exist.</p>
      <Link to="/" className="mt-6 inline-block text-accent underline">
        Go to all notices
      </Link>
    </div>
  )
}
