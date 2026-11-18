import { describe, expect, it } from 'vitest'
import { categoryStyle, categoryVars, sortCategories } from './categories'

describe('categories', () => {
  it('puts the known categories in a fixed order and "Other" last', () => {
    expect(sortCategories(['기타', '비교과', '사무', '장학', '취업', '학사', '행사'])).toEqual([
      '학사',
      '장학',
      '취업',
      '행사',
      '비교과',
      '사무',
      '기타',
    ])
  })

  it('gives unknown or missing categories the neutral colour', () => {
    expect(categoryStyle('새분류').hue).toBe(categoryStyle(null).hue)
    expect(categoryStyle('학사').hue).not.toBe(categoryStyle(null).hue)
    expect(categoryVars('장학')).toEqual({ '--c': categoryStyle('장학').hue })
  })
})
