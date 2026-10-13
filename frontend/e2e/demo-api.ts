import type { Page } from '@playwright/test'

export const notice = {
  id: 375874,
  title: '[학부]2026학년도 2학기 수강포기(수강철회) 안내',
  titleEn: 'Fall 2026 course withdrawal',
  category: '학사',
  department: '학사팀',
  postedOn: '2026-10-12',
  deadline: '2099-10-19',
  pinned: true,
  sourceUrl: 'https://www.ajou.ac.kr/kr/ajou/notice.do?mode=view&articleNo=375874',
  editedAt: null,
}

/** Answers the web app's API calls with fixed data, so the test needs no server or database. */
export async function demoApi(page: Page) {
  await page.route('**/api/**', (route) => {
    const url = new URL(route.request().url())
    const ok = (body: unknown) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
    switch (url.pathname) {
      case '/api/notices': {
        const q = url.searchParams.get('q')
        const items = q && !notice.titleEn.toLowerCase().includes(q.toLowerCase()) ? [] : [notice]
        return ok({ items, page: 0, size: 20, totalItems: items.length, totalPages: 1 })
      }
      case '/api/notices/categories':
        return ok(['학사', '장학'])
      case `/api/notices/${notice.id}`:
        return ok({
          ...notice,
          summary: {
            status: 'DONE',
            titleEn: notice.titleEn,
            summaryEn: 'Undergraduates can withdraw from fall 2026 courses online.',
            deadline: notice.deadline,
            deadlineNote: 'until 17:00',
          },
          bodyHtml: '<p>수강포기 안내</p><img src="/favicon.svg">',
          bodyText: '수강포기 안내',
          attachments: [],
          firstSeenAt: '2026-10-12T00:00:00Z',
          updatedAt: '2026-10-12T00:00:00Z',
        })
      case '/api/me':
        return route.fulfill({ status: 401 })
      case '/api/status':
        return ok({ lastUpdatedAt: new Date().toISOString(), updatesDelayed: false })
      default:
        return route.fulfill({ status: 404 })
    }
  })
}
