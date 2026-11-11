import { useEffect, useRef, useState } from 'react'
import { viewTransform } from '@/hooks/useImageView'

/**
 * 按显示分辨率精确光栅化展示图片：canvas 位图 = 显示尺寸 × dpr，
 * 静止时 scale 恒为 1，浏览器不做任何 GPU 缩放——超大原图（相机 24MP）
 * 被缩放光栅化时部分平台会出现横线伪影，此法从根上移除该条件。
 *
 * - 缩放过程中用上一份光栅做温和 scale 过渡，停稳 debounce 后重光栅；
 * - 每张图片维护 mipmap 金字塔缓存（步进减半），重复缩放只画最后一步；
 * - 无 toBlob / objectURL / 二次解码（旧管线的掉帧主因）；
 * - 首帧光栅就绪前用原图 <img> 兜底（开合飞行不留空窗）。
 */

const RASTER_MAX = 4096
const DEBOUNCE_MS = 160
const PYRAMID_CACHE_MAX = 2

interface Pyramid {
  natW: number
  natH: number
  /** levels[i] = 自然尺寸 / 2^(i+1) */
  levels: HTMLCanvasElement[]
}

const pyramids = new Map<string, Pyramid>()

function drawTo(
  source: CanvasImageSource,
  tw: number,
  th: number
): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = tw
  c.height = th
  const ctx = c.getContext('2d')
  if (ctx) {
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(source, 0, 0, tw, th)
  }
  return c
}

/** 确保金字塔建到「最大边 <= targetMax 的首层」为止，返回可作为绘制源的最深层 */
function ensureLevels(img: HTMLImageElement, p: Pyramid, targetMax: number) {
  while (true) {
    const i = p.levels.length
    const lw = Math.ceil(p.natW / 2 ** (i + 1))
    const lh = Math.ceil(p.natH / 2 ** (i + 1))
    if (Math.max(lw, lh) < targetMax || lw < 2 || lh < 2) break
    const src = i === 0 ? img : p.levels[i - 1]
    p.levels.push(drawTo(src, lw, lh))
  }
}

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const im = new Image()
    im.onload = () => resolve(im)
    im.onerror = () => reject(new Error('load failed'))
    im.src = src
  })
}

const imgCache = new Map<string, Promise<HTMLImageElement>>()
function cachedImg(src: string) {
  let p = imgCache.get(src)
  if (!p) {
    p = loadImg(src)
    imgCache.set(src, p)
    if (imgCache.size > 24) {
      const oldest = imgCache.keys().next().value
      if (oldest !== undefined) imgCache.delete(oldest)
    }
  }
  return p
}

interface Props {
  src: string
  natW: number
  natH: number
  /** 显示尺寸（css px），= 适配盒 × zoom */
  displayW: number
  displayH: number
  panX: number
  panY: number
  rot: number
  alt: string
  className?: string
}

export default function RasterImage({
  src,
  natW,
  natH,
  displayW,
  displayH,
  panX,
  panY,
  rot,
  alt,
  className,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [rasterW, setRasterW] = useState(0)
  const gen = useRef(0)
  const dpr = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1

  // 目标光栅尺寸（设备像素），保持显示宽高比
  let rw = Math.min(RASTER_MAX, Math.max(1, Math.round(displayW * dpr)))
  let rh = Math.max(1, Math.round(rw * (displayH / Math.max(1, displayW))))
  if (rh > RASTER_MAX) {
    const kk = RASTER_MAX / rh
    rh = RASTER_MAX
    rw = Math.max(1, Math.round(rw * kk))
  }

  useEffect(() => {
    if (!natW || !natH || displayW <= 0 || displayH <= 0) return
    const id = ++gen.current
    const timer = window.setTimeout(() => {
      cachedImg(src)
        .then((img) => {
          if (gen.current !== id) return
          let p = pyramids.get(src)
          if (!p || p.natW !== img.naturalWidth) {
            p = { natW: img.naturalWidth, natH: img.naturalHeight, levels: [] }
            pyramids.set(src, p)
            while (pyramids.size > PYRAMID_CACHE_MAX) {
              const oldest = pyramids.keys().next().value
              if (oldest === undefined) break
              pyramids.delete(oldest)
            }
          }
          ensureLevels(img, p, Math.max(rw, rh))
          // 选最大边仍 >= 目标的最深层做源（比例 <= 2，保证质量）
          let source: CanvasImageSource = img
          for (const lv of p.levels) {
            if (Math.max(lv.width, lv.height) >= Math.max(rw, rh)) source = lv
          }
          const canvas = canvasRef.current
          if (!canvas) return
          canvas.width = rw
          canvas.height = rh
          const ctx = canvas.getContext('2d')
          if (!ctx) return
          ctx.imageSmoothingQuality = 'high'
          ctx.drawImage(source, 0, 0, rw, rh)
          setRasterW(rw)
        })
        .catch(() => {})
    }, DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [src, natW, natH, displayW, displayH, rw, rh])

  // 换图时旧光栅作废，回退原图兜底直到新光栅就绪
  useEffect(() => {
    setRasterW(0)
  }, [src])

  // 卸载时释放该图的金字塔（查看器关闭即回收内存）
  const srcRef = useRef(src)
  srcRef.current = src
  useEffect(
    () => () => {
      pyramids.delete(srcRef.current)
    },
    []
  )

  if (displayW <= 0 || displayH <= 0) return null

  // canvas 必须始终在 DOM 里（光栅绘制的目标），否则 ref 永远为 null；
  // 光栅就绪前在其上叠原图 <img> 兜底（开合飞行不留空窗）
  // 光栅未就绪时 k=1 兜底：css 宽高已把源图缩到显示尺寸（过渡期短暂 GPU
  // 缩放可接受）；此前按自然尺寸算 k 会让兜底帧缩成一小块再跳变
  const k = rasterW ? (displayW * dpr) / rasterW : 1
  return (
    <div
      aria-label={alt}
      className={`relative ${className ?? ''}`}
      role="img"
      style={{
        width: Math.round(displayW),
        height: Math.round(displayH),
        transform: viewTransform({ zoom: k, panX, panY, rot }, k),
      }}
    >
      <canvas className="size-full" ref={canvasRef} />
      {!rasterW && (
        <img
          alt=""
          className="absolute inset-0 size-full object-cover"
          draggable={false}
          src={src}
        />
      )}
    </div>
  )
}
