import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * 输入组：左侧按钮样式的文案块 + 右侧输入控件，连体为一个边框组件。
 * 必填标识为文案后的 * 号。
 */
export function FieldShell({
  label,
  required,
  children,
  right,
  className,
  labelTop,
}: {
  label: string
  required?: boolean
  children: ReactNode
  /** 连接在输入区右侧的附加块（按钮/开关等） */
  right?: ReactNode
  className?: string
  /** 多行控件（textarea）时文案块顶部对齐 */
  labelTop?: boolean
}) {
  return (
    <div
      className={cn(
        'flex min-h-8 w-full items-stretch overflow-hidden rounded-lg border border-input bg-background',
        'transition-[color,box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/30',
        className
      )}
    >
      <span
        className={cn(
          'flex shrink-0 select-none items-center gap-0.5 whitespace-nowrap border-r border-border bg-muted/70 px-2.5 text-xs font-medium text-muted-foreground',
          labelTop && 'items-start py-2'
        )}
      >
        {label}
        {required && (
          <span aria-label="必填" className="text-destructive">
            *
          </span>
        )}
      </span>
      {children}
      {right}
    </div>
  )
}

/** 输入组内的无边框文本输入（不设纵向 padding，保证垂直居中） */
export function ShellInput({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        'min-w-0 flex-1 bg-transparent px-2.5 text-sm text-foreground outline-none',
        'placeholder:text-muted-foreground',
        className
      )}
    />
  )
}
