import { createContext, useContext } from 'react'

export type Lang = 'en' | 'ko'

// Interface text only: the notices themselves are already shown in both languages.
const messages = {
  en: {
    'nav.account': 'Account',
    'nav.alerts': 'Alerts',
    'nav.signOut': 'Sign out',
    'nav.getAlerts': 'Get alerts',
    'nav.switchLanguage': 'Switch language',
    'footer.note':
      'Notices are collected from the public Ajou University notice board. Always check the original notice for official details.',
    'list.searchLabel': 'Search notices',
    'list.searchPlaceholder': 'Search in English or Korean, e.g. scholarship or 장학',
    'list.filterLabel': 'Filter by category',
    'list.all': 'All',
    'list.loadError': "Couldn't load notices.",
    'list.loadErrorHint': 'Check your connection and try again.',
    'common.tryAgain': 'Try again',
    'list.empty': 'No notices match.',
    'list.emptyHint': 'Try a different word, or clear the category filter.',
    'list.count.one': '{n} notice',
    'list.count.other': '{n} notices',
    'list.pinned': 'Pinned',
    'list.pages': 'Pages',
    'list.newer': '← Newer',
    'list.older': 'Older →',
    'list.pageOf': 'Page {page} of {total}',
    'list.loading': 'Loading notices',
    'detail.back': '← All notices',
    'detail.loading': 'Loading notice',
    'detail.loadError': "Couldn't load this notice.",
    'detail.posted': 'Posted {date}',
    'detail.original': 'Open the original on ajou.ac.kr ↗',
    'detail.attachments': 'Attachments ({n})',
    'detail.imagesOnly': 'This notice is published as images, shown below.',
    'detail.attachmentsOnly': 'This notice has no text of its own. The details are in the attachments above.',
    'detail.summaryFailed': "We couldn't write an English summary for this notice. The original is below.",
    'detail.summaryPending': 'English summary coming soon. The original notice is below.',
    'detail.inEnglish': 'In English',
    'detail.deadlinePassed': 'Deadline passed',
    'detail.addToCalendar': 'Add to calendar',
    'detail.aiNote': 'Written by AI from the Korean notice. Check the original for official details.',
    'notFound.title': 'Page not found',
    'notFound.text': "The page you opened doesn't exist.",
    'notFound.link': 'Go to all notices',
    'date.today': 'Today',
    'date.yesterday': 'Yesterday',
    'due.today': 'Due today',
    'due.tomorrow': 'Due tomorrow',
    'due.date': 'Due {date}',
  },
  ko: {
    'nav.account': '계정',
    'nav.alerts': '알림',
    'nav.signOut': '로그아웃',
    'nav.getAlerts': '알림 받기',
    'nav.switchLanguage': '언어 바꾸기',
    'footer.note': '공지는 아주대학교 공개 공지사항 게시판에서 가져옵니다. 정확한 내용은 항상 원문 공지를 확인하세요.',
    'list.searchLabel': '공지 검색',
    'list.searchPlaceholder': '한국어나 영어로 검색 (예: 장학, scholarship)',
    'list.filterLabel': '분류별 보기',
    'list.all': '전체',
    'list.loadError': '공지를 불러오지 못했습니다.',
    'list.loadErrorHint': '인터넷 연결을 확인하고 다시 시도하세요.',
    'common.tryAgain': '다시 시도',
    'list.empty': '해당하는 공지가 없습니다.',
    'list.emptyHint': '다른 단어로 검색하거나 분류 선택을 해제해 보세요.',
    'list.count.one': '공지 {n}건',
    'list.count.other': '공지 {n}건',
    'list.pinned': '고정',
    'list.pages': '페이지',
    'list.newer': '← 최신',
    'list.older': '이전 →',
    'list.pageOf': '{total}쪽 중 {page}쪽',
    'list.loading': '공지 불러오는 중',
    'detail.back': '← 전체 공지',
    'detail.loading': '공지 불러오는 중',
    'detail.loadError': '이 공지를 불러오지 못했습니다.',
    'detail.posted': '{date} 게시',
    'detail.original': 'ajou.ac.kr에서 원문 보기 ↗',
    'detail.attachments': '첨부파일 ({n})',
    'detail.imagesOnly': '이 공지는 이미지로 게시되어 아래에 표시됩니다.',
    'detail.attachmentsOnly': '이 공지에는 본문이 없습니다. 자세한 내용은 위 첨부파일에 있습니다.',
    'detail.summaryFailed': '이 공지의 영어 요약을 만들지 못했습니다. 원문은 아래에 있습니다.',
    'detail.summaryPending': '영어 요약을 준비하고 있습니다. 원문은 아래에 있습니다.',
    'detail.inEnglish': '영어 요약',
    'detail.deadlinePassed': '마감됨',
    'detail.addToCalendar': '캘린더에 추가',
    'detail.aiNote': 'AI가 한국어 공지를 바탕으로 작성했습니다. 정확한 내용은 원문을 확인하세요.',
    'notFound.title': '페이지를 찾을 수 없습니다',
    'notFound.text': '요청한 페이지가 없습니다.',
    'notFound.link': '전체 공지로 가기',
    'date.today': '오늘',
    'date.yesterday': '어제',
    'due.today': '오늘 마감',
    'due.tomorrow': '내일 마감',
    'due.date': '{date} 마감',
  },
} satisfies Record<Lang, Record<string, string>>

export type MessageKey = keyof (typeof messages)['en']

export function translate(lang: Lang, key: MessageKey, vars: Record<string, string | number> = {}): string {
  return messages[lang][key].replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? `{${name}}`))
}

export interface LangState {
  lang: Lang
  setLang: (lang: Lang) => void
}

// Without a provider (e.g. in tests) the app is in English.
export const LangContext = createContext<LangState>({ lang: 'en', setLang: () => {} })

/** The current language, a setter, and `t` for interface text. */
export function useI18n() {
  const { lang, setLang } = useContext(LangContext)
  const t = (key: MessageKey, vars?: Record<string, string | number>) => translate(lang, key, vars)
  return { lang, setLang, t }
}
