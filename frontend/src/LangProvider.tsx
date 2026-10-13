import { useEffect, useState, type ReactNode } from 'react'
import { LangContext, type Lang } from './i18n'

const STORAGE_KEY = 'lang'

function initialLang(): Lang {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'ko' ? 'ko' : 'en'
  } catch {
    return 'en' // storage blocked (private mode): fall back to English
  }
}

export default function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(initialLang)

  useEffect(() => {
    document.documentElement.lang = lang
    try {
      localStorage.setItem(STORAGE_KEY, lang)
    } catch {
      // not remembered; still works for this visit
    }
  }, [lang])

  return <LangContext value={{ lang, setLang }}>{children}</LangContext>
}

