import { describe, expect, it } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import NoticeDetailPage from './pages/NoticeDetailPage'
import DeadlinesPage from './pages/DeadlinesPage'
import { json, mockApi, renderPage } from './test/helpers'
import type { NoticeDetail, NoticeItem } from './api'

const ENGLISH: Record<string, string> = {
  '장학생 모집 안내': 'Scholarship recruitment notice',
  '장학팀': 'Scholarship Team',
  '신청서.hwp': 'Application form.hwp',
  '신청 기간은 11월 20일까지입니다.': 'Applications are open until November 20.',
  '기숙사 신청': 'Dormitory application',
}

/** The desktop translation endpoint, answering from {@link ENGLISH}; records each request's texts. */
const translator = (requests: string[][]) => async (_url: URL, init?: RequestInit) => {
  const { texts } = JSON.parse(String(init?.body)) as { texts: string[] }
  requests.push(texts)
  return json({ translations: texts.map((t) => ENGLISH[t] ?? t) })
}

const detail: NoticeDetail = {
  id: 9,
  title: '장학생 모집 안내',
  category: '장학',
  department: '장학팀',
  postedOn: '2026-11-01',
  pinned: false,
  sourceUrl: 'https://www.ajou.ac.kr/kr/ajou/notice.do?articleNo=9',
  editedAt: null,
  summary: { status: 'PENDING', titleEn: null, summaryEn: null, deadline: null, deadlineNote: null },
  bodyHtml: '<p>신청 기간은 11월 20일까지입니다.</p>',
  bodyText: '신청 기간은 11월 20일까지입니다.',
  attachments: [{ name: '신청서.hwp', url: 'https://www.ajou.ac.kr/file/9' }],
  firstSeenAt: '2026-11-01T09:00:00Z',
  updatedAt: '2026-11-01T09:00:00Z',
}

const item = (id: number, title: string): NoticeItem => ({
  id,
  title,
  titleEn: null,
  category: '사무',
  department: null,
  postedOn: '2026-11-01',
  deadline: '2099-01-02',
  pinned: false,
  sourceUrl: `https://www.ajou.ac.kr/${id}`,
  editedAt: null,
})

describe('machine translation in the English interface', () => {
  it('shows a notice in English, translated in one request, with the Korean original on request', async () => {
    const requests: string[][] = []
    mockApi({ '/api/notices/9': () => json(detail), '/api/desktop/translate': translator(requests) })
    renderPage(<NoticeDetailPage />, { url: '/notices/9', path: '/notices/:id' })

    // the notice loads first, then the batched translation; the default second is too short when all files run at once
    const heading = await screen.findByRole('heading', { level: 1, name: 'Scholarship recruitment notice' }, { timeout: 5000 })
    expect(heading).toBeInTheDocument()
    expect(screen.getByText('장학생 모집 안내')).toBeInTheDocument()
    expect(screen.getByText('Scholarship Team')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Application form.hwp' })).toHaveAttribute('href', 'https://www.ajou.ac.kr/file/9')
    const body = screen.getByRole('region', { name: 'Notice in English' })
    expect(within(body).getByText('Applications are open until November 20.')).toBeInTheDocument()
    expect(screen.queryByText('신청 기간은 11월 20일까지입니다.')).not.toBeInTheDocument()
    expect(requests).toHaveLength(1)
    expect(requests[0]).toEqual(expect.arrayContaining(['장학생 모집 안내', '장학팀', '신청서.hwp', '신청 기간은 11월 20일까지입니다.']))

    await userEvent.click(screen.getByRole('button', { name: 'Show the Korean original' }))
    expect(screen.getByText('신청 기간은 11월 20일까지입니다.')).toBeInTheDocument()
  })

  it('translates notice titles in lists, keeping the Korean underneath', async () => {
    mockApi({
      '/api/notices/deadlines': () => json([item(1, '기숙사 신청')]),
      '/api/desktop/translate': translator([]),
    })
    renderPage(<DeadlinesPage />, { url: '/deadlines', path: '/deadlines' })

    expect(await screen.findByText('Dormitory application')).toBeInTheDocument()
    expect(screen.getByText('기숙사 신청')).toBeInTheDocument()
  })

  it('sends nothing to translate in the Korean interface', async () => {
    const requests: string[][] = []
    mockApi({
      '/api/notices/deadlines': () => json([item(1, '기숙사 신청')]),
      '/api/desktop/translate': translator(requests),
    })
    renderPage(<DeadlinesPage />, { url: '/deadlines', path: '/deadlines', lang: 'ko' })

    expect(await screen.findByText('기숙사 신청')).toBeInTheDocument()
    expect(screen.queryByText('Dormitory application')).not.toBeInTheDocument()
    expect(requests).toEqual([])
  })
})
