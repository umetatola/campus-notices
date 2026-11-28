// Which notices this device has opened, so the lists can show unread ones in bold. Kept in localStorage like the
// other per-device preferences; when storage is unavailable it still works for the session, it just isn't remembered.
// Signed in, the list is also kept on the server (/api/reads), so it follows the user to their other devices.
import { useEffect, useSyncExternalStore } from 'react'
import { fetchReads, sendReads } from './api'
import { useMe } from './useMe'

const KEY = 'cn-read'
// enough for months of notices; the oldest ids drop off first (the server keeps the same number)
const LIMIT = 3000
// the server takes this many ids per request
const BATCH = 500

let ids: number[] | null = null
let set = new Set<number>()
const listeners = new Set<() => void>()
// the signed-in user whose reads are being kept on the server, or null
let syncedUser: string | null = null

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
  markAllRead([id])
}

/** Marks several notices read at once (the "Mark all as read" button), with one save and one re-render. */
export function markAllRead(newIds: readonly number[]) {
  const current = load()
  const added = [...new Set(newIds)].filter((id) => !set.has(id))
  if (added.length === 0) return
  remember([...current, ...added])
  if (syncedUser !== null) upload(added)
}

function remember(next: number[]) {
  ids = next.slice(-LIMIT)
  set = new Set(ids)
  try {
    localStorage.setItem(KEY, JSON.stringify(ids))
  } catch {
    // not remembered; fine
  }
  emit()
}

/** Best effort: a failed upload is sent again with the rest of the local list on the next sign-in or reload. */
function upload(toSend: number[]) {
  for (let i = 0; i < toSend.length; i += BATCH) {
    sendReads(toSend.slice(i, i + BATCH)).catch(() => {})
  }
}

/**
 * Starts keeping reads on the server for this user: adds what other devices read to this one, then sends what this
 * device read while signed out. Safe to call again; it runs once per user.
 */
export async function startSync(userId: string) {
  if (syncedUser === userId) return
  syncedUser = userId
  let server: number[]
  try {
    server = await fetchReads()
  } catch {
    return // offline or signed out meanwhile; local reading still works, and the next load tries again
  }
  if (syncedUser !== userId) return
  const onServer = new Set(server)
  const local = load()
  // the server's list is newest first; anything new to this device goes before the local reads
  const fromServer = server.filter((id) => !set.has(id)).reverse()
  if (fromServer.length > 0) remember([...fromServer, ...local])
  upload(local.filter((id) => !onServer.has(id)))
}

/** Signed out: keep the local list, stop sending to the server. */
export function stopSync() {
  syncedUser = null
}

/** Keeps the signed-in user's reads in step with the server; mount once, in the app layout. */
export function useReadSync() {
  const me = useMe()
  const userId = me?.email
  useEffect(() => {
    if (userId !== undefined) void startSync(userId)
    else if (me === null) stopSync()
  }, [userId, me])
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

/** How many of these notices this device hasn't opened yet; re-renders when that changes. */
export function useUnreadCount(noticeIds: readonly number[]): number {
  return useSyncExternalStore(subscribe, () => noticeIds.filter((id) => !isRead(id)).length)
}

/** For tests: forget the in-memory copy so the next read comes from localStorage. */
export function resetReadCache() {
  ids = null
  set = new Set()
  syncedUser = null
}
