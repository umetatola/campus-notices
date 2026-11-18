import { categoryStyle, stroke } from './categories'

export function CategoryIcon({ category, className = 'size-4' }: { category: string | null; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" {...stroke} className={className} aria-hidden="true">
      {categoryStyle(category).icon}
    </svg>
  )
}
