import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'

// The Navigation API (Edge, Chrome) knows whether there is a page to go back or forward to.
interface NavigationLike {
  canGoBack: boolean
  canGoForward: boolean
  addEventListener(type: 'currententrychange', listener: () => void): void
  removeEventListener(type: 'currententrychange', listener: () => void): void
}

function navigationApi(): NavigationLike | undefined {
  return (window as unknown as { navigation?: NavigationLike }).navigation
}

/** Back/forward for windows without browser buttons (the desktop app, an installed phone app). */
export function useHistoryNav() {
  const navigate = useNavigate()
  const location = useLocation()
  const read = () => {
    const nav = navigationApi()
    if (nav) return { canGoBack: nav.canGoBack, canGoForward: nav.canGoForward }
    // fallback: React Router numbers its history entries; forward can't be known, so allow it
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0
    return { canGoBack: idx > 0, canGoForward: true }
  }
  const [state, setState] = useState(read)

  useEffect(() => {
    setState(read())
    const nav = navigationApi()
    if (!nav) return
    const update = () => setState(read())
    nav.addEventListener('currententrychange', update)
    return () => nav.removeEventListener('currententrychange', update)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key])

  return { ...state, back: () => navigate(-1), forward: () => navigate(1) }
}

/** True in windows that have no browser toolbar: the installed app (PWA) or the desktop app's app window. */
export function useStandaloneWindow() {
  const [standalone] = useState(
    () => typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches,
  )
  return standalone
}
