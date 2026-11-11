import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * 图片查看变换（缩放 / 平移）的共享状态机，供 lightbox-grid 全屏查看器与
 * PersonFileBrowser 图片预览弹窗复用。旋转角度 rot 由调用方持有（useState），
 * 以便 setRot 与外框/元素盒的重算在同一 tick 批处理，避免单帧错配闪烁。
 *
 * 模型：变换是普通 React state，以 CSS transform 作用于图片元素自身，
 * 与外层容器的开合/拖拽动画完全解耦。调用方传入 frame = 缩放内容铺满的
 * 窗口（旋转后重新适配的外框），平移边界即 |pan| <= (zoom-1) * frame / 2。
 * 元素盒与 rot 的关系由调用方按 viewBox() 计算：rot 为 90 的奇数倍时元素盒
 * 与外框交换宽高，rotate 后恰好铺满外框。
 *
 * wheel 必须用原生非 passive 监听（React 的 onWheel 在 root 上是 passive，
 * preventDefault 无效）——沿用 CropDialog.tsx 的 callback ref 惯用法。
 */

export interface Frame {
  width: number
  height: number
}

export interface ImageViewState {
  zoom: number
  panX: number
  panY: number
}

/** 供 viewTransform 使用：状态 + 调用方的旋转角 */
export type ImageViewTransformState = ImageViewState & { rot: number }

export const MIN_ZOOM = 1
export const MAX_ZOOM = 6

const IDENTITY: ImageViewState = { zoom: 1, panX: 0, panY: 0 }

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

function clampPan(panX: number, panY: number, zoom: number, frame: Frame) {
  const maxX = ((zoom - 1) * frame.width) / 2
  const maxY = ((zoom - 1) * frame.height) / 2
  return { panX: clamp(panX, -maxX, maxX), panY: clamp(panY, -maxY, maxY) }
}

/** rot 为奇数倍 90° 时图片元素盒与外框交换宽高 */
export function viewBox(frame: Frame, rot: number): Frame {
  return rot % 180 !== 0
    ? { width: frame.height, height: frame.width }
    : { width: frame.width, height: frame.height }
}

/** 图片元素的 transform：平移 + 缩放 + 旋转（居中由父级 flex 完成，
 *  避免百分比 translate 在合成层上产生小数偏移）。
 *  scale 默认取 view.zoom；调用方按精确光栅做 1:1 展示时传实际比例。 */
export function viewTransform(v: ImageViewTransformState, scale: number = v.zoom) {
  return `translate(${v.panX}px, ${v.panY}px) scale(${scale}) rotate(${v.rot}deg)`
}

interface Options {
  /** 缩放内容铺满的窗口尺寸（旋转后重新适配的外框）；未知时传 null 跳过平移钳制 */
  frame: Frame | null
  /** 原图 1:1 像素显示对应的 zoom 值（自然像素 / 屏幕像素）；未知时传 null */
  oneToOne?: number | null
  reduceMotion?: boolean | null
}

