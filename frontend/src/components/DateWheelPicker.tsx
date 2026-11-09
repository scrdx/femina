import { useState } from 'react'
import { CalendarDays, ChevronDown } from 'lucide-react'
import WheelPicker, { type WheelColumn } from '@/components/kokonutui/wheel-picker'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

/**
 * 出生日期选择器：kokonut WheelPicker（iOS 鼓轮）+ Popover。
 * - mode="date"：年 / 月 / 日 三列鼓轮
 * - mode="year"：仅年份单列鼓轮
 * 值为字符串：'YYYY-MM-DD' 或 'YYYY'，空串表示未填。
 */

const YEAR_MIN = 1940
const YEAR_MAX = 2035

const pad = (n: number) => String(n).padStart(2, '0')

const yearOptions = Array.from({ length: YEAR_MAX - YEAR_MIN + 1 }, (_, i) => {
  const y = YEAR_MIN + i
  return { value: String(y), label: `${y} 年` }
})

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate()
}

interface Props {
  mode: 'date' | 'year'
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  /** 无边框变体：嵌入 FieldShell 输入组时使用 */
  bare?: boolean
}

export default function DateWheelPicker({ mode, value, onChange, placeholder, className, bare }: Props) {
  const [open, setOpen] = useState(false)

  // 解析当前值；未填时鼓轮停在默认位置（不提交）
  const parsed = (() => {
    if (mode === 'date') {
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
      return m
        ? { y: m[1], m: String(Number(m[2])), d: String(Number(m[3])) }
        : { y: '2000', m: '1', d: '1' }
    }
    return { y: value || '2000', m: '1', d: '1' }
  })()

  const columns: WheelColumn[] =
    mode === 'date'
      ? [
          { id: 'y', label: '年', className: 'w-20', options: yearOptions },
          {
            id: 'm',
            label: '月',
            className: 'w-16',
            options: Array.from({ length: 12 }, (_, i) => ({
              value: String(i + 1),
              label: `${i + 1} 月`,
            })),
          },
          {
            id: 'd',
            label: '日',
            className: 'w-16',
            options: Array.from({ length: daysInMonth(Number(parsed.y), Number(parsed.m)) }, (_, i) => ({
              value: String(i + 1),
              label: `${i + 1} 日`,
            })),
          },
        ]
      : [{ id: 'y', label: '年', className: 'w-24', options: yearOptions }]

  const handleValueChange = (next: Record<string, string>) => {
    if (mode === 'year') {
      onChange(next.y)
      return
    }
    const y = Number(next.y)
    const m = Number(next.m)
    const d = Math.min(Number(next.d), daysInMonth(y, m))
    onChange(`${y}-${pad(m)}-${pad(d)}`)
  }

  const display =
    mode === 'date'
      ? value || placeholder || '选择日期'
      : value
        ? `${value} 年`
        : (placeholder ?? '选择年份')

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            bare
              ? 'group flex w-full min-w-0 flex-1 items-center justify-between gap-2 bg-transparent px-2.5 text-left text-sm'
              : cn(
                  'group flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-input bg-background px-3 text-left text-sm',
                  'transition-[background-color,border-color,color] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)]',
                  'hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-hidden'
                ),
            className
          )}
        >
          <span className="flex min-w-0 flex-1 items-center gap-2">
            <CalendarDays className="size-4 shrink-0 opacity-50" />
            <span className={cn('truncate', !value && 'text-muted-foreground')}>{display}</span>
          </span>
          <ChevronDown
            aria-hidden="true"
            className={cn(
              'size-3.5 shrink-0 opacity-50 transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]',
              open && 'rotate-180'
            )}
          />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={6} className="w-auto rounded-lg border-border bg-popover p-4 shadow-[0_8px_24px_-8px_rgb(0_0_0/0.18)]">
        <WheelPicker
          label={mode === 'date' ? '出生日期' : '出生年份'}
          columns={columns}
          value={mode === 'date' ? { y: parsed.y, m: parsed.m, d: parsed.d } : { y: parsed.y }}
          onValueChange={handleValueChange}
        />
      </PopoverContent>
    </Popover>
  )
}
