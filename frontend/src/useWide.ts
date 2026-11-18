import { useSyncExternalStore } from 'react'

const QUERY = '(min-width: 640px)' // Tailwind's sm breakpoint

/**
 * True on screens wide enough for the header links; false on phones, which get the bottom tab bar instead.
 * Rendering only one of the two keeps each link once in the page. Without matchMedia (tests) it counts as wide.
 */
export function useWide(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window.matchMedia !== 'function') return () => {}
      const list = window.matchMedia(QUERY)
      list.addEventListener('change', onChange)
      return () => list.removeEventListener('change', onChange)
    },
    () => typeof window.matchMedia !== 'function' || window.matchMedia(QUERY).matches,
  )
}
