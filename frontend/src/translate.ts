import { useQuery } from '@tanstack/react-query'
import { ApiError, translateTexts } from './api'
import { useI18n } from './i18n'

const HANGUL = /[\uac00-\ud7a3\u3131-\u318e]/
const BATCH_WAIT_MS = 20
const BATCH_SIZE = 50

export const hasKorean = (text: string) => HANGUL.test(text)

type Waiting = { text: string; resolve: (english: string) => void }
let waiting: Waiting[] = []
let timer: ReturnType<typeof setTimeout> | undefined
// the website has no translation endpoint; after one 404 stop asking
let unavailable = false

/**
 * Machine translation (desktop app only). Every text asked for while a page renders goes out in one request; when
 * translation isn't available the Korean text comes back unchanged.
 */
export function translateToEnglish(text: string): Promise<string> {
  if (unavailable) return Promise.resolve(text)
  return new Promise((resolve) => {
    waiting.push({ text, resolve })
    timer ??= setTimeout(flush, BATCH_WAIT_MS)
  })
}

async function flush() {
  timer = undefined
  const batch = waiting
  waiting = []
  for (let i = 0; i < batch.length; i += BATCH_SIZE) {
    const part = batch.slice(i, i + BATCH_SIZE)
    try {
      const english = await translateTexts(part.map((w) => w.text))
      part.forEach((w, j) => w.resolve(english[j] ?? w.text))
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) unavailable = true
      part.forEach((w) => w.resolve(w.text))
    }
  }
}

/**
 * English for a Korean `text` in the English interface. `english` is undefined in Korean, for non-Korean text, while
 * waiting (`pending`), and when no translation is available.
 */
export function useTranslation(text: string | null | undefined): { english?: string; pending: boolean } {
  const { lang } = useI18n()
  const wanted = lang === 'en' && !!text && hasKorean(text)
  const translation = useQuery({
    queryKey: ['translate', text],
    queryFn: () => translateToEnglish(text!),
    enabled: wanted,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
  })
  if (!wanted) return { pending: false }
  return {
    english: translation.data !== text ? translation.data : undefined,
    pending: translation.isPending,
  }
}

export const useEnglish = (text: string | null | undefined) => useTranslation(text).english
