// Takes the README screenshots: the built web app with a demo API (real Ajou notice titles, sample summaries).
// Usage: npm run build && npx vite preview --port 4173 &  then  node scripts/screenshots.mjs
// Needs Playwright: npx -y playwright install chromium (or install the "playwright" package).
import { chromium } from 'playwright'

const BASE = process.env.BASE_URL ?? 'http://localhost:4173'
const OUT = process.env.OUT_DIR ?? new URL('../../docs/screenshots/', import.meta.url).pathname

const today = new Date()
const iso = (days) => new Date(today.getTime() + days * 86_400_000).toISOString().slice(0, 10)

const notices = [
  [375874, '[학부]2026학년도 2학기 수강포기(수강철회) 안내', 'Fall 2026 course withdrawal', '학사', '학사팀', 0, 6, true],
  [376552, '[일자리+센터] 기아 AutoLand 투어(광명) 참여자 모집(선착순 30명)', 'Kia AutoLand factory tour (Gwangmyeong): 30 places, first come', '취업', '일자리+센터', 0, 1, false],
  [376551, '[일자리+센터] Google Gemini Academy 참여자 모집', 'Google Gemini Academy: participants wanted', '취업', '일자리+센터', -1, 9, false],
  [376505, '[미래차사업단] WE:DRIVE 자동차 미래 인재 양성 프로그램 학생 모집', 'WE:DRIVE future-mobility talent program: student recruitment', '비교과', '미래차사업단', -1, null, false],
  [374473, '[학부] 어학졸업인증(2027년 2월 졸업)을 위한 공인어학 성적 등록 및 제출 안내', 'Submitting language test scores for the February 2027 graduation requirement', '학사', '학사팀', -3, 30, false],
  [374471, '[학부/학사과정] 2026학년도 전기(2027년 2월) 조기졸업 신청 안내', 'Early graduation applications (February 2027)', '학사', '학사팀', -3, null, false],
  [376489, '[학습법] 나의 학습 유형을 알고, 효과적인 학습법 찾기!', 'Find your learning style and a study method that works', '비교과', '교수학습개발센터', -4, null, false],
  [375612, '[총무팀] 2026학년도 2학기 교내 주차 인프라 개선 사항 안내', 'Campus parking improvements this semester', '사무', '총무팀', -5, null, false],
].map(([id, title, titleEn, category, department, posted, due, pinned]) => ({
  id, title, titleEn, category, department, postedOn: iso(posted), deadline: due === null ? null : iso(due), pinned,
  sourceUrl: `https://www.ajou.ac.kr/kr/ajou/notice.do?mode=view&articleNo=${id}`,
  editedAt: null,
}))

const detail = {
  ...notices[0],
  summary: {
    status: 'DONE',
    titleEn: notices[0].titleEn,
    summaryEn:
      'Undergraduates can withdraw from fall 2026 courses online in the academic portal during the withdrawal period. ' +
      'A withdrawn course stays on the transcript as W and does not count toward the GPA. Check the minimum credit ' +
      'rules for your program before withdrawing.',
    deadline: notices[0].deadline,
    deadlineNote: 'until 17:00 KST',
  },
  bodyHtml:
    '<p><strong>2026학년도 2학기 수강포기(수강철회) 안내</strong></p><p>1. 신청 기간: 학사일정 참조</p>' +
    '<p>2. 신청 방법: 아주대학교 포털 → 학사서비스 → 수강포기 신청</p><p>3. 유의 사항: 수강포기 과목은 성적표에 W로 표기됩니다.</p>',
  bodyText: '수강포기 안내',
  attachments: [{ name: '2026-2 수강포기 안내문.pdf', url: 'https://www.ajou.ac.kr/' }],
  firstSeenAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

async function demoApi(page, { signedIn = false } = {}) {
  await page.route('**/api/**', (route) => {
    const url = new URL(route.request().url())
    const ok = (body) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
    switch (url.pathname) {
      case '/api/notices':
        return ok({ items: notices, page: 0, size: 20, totalItems: 1284, totalPages: 65 })
      case '/api/notices/categories':
        return ok(['학사', '장학', '취업', '행사', '비교과', '사무'])
      case `/api/notices/${detail.id}`:
        return ok(detail)
      case '/api/me':
        return signedIn ? ok({ email: 'student@ajou.ac.kr' }) : route.fulfill({ status: 401 })
      case '/api/subscriptions':
        return ok(['장학', 'internship', 'dorm', 'visa'].map((keyword, i) => ({ id: i + 1, keyword, createdAt: iso(-10) })))
      case '/api/notices/deadlines':
        return ok(notices.filter((n) => n.deadline).sort((a, b) => a.deadline.localeCompare(b.deadline)))
      case '/api/bookmarks':
        return ok(notices.slice(0, 2))
      case '/api/alerts/status':
        return ok({ paused: false, frequency: 'INSTANT' })
      default:
        return route.fulfill({ status: 404 })
    }
  })
}

const browser = await chromium.launch()
async function shot(name, path, { width = 1100, height = 900, lang = 'en', signedIn = false, dark = false } = {}) {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 2,
    colorScheme: dark ? 'dark' : 'light',
  })
  await context.addInitScript((l) => localStorage.setItem('lang', l), lang)
  const page = await context.newPage()
  await demoApi(page, { signedIn })
  await page.goto(BASE + path)
  await page.waitForLoadState('networkidle')
  await page.screenshot({ path: OUT + name })
  await context.close()
  console.log('saved', name)
}

await shot('notices.png', '/')
await shot('notice.png', `/notices/${detail.id}`, { height: 1000 })
await shot('alerts.png', '/alerts', { signedIn: true, height: 700 })
await shot('deadlines.png', '/deadlines', { height: 700 })
await shot('notices-ko.png', '/', { lang: 'ko' })
if (process.env.EXTRA) await shot('mobile-signed-in.png', '/deadlines', { width: 375, height: 700, signedIn: true })
await shot('mobile-dark.png', '/', { width: 390, height: 844, dark: true })
await browser.close()
