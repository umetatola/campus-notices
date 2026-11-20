// Which notices this device has opened, so the lists can show unread ones in bold. Kept in localStorage like the
// other per-device preferences; when storage is unavailable it still works for the session, it just isn't remembered.
import { useSyncExternalStore } from 'react'

const KEY = 'cn-read'
// enough for months of notices; the oldest ids drop off first
const LIMIT = 3000

let ids: number[] | null = null
let set = new Set<number>()
const listeners = new Set<() => void>()

function load(): number[] {
  if (ids) return ids
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    ids = Array.isArray(parsed) ? parsed.filter((n): n is number => Number.isInteger(n)) : []
  } catch {
    ids = []
  }
  set = new Set(ids)
  return ids
}

function emit() {
  listeners.forEach((l) => l())
}

export function isRead(id: number): boolean {
  load()
  return set.has(id)
}

export function markRead(id: number) {
  const current = load()
  if (set.has(id)) return
  ids = [...current, id].slice(-LIMIT)
  set = new Set(ids)
  try {
    localStorage.setItem(KEY, JSON.stringify(ids))
  } catch {
    // not remembered; fine
  }
  emit()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  // another tab opened a notice
  const onStorage = (e: StorageEvent) => {
    if (e.key !== KEY && e.key !== null) return
    ids = null
    listener()
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', onStorage)
  }
}

/** True once this device has opened the notice; re-renders when that changes. */
export function useIsRead(id: number): boolean {
  return useSyncExternalStore(subscribe, () => isRead(id))
}

/** For tests: forget the in-memory copy so the next read comes from localStorage. */
export function resetReadCache() {
  ids = null
  set = new Set()
}
