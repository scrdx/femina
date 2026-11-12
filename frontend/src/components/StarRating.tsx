import { useState } from 'react'
import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  /** 当前评分，0 表示未评分 */
  value: number
  /** 点击第 n 颗星回传 n；点击当前已选中的星级回传 0（清除评分） */
  onChange?: (rating: number) => void
  /** display：只读展示，value=0 时整个不渲染；input：可点击，带 hover 预览 */
  variant?: 'display' | 'input'
  /** 单颗星边长 px */
  size?: number
  /** 照片等深色背景上的配色（卡片左上角用） */
  onDark?: boolean
  className?: string
}

/**
 * 星星配色。主题 token 是中性灰（--primary 浅色下近黑，用它会是黑星），所以星星自带暖色；
 * amber 与项目里既有的暖色先例（kokonutui/hold-button.tsx 的 orange 系、card-flip.tsx 的
 * focus ring orange-500）同族。导出给右键菜单里的 ContextMenuItem 复用，避免两处配色漂移。
 *
 * 注意刻意不用 text-*（currentColor）：context-menu item 带
 * `focus:*:[svg]:text-accent-foreground`，高亮时会把所有后代 svg 的 color 强行染成文字色，
 * 用 currentColor 描边会得到「琥珀填充 + 黑描边」的坏效果。改成显式 fill-* + stroke-*：
 * CSS 的 stroke 覆盖 lucide SVG 上的 stroke="currentColor" 呈现属性，且不受那条规则影响。
 */
export function starTone(on: boolean, onDark = false): string {
  if (on) {
    return onDark
      ? 'fill-amber-300 stroke-amber-300'
      : 'fill-amber-500 stroke-amber-500 dark:fill-amber-400 dark:stroke-amber-400'
  }
  return onDark ? 'fill-none stroke-white/45' : 'fill-none stroke-muted-foreground/30'
}

/**
 * 1-5 星评分。一个组件两用：卡片左上角的只读展示（未评分不占位）、编辑弹窗里的可点击输入。
 * 交互约定：点当前已选中的星级即清除评分（回到未评分）。
 * 右键菜单里不用这个组件——那里 5 颗星必须各自是 ContextMenuItem 才能进 Radix 的
 * roving focus（方向键可达），配色走上面导出的 starTone 保持一致。
 */
export default function StarRating({
  value,
  onChange,
  variant = 'display',
  size = 14,
  onDark,
  className,
}: Props) {
  const [hover, setHover] = useState(0)
  // 未评分的卡片保持干净：不渲染空星占位
  if (variant === 'display' && !value) return null

  const input = variant === 'input'
  const shown = input && hover ? hover : value

  return (
    <div
      className={cn(
        'flex items-center',
        input ? 'gap-0.5' : 'gap-px',
        // 只读展示是贴在卡片上的角标，绝不能吃掉 CardFlip 的点击/拖拽翻面
        !input && 'pointer-events-none',
        className
      )}
      onMouseLeave={input ? () => setHover(0) : undefined}
      {...(input ? {} : { role: 'img', 'aria-label': `评分 ${value} 星（满分 5 星）` })}
    >
      {[1, 2, 3, 4, 5].map((n) => {
        const cls = cn('shrink-0 transition-colors duration-150', starTone(n <= shown, onDark))
        if (!input) {
          return <Star key={n} size={size} className={cls} aria-hidden="true" />
        }
        return (
          <button
            key={n}
            type="button"
            // button 已在 CardFlip 的 INTERACTIVE 白名单里，放进卡片也不会误触发翻面
            aria-label={n === value ? `${n} 星（再次点击清除评分）` : `设为 ${n} 星`}
            title={n === value ? '再次点击清除评分' : `设为 ${n} 星`}
            className="-m-0.5 rounded p-0.5 outline-none transition-transform duration-150 hover:scale-110 focus-visible:ring-2 focus-visible:ring-ring/60"
            onMouseEnter={() => setHover(n)}
            onFocus={() => setHover(n)}
            onBlur={() => setHover(0)}
            onClick={() => onChange?.(n === value ? 0 : n)}
          >
            <Star size={size} className={cls} aria-hidden="true" />
          </button>
        )
      })}
    </div>
  )
}
