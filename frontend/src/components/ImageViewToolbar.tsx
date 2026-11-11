import type { CSSProperties } from 'react'
import { Maximize, Minimize, RotateCcw, RotateCw, ZoomIn, ZoomOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ImageViewApi } from '@/hooks/useImageView'

/**
 * 图片查看工具栏：缩小 / 百分比 / 放大 ｜ 左转 / 右转 ｜ 适合屏幕⇄原图大小。
 * 整组按钮围在一个深底圆角容器内；观感（bg-white/10 圆钮）与 lightbox-grid
 * 的 IconButton 一致。
 */

function ToolButton({
  label,
  onClick,
  unavailable,
  children,
}: {
  label: string
  onClick: () => void
  unavailable?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      aria-disabled={unavailable || undefined}
      aria-label={label}
      className="flex size-9 items-center justify-center rounded-full text-white transition-[background-color,opacity] duration-150 hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-white/70 aria-disabled:cursor-default aria-disabled:opacity-30 aria-disabled:hover:bg-transparent"
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  )
}

export default function ImageViewToolbar({
  view,
  onRotateCcw,
  onRotateCw,
  className,
  style,
}: {
  view: ImageViewApi
  onRotateCcw: () => void
  onRotateCw: () => void
  className?: string
  style?: CSSProperties
}) {
  return (
    <div
      aria-label="图片查看工具"
      className={cn(
        // 不用 backdrop-blur：大图合成场景下每帧重算背景模糊是掉帧来源
        'flex items-center gap-0.5 rounded-xl bg-zinc-950/80 px-1.5 py-1 ring-1 ring-white/10',
        className
      )}
      role="toolbar"
      style={style}
    >
      <ToolButton
        label="缩小"
        onClick={() => view.zoomStep(-1)}
        unavailable={!view.canZoomOut}
      >
        <ZoomOut className="size-4" />
      </ToolButton>
      <span className="w-12 text-center text-sm text-white/70 tabular-nums">
        {view.percent}%
      </span>
      <ToolButton
        label="放大"
        onClick={() => view.zoomStep(1)}
        unavailable={!view.canZoomIn}
      >
        <ZoomIn className="size-4" />
      </ToolButton>
      <span aria-hidden="true" className="mx-1 h-5 w-px bg-white/15" />
      <ToolButton label="向左旋转" onClick={onRotateCcw}>
        <RotateCcw className="size-4" />
      </ToolButton>
      <ToolButton label="向右旋转" onClick={onRotateCw}>
        <RotateCw className="size-4" />
      </ToolButton>
      <span aria-hidden="true" className="mx-1 h-5 w-px bg-white/15" />
      <ToolButton
        label={view.isOneToOne ? '适合屏幕' : '原图大小'}
        onClick={view.toggleFit}
        unavailable={!view.canToggle}
      >
        {view.isOneToOne ? <Minimize className="size-4" /> : <Maximize className="size-4" />}
      </ToolButton>
    </div>
  )
}
