import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import Highlight from './Highlight'

const marked = (text: string, query?: string) =>
  [...render(<Highlight text={text} query={query} />).container.querySelectorAll('mark')].map((m) => m.textContent)

describe('Highlight', () => {
  it('marks every match, ignoring case', () => {
    expect(marked('Dorm fees and DORM rules', ' dorm ')).toEqual(['Dorm', 'DORM'])
  })

  it('matches Korean inside longer words', () => {
    expect(marked('2학기 장학금 신청 안내', '장학')).toEqual(['장학'])
  })

  it('leaves text alone without a query or a match', () => {
    const { container } = render(<Highlight text="<b>not html</b>" query="zebra" />)
    expect(container.innerHTML).toBe('&lt;b&gt;not html&lt;/b&gt;')
    expect(marked('Library hours')).toEqual([])
  })
})
