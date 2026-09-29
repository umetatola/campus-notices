import { useQuery } from '@tanstack/react-query'
import { fetchMe } from './api'

/** The signed-in user: `undefined` while loading, `null` when signed out. */
export function useMe() {
  const me = useQuery({ queryKey: ['me'], queryFn: fetchMe, staleTime: 5 * 60_000 })
  return me.data
}
