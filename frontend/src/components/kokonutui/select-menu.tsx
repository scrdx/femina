import { AnimatePresence, motion } from 'motion/react'
import { Check, ChevronDown, Plus } from 'lucide-react'
import { useState } from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

/**
 * 通用单选下拉菜单。
 * 仿照 kokonut ai-prompt（@kokonutui/ai-prompt）中 ModelMenu 的写法：
 * 触发器标签 blur 切换、chevron 旋转、菜单项带 Check 标记；
 * 额外支持 allowCustom：菜单顶部可输入，用于筛选或直接提交自定义值。
 */

export interface SelectOption {
  value: string
  description?: string
}

export interface SelectMenuProps {
  value: string
  onChange: (value: string) => void
  options: (string | SelectOption)[]
  placeholder?: string
  /** 菜单内的小标题 */
  label?: string
  /** 允许输入自定义值（菜单顶部搜索框，无匹配时可「使用 "xx"」） */
  allowCustom?: boolean
  className?: string
  disabled?: boolean
  /** 无边框变体：嵌入 FieldShell 输入组时使用 */
  bare?: boolean
}

const EASE_OUT = [0.23, 1, 0.32, 1] as const

export default function SelectMenu({
  value,
  onChange,
  options,
  placeholder = '请选择',
  label,
  allowCustom,
  className,
  disabled,
  bare,
}: SelectMenuProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const normalized: SelectOption[] = options.map((o) =>
    typeof o === 'string' ? { value: o } : o
  )
  const kw = query.trim().toLowerCase()
  const filtered = kw
    ? normalized.filter((o) => o.value.toLowerCase().includes(kw))
    : normalized
  const exact = normalized.some((o) => o.value === query.trim())

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) setQuery('')
      }}
    >
      <DropdownMenuTrigger asChild disabled={disabled}>
        <button
          type="button"
          className={cn(
            bare
              ? 'group flex w-full min-w-0 flex-1 items-center justify-between gap-2 bg-transparent px-2.5 text-left text-sm'
              : cn(
                  'group flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-input bg-background px-3 text-left text-sm',
                  'transition-[background-color,border-color,color] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)]',
                  'hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-hidden',
                  'disabled:pointer-events-none disabled:opacity-50'
                ),
            className
          )}
        >
          {/* 只有文字切换，chevron 保持不动 */}
          <span className="relative inline-grid min-w-0 flex-1">
            <AnimatePresence initial={false} mode="popLayout">
              <motion.span
                animate={{ opacity: 1, filter: 'blur(0px)' }}
                exit={{ opacity: 0, filter: 'blur(2px)' }}
                initial={{ opacity: 0, filter: 'blur(2px)' }}
                key={value || 'placeholder'}
                transition={{ duration: 0.15, ease: EASE_OUT }}
                className={cn(
                  'col-start-1 row-start-1 truncate',
                  !value && 'text-muted-foreground'
                )}
              >
                {value || placeholder}
              </motion.span>
            </AnimatePresence>
          </span>
          <ChevronDown
            aria-hidden="true"
            className="size-3.5 shrink-0 opacity-50 transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] group-data-[state=open]:rotate-180"
          />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="start"
        sideOffset={6}
        className={cn(
          'min-w-[var(--radix-dropdown-menu-trigger-width)] rounded-lg border-border bg-popover p-1',
          'shadow-[0_8px_24px_-8px_rgb(0_0_0/0.18)] dark:bg-zinc-900'
        )}
      >
        {allowCustom && (
          <div className="px-1 pt-1 pb-1.5">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              placeholder="搜索或输入自定义值…"
              className="h-8 w-full rounded-md border border-input bg-background px-2.5 text-xs outline-none placeholder:text-muted-foreground focus:border-ring"
            />
          </div>
        )}
        {label && (
          <DropdownMenuLabel className="px-2 pt-1 pb-1 text-[11px] font-normal text-black/40 dark:text-white/40">
            {label}
          </DropdownMenuLabel>
        )}
        {allowCustom && kw && !exact && (
          <DropdownMenuItem
            className="flex items-center gap-2.5 rounded-md px-2 py-1.5"
            onSelect={() => onChange(query.trim())}
          >
            <Plus aria-hidden="true" className="size-3.5 shrink-0 opacity-60" />
            <span className="min-w-0 flex-1 truncate text-sm">使用 “{query.trim()}”</span>
          </DropdownMenuItem>
        )}
        {filtered.length === 0 && !(allowCustom && kw && !exact) && (
          <div className="px-2 py-3 text-center text-xs text-muted-foreground">无匹配项</div>
        )}
        {filtered.map((opt) => (
          <DropdownMenuItem
            className="flex items-center gap-2.5 rounded-md px-2 py-1.5"
            key={opt.value}
            onSelect={() => onChange(opt.value)}
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm">{opt.value}</span>
              {opt.description && (
                <span className="block truncate text-[11px] text-black/45 dark:text-white/45">
                  {opt.description}
                </span>
              )}
            </span>
            <Check
              aria-hidden="true"
              className={cn('size-3.5 shrink-0', opt.value !== value && 'invisible')}
            />
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
