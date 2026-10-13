import { describe, expect, it } from 'vitest'
import { categoryName, dueLabel, postedLabel, timeAgo } from './labels'

// 2026-10-13 23:30 in Korea is still 2026-10-13 14:30 UTC: labels must follow Korean dates.
const now = new Date('2026-10-13T14:30:00Z')

describe('categoryName', () => {
  it('gives English names for the board categories', () => {
    expect(categoryName('장학')).toBe('Scholarships')
    expect(categoryName('새분류')).toBe('새분류')
    expect(categoryName(null)).toBe('Uncategorized')
  })
})

describe('postedLabel', () => {
  it('says Today and Yesterday in Korean time', () => {
    expect(postedLabel('2026-10-13', now)).toBe('Today')
    expect(postedLabel('2026-10-12', now)).toBe('Yesterday')
    expect(postedLabel('2026-10-01', now)).toBe('Oct 1, 2026')
  })

  it('rolls over at midnight in Korea, not UTC', () => {
    const justAfterMidnightKst = new Date('2026-10-13T15:05:00Z') // 2026-10-14 00:05 KST
    expect(postedLabel('2026-10-14', justAfterMidnightKst)).toBe('Today')
  })
})

describe('dueLabel', () => {
  it('labels upcoming deadlines and hides past ones', () => {
    expect(dueLabel('2026-10-13', now)).toBe('Due today')
    expect(dueLabel('2026-10-14', now)).toBe('Due tomorrow')
    expect(dueLabel('2026-10-20', now)).toBe('Due Oct 20')
    expect(dueLabel('2026-10-12', now)).toBeNull()
    expect(dueLabel(null, now)).toBeNull()
  })
})

describe('Korean labels', () => {
  it('uses Korean words and dates', () => {
    expect(postedLabel('2026-10-13', now, 'ko')).toBe('오늘')
    expect(postedLabel('2026-10-12', now, 'ko')).toBe('어제')
    expect(postedLabel('2026-10-01', now, 'ko')).toBe('2026년 10월 1일')
    expect(dueLabel('2026-10-14', now, 'ko')).toBe('내일 마감')
    expect(dueLabel('2026-10-20', now, 'ko')).toBe('10월 20일 마감')
    expect(categoryName('장학', 'ko')).toBe('장학')
  })
})

describe('timeAgo', () => {
  it('says how long ago in either language', () => {
    expect(timeAgo('2026-10-13T14:29:40Z', now)).toBe('now')
    expect(timeAgo('2026-10-13T14:25:00Z', now)).toBe('5 minutes ago')
    expect(timeAgo('2026-10-13T12:00:00Z', now)).toBe('2 hours ago')
    expect(timeAgo('2026-10-13T14:25:00Z', now, 'ko')).toBe('5분 전')
  })
})