export function useImageView({ frame, oneToOne = null, reduceMotion }: Options) {
  const [view, setView] = useState<ImageViewState>(IDENTITY)
  const viewRef = useRef(view)
  viewRef.current = view
  const frameRef = useRef(frame)
  frameRef.current = frame
  const oneToOneRef = useRef(oneToOne)
  oneToOneRef.current = oneToOne

  /** 缩放界限：下限可缩到适配的 20%（并容纳更小的原图），上限至少 6 倍适配 / 2 倍原图 */
  const bounds = () => {
    const o = oneToOneRef.current
    return {
      min: 0.2 * (o != null ? Math.min(1, o) : 1),
      max: o != null ? Math.max(6, o * 2) : 6,
    }
  }
  const raf = useRef(0)
  const wheelEl = useRef<HTMLDivElement | null>(null)
  const enabledRef = useRef<() => boolean>(() => true)

  useEffect(() => () => cancelAnimationFrame(raf.current), [])

  const normalize = useCallback((raw: ImageViewState): ImageViewState => {
    const b = bounds()
    const zoom = clamp(raw.zoom, b.min, b.max)
    const pan =
      zoom <= 1 + 1e-3
        ? { panX: 0, panY: 0 }
        : frameRef.current
          ? clampPan(raw.panX, raw.panY, zoom, frameRef.current)
          : { panX: raw.panX, panY: raw.panY }
    return { zoom, ...pan }
  }, [])

  const stop = useCallback(() => cancelAnimationFrame(raf.current), [])

  /** 立即落位（wheel、拖拽平移） */
  const set = useCallback(
    (next: (v: ImageViewState) => ImageViewState) => {
      stop()
      setView((v) => normalize(next(v)))
    },
    [normalize, stop]
  )

  /** rAF 补间（按钮缩放 / 复位），reduceMotion 时直接落位 */
  const animateTo = useCallback(
    (target: ImageViewState, ms = 180) => {
      stop()
      const to = normalize(target)
      if (reduceMotion) {
        setView(to)
        return
      }
      const from = viewRef.current
      const t0 = performance.now()
      const tick = (t: number) => {
        const k = Math.min(1, (t - t0) / ms)
        const e = 1 - (1 - k) ** 3
        setView(
          normalize({
            zoom: from.zoom + (to.zoom - from.zoom) * e,
            panX: from.panX + (to.panX - from.panX) * e,
            panY: from.panY + (to.panY - from.panY) * e,
          })
        )
        if (k < 1) raf.current = requestAnimationFrame(tick)
      }
      raf.current = requestAnimationFrame(tick)
    },
    [normalize, reduceMotion, stop]
  )

  /** 以 center（相对外框中心的屏幕像素偏移）为锚点立即缩放 */
  const zoomAt = useCallback(
    (factor: number, center: { x: number; y: number }) => {
      set((v) => {
        const b = bounds()
        const zoom = clamp(v.zoom * factor, b.min, b.max)
        const k = zoom / v.zoom
        return {
          zoom,
          panX: center.x - (center.x - v.panX) * k,
          panY: center.y - (center.y - v.panY) * k,
        }
      })
    },
    [set]
  )

  /** 按钮步进缩放（以中心为锚点，补间） */
  const zoomStep = useCallback(
    (dir: 1 | -1) => {
      const v = viewRef.current
      const b = bounds()
      const zoom = clamp(v.zoom * (dir > 0 ? 1.25 : 0.8), b.min, b.max)
      const k = zoom / v.zoom
      animateTo({ zoom, panX: v.panX * k, panY: v.panY * k })
    },
    [animateTo]
  )

  /** 旋转时按 oneToOne 的变化同比调整 zoom，保持屏幕上的实际放大比例不变 */
  const rescaleZoom = useCallback(
    (factor: number) => {
      if (!Number.isFinite(factor) || factor <= 0) return
      set((v) => ({ ...v, zoom: v.zoom * factor }))
    },
    [set]
  )

  /** 适合屏幕(1) 与原图大小(oneToOne) 两模式互切 */
  const toggleFit = useCallback(() => {
    const o = oneToOneRef.current
    if (o == null) return
    const v = viewRef.current
    const atOne = Math.abs(v.zoom - o) < 0.01 * Math.max(1, o)
    animateTo({ zoom: atOne ? 1 : o, panX: 0, panY: 0 })
  }, [animateTo])

  /** 复位缩放与平移（旋转由调用方保留），补间 */
  const reset = useCallback(() => {
    animateTo(IDENTITY)
  }, [animateTo])

  /** 开合 / 翻页 / 关闭 / 旋转时立即回到恒等态或仅清平移 */
  const resetAll = useCallback(() => {
    stop()
    setView(IDENTITY)
  }, [stop])

  const clearPan = useCallback(() => {
    stop()
    setView((v) => ({ ...v, panX: 0, panY: 0 }))
  }, [stop])

  /** 拖拽平移：绝对落位（调用方保存按下时的 pan 起点） */
  const setPan = useCallback(
    (panX: number, panY: number) => {
      set((v) => ({ ...v, panX, panY }))
    },
    [set]
  )

  /** 稳定引用：React 的 onWheel 在 root 上是 passive，必须原生非 passive 监听 */
  const onWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault()
      if (!enabledRef.current()) return
      const el = wheelEl.current
      if (!el) return
      const r = el.getBoundingClientRect()
      // deltaMode: 0=像素 1=行(Firefox) 2=页，归一到像素再算倍率
      const delta =
        e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * 100 : e.deltaY
      const factor = clamp(Math.exp(-delta * 0.0018), 0.5, 2)
      zoomAt(factor, {
        x: e.clientX - (r.left + r.width / 2),
        y: e.clientY - (r.top + r.height / 2),
      })
    },
    [zoomAt]
  )

  /**
   * callback ref：给图片外框元素挂 / 摘 wheel 监听。
   * ref 回调必须稳定（缩放时 60fps 重渲染，内联箭头会反复 detach/attach）；
   * enabled 门控（如开合动画未落定）经 ref 传入，避免闭包过期。
   */
  const attachWheel = useCallback(
    (node: HTMLDivElement | null, enabled?: () => boolean) => {
      if (enabled) enabledRef.current = enabled
      const prev = wheelEl.current
      if (prev && prev !== node) {
        prev.removeEventListener('wheel', onWheel)
      }
      wheelEl.current = node
      if (node) {
        node.addEventListener('wheel', onWheel, { passive: false })
      }
    },
    [onWheel]
  )

  // StrictMode 开发环境下 effect 双调用（setup→cleanup→setup）会把 ref 回调里
  // 挂的监听剥掉，这里按 wheelEl.current 补挂；addEventListener 对同函数同选项
  // 去重，与 ref 回调重叠挂载是安全的。卸载时 cleanup 与 ref(null) 各自摘除。
  useEffect(() => {
    const el = wheelEl.current
    if (!el) return
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [onWheel])

  const zoomed = view.zoom > 1 + 1e-3
  const b = bounds()
  const isOneToOne = oneToOne != null && Math.abs(view.zoom - oneToOne) < 0.01 * Math.max(1, oneToOne)
  return {
    ...view,
    zoomed,
    /** 相对原图自然像素的百分比 */
    percent:
      oneToOne != null ? Math.round((view.zoom / oneToOne) * 100) : Math.round(view.zoom * 100),
    isOneToOne,
    canToggle: oneToOne != null && Math.abs(oneToOne - 1) > 0.01,
    canZoomIn: view.zoom < b.max - 1e-3,
    canZoomOut: view.zoom > b.min + 1e-3,
    canReset: zoomed,
    zoomStep,
    rescaleZoom,
    toggleFit,
    reset,
    resetAll,
    clearPan,
    setPan,
    attachWheel,
  }
}

export type ImageViewApi = ReturnType<typeof useImageView>
