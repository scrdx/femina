import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * 传统页码分页：上一页 / 页码窗口（首尾 + 当前邻页，其余省略号）/ 下一页。
 * 页码从 1 起。
 */

function pageWindow(page: number, pages: number): (number | '…')[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1)
  const set = new Set<number>([1, pages, page - 1, page, page + 1])
  if (page <= 3) [2, 3, 4].forEach((n) => set.add(n))
  if (page >= pages - 2) [pages - 1, pages - 2, pages - 3].forEach((n) => set.add(n))
  const nums = [...set].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b)
  const out: (number | '…')[] = []
  let prev = 0
  for (const n of nums) {
    if (prev && n - prev > 1) out.push('…')
    out.push(n)
    prev = n
  }
  return out
}

export default function Pagination({
  page,
  pages,
  total,
  onChange,
  className,
}: {
  page: number
  pages: number
  total: number
  onChange: (page: number) => void
  className?: string
}) {
  if (pages <= 1) return null
  const btn =
    'flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-sm transition-colors ' +
    'text-muted-foreground hover:bg-accent/60 hover:text-foreground disabled:pointer-events-none disabled:opacity-40'
  return (
    <nav
      aria-label="分页"
      className={cn('flex flex-wrap items-center justify-start gap-1 py-6', className)}
    >
      <button
        type="button"
        className={btn}
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        aria-label="上一页"
      >
        <ChevronLeft className="size-4" />
      </button>
      {pageWindow(page, pages).map((n, i) =>
        n === '…' ? (
          <span key={`gap-${i}`} className="px-1 text-sm text-muted-foreground">
            …
          </span>
        ) : (
          <button
            type="button"
            key={n}
            aria-current={n === page ? 'page' : undefined}
            className={cn(
              btn,
              'tabular-nums',
              n === page && 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground'
            )}
            onClick={() => onChange(n)}
          >
            {n}
          </button>
        )
      )}
      <button
        type="button"
        className={btn}
        disabled={page >= pages}
        onClick={() => onChange(page + 1)}
        aria-label="下一页"
      >
        <ChevronRight className="size-4" />
      </button>
      <span className="ml-3 text-xs text-muted-foreground tabular-nums">共 {total} 项</span>
    </nav>
  )
}
