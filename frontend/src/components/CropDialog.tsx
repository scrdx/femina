import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitleBar,
} from '@/components/ui/dialog'

interface Props {
  /** 原图地址（预览流或已有 data URL） */
  src: string
  /** 裁剪框宽高比，默认 2:3 海报比例 */
  aspect?: number
  /** 输出图最大宽度（高度按比例），控制入库体积 */
  maxOutputWidth?: number
  onConfirm: (dataUrl: string) => void
  onClose: () => void
}

const MAX_ZOOM = 4

/**
 * 封面裁剪弹窗：固定 2:3 裁剪框，拖动平移、滚轮/滑杆缩放。
 * 缩放上限为铺满裁剪框的 cover 比例；下限可缩小到整图可见（contain），
 * 便于在大尺寸原图上取景。结果以 JPEG data URL 返回、存数据库；
 * 不写回、不改动任何用户媒体文件。
 */
export default function CropDialog({
  src,
  aspect = 2 / 3,
  maxOutputWidth = 720,
  onConfirm,
  onClose,
}: Props) {
  const viewRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const drag = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null)
  const [view, setView] = useState({ w: 0, h: 0 })
  const [nat, setNat] = useState({ w: 0, h: 0 })
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })

  // 裁剪框尺寸测量：Dialog 入场时布局可能未就绪，轮询兜底直到量到真实宽度
  useEffect(() => {
    const el = viewRef.current
    if (!el) return
    let alive = true
    const measure = () => {
      const w = el.clientWidth
      if (alive && w > 0) setView({ w, h: w / aspect })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    let tries = 0
    const timer = window.setInterval(() => {
      measure()
      if (++tries > 20 || el.clientWidth > 0) window.clearInterval(timer)
    }, 50)
    return () => {
      alive = false
      ro.disconnect()
      window.clearInterval(timer)
    }
  }, [aspect, nat.w])

  // cover 基础缩放：铺满裁剪框所需的倍数
  const cover = useMemo(
    () => (nat.w && view.w ? Math.max(view.w / nat.w, view.h / nat.h) : 0),
    [nat.w, nat.h, view.w, view.h]
  )
  // 最小缩放：整图可见（contain），大原图可以缩小取景
  const minZoom = useMemo(() => {
    if (!nat.w || !view.w) return 1
    const contain = Math.min(view.w / nat.w, view.h / nat.h)
    return Math.min(1, contain / cover)
  }, [nat.w, nat.h, view.w, view.h, cover])

  const dispW = nat.w * cover * zoom
  const dispH = nat.h * cover * zoom

  const clampOffset = useCallback(
    (o: { x: number; y: number }, z = zoom) => {
      const w = nat.w * cover * z
      const h = nat.h * cover * z
      const mx = Math.max(0, (w - view.w) / 2)
      const my = Math.max(0, (h - view.h) / 2)
      return {
        x: Math.min(Math.max(o.x, -mx), mx),
        y: Math.min(Math.max(o.y, -my), my),
      }
    },
    [cover, nat.w, nat.h, view.w, view.h, zoom]
  )

  // 缩放后位移可能越界，重新收敛
  useEffect(() => {
    setOffset((o) => clampOffset(o))
  }, [zoom, clampOffset])

  // 滚轮缩放：非 passive 原生监听（React onWheel 是 passive 无法 preventDefault）。
  // Dialog 挂载时序可能导致 effect 阶段拿不到元素，用 callback ref 确保节点就绪即挂上。
  const minZoomRef = useRef(minZoom)
  minZoomRef.current = minZoom
  const wheelCleanup = useRef<() => void>(() => {})
  useEffect(() => () => wheelCleanup.current(), [])
  const viewCbRef = useCallback((el: HTMLDivElement | null) => {
    viewRef.current = el
    wheelCleanup.current()
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      setZoom((z) =>
        Math.min(MAX_ZOOM, Math.max(minZoomRef.current, z - e.deltaY * 0.0015))
      )
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    wheelCleanup.current = () => el.removeEventListener('wheel', onWheel)
  }, [])

  const confirm = () => {
    const img = imgRef.current
    const viewEl = viewRef.current
    if (!img || !viewEl || !nat.w) return
    // 用屏幕矩形反算原图裁剪区域，避免手推变换矩阵出错
    const ir = img.getBoundingClientRect()
    const vr = viewEl.getBoundingClientRect()
    const sx = ((vr.left - ir.left) / ir.width) * nat.w
    const sy = ((vr.top - ir.top) / ir.height) * nat.h
    const sw = (vr.width / ir.width) * nat.w
    const sh = (vr.height / ir.height) * nat.h
    const outW = Math.max(1, Math.min(maxOutputWidth, Math.round(sw)))
    const outH = Math.max(1, Math.round(outW / aspect))
    const canvas = document.createElement('canvas')
    canvas.width = outW
    canvas.height = outH
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    // 缩小到整图可见时裁剪区超出图片范围，先铺底色（drawImage 会按交集裁剪）
    ctx.fillStyle = '#101012'
    ctx.fillRect(0, 0, outW, outH)
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH)
    onConfirm(canvas.toDataURL('image/jpeg', 0.85))
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md gap-0 p-0 sm:max-w-md" showCloseButton={false}>
        <DialogTitleBar title="裁剪封面" />
        <div className="flex flex-col gap-4 p-4">
          <DialogDescription className="text-xs">
            拖动调整位置，滚轮或滑杆缩放；输出 2:3 海报比例，不改动原文件
          </DialogDescription>

        <div
          ref={viewCbRef}
          className="relative mx-auto cursor-grab touch-none select-none overflow-hidden rounded-xl bg-black/90 active:cursor-grabbing"
          style={{ aspectRatio: '2 / 3', width: 'min(300px, 100%)' }}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId)
            drag.current = { px: e.clientX, py: e.clientY, ox: offset.x, oy: offset.y }
          }}
          onPointerMove={(e) => {
            const d = drag.current
            if (!d) return
            setOffset(clampOffset({ x: d.ox + (e.clientX - d.px), y: d.oy + (e.clientY - d.py) }))
          }}
          onPointerUp={() => (drag.current = null)}
          onPointerCancel={() => (drag.current = null)}
        >
          {/* 必须始终渲染才能触发 onLoad；加载完成前隐藏 */}
          <img
            ref={imgRef}
            src={src}
            alt=""
            draggable={false}
            onLoad={(e) => {
              const el = e.currentTarget
              setNat({ w: el.naturalWidth, h: el.naturalHeight })
            }}
            className="absolute left-1/2 top-1/2 max-w-none"
            style={{
              width: dispW || undefined,
              height: dispH || undefined,
              visibility: nat.w > 0 && cover > 0 ? 'visible' : 'hidden',
              transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px)`,
            }}
          />
          {/* 三分线 + 边框，标示裁剪区域 */}
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute inset-y-0 left-1/3 w-px bg-white/25" />
            <div className="absolute inset-y-0 left-2/3 w-px bg-white/25" />
            <div className="absolute inset-x-0 top-1/3 h-px bg-white/25" />
            <div className="absolute inset-x-0 top-2/3 h-px bg-white/25" />
            <div className="absolute inset-0 rounded-xl ring-1 ring-inset ring-white/40" />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="range"
            min={minZoom}
            max={MAX_ZOOM}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="flex-1 accent-primary"
            aria-label="缩放"
          />
          <span className="w-12 text-right text-xs tabular-nums text-muted-foreground">
            {Math.round(zoom * 100)}%
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2.5 text-muted-foreground"
            onClick={() => {
              setZoom(1)
              setOffset({ x: 0, y: 0 })
            }}
            title="重置位置与缩放"
          >
            <RotateCcw className="size-3.5" /> 重置
          </Button>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button onClick={confirm} disabled={!nat.w || !cover}>
            确认裁剪
          </Button>
        </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
