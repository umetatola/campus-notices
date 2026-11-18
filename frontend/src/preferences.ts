// Per-device display preferences from the ⋮ menu: colour theme and zoom. Kept in localStorage; when storage is
// unavailable (private window, blocked site data) everything still works, it just isn't remembered.

export type Theme = 'system' | 'light' | 'dark'

export const ZOOM_MIN = 0.7
export const ZOOM_MAX = 1.6
export const ZOOM_STEP = 0.1

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    // not remembered; fine
  }
}

export function savedTheme(): Theme {
  const t = read('cn-theme')
  return t === 'light' || t === 'dark' ? t : 'system'
}

export function applyTheme(theme: Theme) {
  if (theme === 'system') document.documentElement.removeAttribute('data-theme')
  else document.documentElement.setAttribute('data-theme', theme)
  write('cn-theme', theme === 'system' ? null : theme)
}

export function savedZoom(): number {
  const z = Number(read('cn-zoom'))
  return Number.isFinite(z) && z >= ZOOM_MIN && z <= ZOOM_MAX ? z : 1
}

export function applyZoom(zoom: number): number {
  const z = Math.round(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom)) * 10) / 10
  document.documentElement.style.setProperty('zoom', z === 1 ? '' : String(z))
  write('cn-zoom', z === 1 ? null : String(z))
  return z
}

/** Called once before the first render, so the page never flashes the wrong theme or size. */
export function applySavedPreferences() {
  applyTheme(savedTheme())
  applyZoom(savedZoom())
}
