import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ChevronRight,
  Clapperboard,
  File as FileIcon,
  FileArchive,
  FileText,
  Folder,
  FolderOpen,
  Image as ImageIcon,
  Music,
  RefreshCw,
} from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import ImageViewToolbar from '@/components/ImageViewToolbar'
import RasterImage from '@/components/RasterImage'
import { useImageView } from '@/hooks/useImageView'
import { mediaUrl, personApi } from '../api'
import type { MediaItem, PersonFileNode } from '../api/types'
import VideoDialog from './VideoDialog'

interface Props {
  personId: string
  mediaDir: string | null
}

/** 文件大小格式化 */
function fmtSize(bytes: number): string {
  if (bytes <= 0) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

const extOf = (name: string) => name.slice(name.lastIndexOf('.') + 1).toLowerCase()

/** 按扩展名细分图标，未命中时回落到类型图标 */
function nodeIcon(n: PersonFileNode) {
  if (n.dir) return <Folder className="size-[18px] shrink-0 text-primary/70" />
  const ext = extOf(n.name)
  if (n.type === 'PHOTO') return <ImageIcon className="size-[18px] shrink-0 text-emerald-600/80" />
  if (n.type === 'VIDEO') return <Clapperboard className="size-[18px] shrink-0 text-sky-600/80" />
  if (['pdf', 'txt', 'md', 'doc', 'docx', 'srt', 'ass'].includes(ext))
    return <FileText className="size-[18px] shrink-0 text-amber-600/80" />
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext))
    return <FileArchive className="size-[18px] shrink-0 text-orange-600/80" />
  if (['mp3', 'flac', 'wav', 'aac', 'm4a', 'ogg'].includes(ext))
    return <Music className="size-[18px] shrink-0 text-pink-600/80" />
  return <FileIcon className="size-[18px] shrink-0 text-muted-foreground" />
}

/**
 * 人物媒体目录的文件浏览视图（只读）。
 * 支持多级目录与任意文件类型：目录点击进入，图片弹窗预览，
 * 视频复用播放弹窗，其余文件新标签页打开（浏览器决定预览或下载）。
 */
export default function PersonFileBrowser({ personId, mediaDir }: Props) {
  // 当前目录的路径段；[] 表示 mediaDir 根目录
  const [segments, setSegments] = useState<string[]>([])
  const [nodes, setNodes] = useState<PersonFileNode[]>([])
  const [loading, setLoading] = useState(false)
  const [photo, setPhoto] = useState<PersonFileNode | null>(null)
  const [video, setVideo] = useState<PersonFileNode | null>(null)

  const relPath = segments.join('/')
  // 根面包屑展示媒体目录的完整绝对路径
  const rootName = mediaDir || '媒体目录'

  const load = useCallback(async () => {
    if (!mediaDir) return
    setLoading(true)
    try {
      setNodes(await personApi.files(personId, relPath))
    } catch (e: any) {
      toast.error(e.message || '读取目录失败')
    } finally {
      setLoading(false)
    }
  }, [personId, mediaDir, relPath])

  useEffect(() => {
    load()
  }, [load])

  if (!mediaDir) {
    return (
      <div className="rounded-xl border border-dashed border-border py-14 text-center text-sm text-muted-foreground">
        该人物未设置媒体目录
      </div>
    )
  }

  const openNode = (n: PersonFileNode) => {
    if (n.dir) {
      setSegments((s) => [...s, n.name])
    } else if (n.type === 'PHOTO') {
      setPhoto(n)
    } else if (n.type === 'VIDEO') {
      setVideo(n)
    } else {
      window.open(mediaUrl(personId, n.relPath), '_blank')
    }
  }

  const videoItem: MediaItem | null = video
    ? {
        id: 0,
        personId,
        type: 'VIDEO',
        width: null,
        height: null,
        modifiedAt: null,
        fileCreatedAt: null,
        createdAt: null,
        relPath: video.relPath,
        fileName: video.name,
        ext: extOf(video.name),
        fileSize: video.size,
      }
    : null

  const dirs = nodes.filter((n) => n.dir).length

  return (
    <div className="min-h-[320px]">
      {/* 面包屑 + 刷新 */}
      <div className="mb-4 flex flex-wrap items-center gap-1.5 text-sm">
        <button
          type="button"
          onClick={() => setSegments([])}
          className={`flex items-center gap-1.5 rounded-md px-2 py-1 transition-colors ${
            segments.length === 0
              ? 'font-medium text-foreground'
              : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
          }`}
        >
          {segments.length === 0 ? (
            <FolderOpen className="size-4 shrink-0 text-primary/70" />
          ) : (
            <Folder className="size-4 shrink-0 text-primary/70" />
          )}
          <span className="break-all font-mono text-xs leading-5">{rootName}</span>
        </button>
        {segments.map((seg, i) => (
          <span key={i} className="flex items-center gap-1.5">
            <ChevronRight className="size-3.5 text-border" />
            <button
              type="button"
              onClick={() => setSegments((s) => s.slice(0, i + 1))}
              className={`rounded-md px-2 py-1 transition-colors ${
                i === segments.length - 1
                  ? 'font-medium text-foreground'
                  : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
              }`}
            >
              <span className="max-w-[240px] truncate">{seg}</span>
            </button>
          </span>
        ))}
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto h-8 px-2.5 text-muted-foreground"
          onClick={load}
          disabled={loading}
        >
          <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} /> 刷新
        </Button>
      </div>

      {/* 文件列表 */}
      {loading && nodes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-14 text-center text-sm text-muted-foreground">
          读取中…
        </div>
      ) : nodes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-14 text-center text-sm text-muted-foreground">
          此目录为空
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          {/* 表头 */}
          <div className="grid grid-cols-[1fr_90px_130px] gap-3 border-b border-border bg-muted/50 px-4 py-2 text-xs font-medium text-muted-foreground sm:grid-cols-[1fr_100px_150px]">
            <span>名称{dirs > 0 && <span className="ml-2 font-normal">（{dirs} 个目录）</span>}</span>
            <span className="text-right">大小</span>
            <span className="hidden text-right sm:block">修改时间</span>
          </div>
          {nodes.map((n) => (
            <button
              key={n.relPath}
              type="button"
              onClick={() => openNode(n)}
              className="grid w-full grid-cols-[1fr_90px_130px] items-center gap-3 border-b border-border/60 px-4 py-2.5 text-left transition-colors last:border-b-0 hover:bg-accent/40 sm:grid-cols-[1fr_100px_150px]"
            >
              <span className="flex min-w-0 items-center gap-2.5">
                {nodeIcon(n)}
                <span
                  className={`truncate text-sm ${
                    n.dir ? 'font-medium text-foreground' : 'text-foreground/90'
                  }`}
                  title={n.name}
                >
                  {n.name}
                </span>
              </span>
              <span className="text-right text-xs tabular-nums text-muted-foreground">
                {n.dir ? '—' : fmtSize(n.size)}
              </span>
              <span className="hidden text-right text-xs tabular-nums text-muted-foreground sm:block">
                {n.modified}
              </span>
            </button>
          ))}
        </div>
      )}
      <p className="mt-3 text-xs text-muted-foreground">
        共 {nodes.length} 项 · 目录内容只读展示，不会改动任何文件
      </p>

      {/* 图片预览弹窗 */}
      <Dialog open={!!photo} onOpenChange={(o) => !o && setPhoto(null)}>
        <DialogContent className="max-w-4xl overflow-hidden border-none bg-black/90 p-0 sm:max-w-4xl sm:rounded-lg">
          <DialogHeader className="sr-only">
            <DialogTitle>{photo?.name ?? '图片预览'}</DialogTitle>
          </DialogHeader>
          {photo && <PhotoPreview key={photo.relPath} node={photo} personId={personId} />}
        </DialogContent>
      </Dialog>

      {/* 视频播放弹窗（复用） */}
      <VideoDialog personId={personId} item={videoItem} onClose={() => setVideo(null)} />
    </div>
  )
}

/**
 * 图片预览舞台：元素盒按自然比例 fitted 到舞台（不用 object-contain 的
 * letterbox），缩放/旋转/平移的外界数学与 lightbox 一致。rot 在此持有，
 * 与元素盒重算同 tick 批处理；放大后拖拽平移。
 */
function PhotoPreview({ personId, node }: { personId: string; node: PersonFileNode }) {
  const stageRef = useRef<HTMLDivElement | null>(null)
  const [stage, setStage] = useState<{ w: number; h: number } | null>(null)
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null)
  const [rot, setRot] = useState(0)
  const drag = useRef<{ id: number; sx: number; sy: number; px: number; py: number } | null>(
    null
  )

  // 舞台可用区（弹窗宽度随视口变化）
  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const measure = () => setStage({ w: el.clientWidth, h: el.clientHeight })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // 预探自然尺寸
  useEffect(() => {
    let alive = true
    const img = new Image()
    img.onload = () => {
      if (alive) setNat({ w: img.naturalWidth, h: img.naturalHeight })
    }
    img.src = mediaUrl(personId, node.relPath)
    return () => {
      alive = false
    }
  }, [personId, node.relPath])

  // 元素盒：自然比例 fitted 到舞台；奇数倍 90° 时先 fitted 到交换后的舞台，
  // rotate 后的视觉外界恰好落在真实舞台内
  const box = useMemo(() => {
    if (!stage || !nat) return null
    const sw = rot % 180 !== 0
    const swStage = sw ? { w: stage.h, h: stage.w } : stage
    const s = Math.min(swStage.w / nat.w, swStage.h / nat.h)
    return { width: nat.w * s, height: nat.h * s }
  }, [stage, nat, rot])

  // 缩放内容铺满的窗口 = 旋转后的视觉外界
  const frame = useMemo(
    () => (box ? (rot % 180 !== 0 ? { width: box.height, height: box.width } : box) : null),
    [box, rot]
  )
  // 原图 1:1 对应的 zoom：水平轴方向的自然像素 / 屏幕像素
  const oneToOne =
    box && nat ? (rot % 180 !== 0 ? nat.h / box.height : nat.w / box.width) : null
  const view = useImageView({ frame, oneToOne })

  // 显示尺寸 = 适配盒 × zoom；光栅化与 1:1 展示由 RasterImage 负责
  const originalSrc = mediaUrl(personId, node.relPath)
  const displayW = box ? box.width * view.zoom : 0
  const displayH = box ? box.height * view.zoom : 0

  const rotateBy = (dir: 1 | -1) => {
    if (!nat || !stage || !box) return
    const next = ((rot + dir * 90) % 360 + 360) % 360
    // 旋转后的元素盒（与 memo 同公式），据此算新 oneToOne
    const sw = next % 180 !== 0
    const st = sw ? { w: stage.h, h: stage.w } : stage
    const s = Math.min(st.w / nat.w, st.h / nat.h)
    const boxNew = { width: nat.w * s, height: nat.h * s }
    const oNew = sw ? nat.h / boxNew.height : nat.w / boxNew.width
    setRot(next)
    // 同比调整 zoom，保持屏幕上的实际放大比例不变
    if (oneToOne && oNew) view.rescaleZoom(oNew / oneToOne)
  }

  // 测量 ref 与 wheel ref 合并成一个稳定 callback ref（缩放时 60fps 重渲染不能抖）
  const stageCbRef = useCallback(
    (node: HTMLDivElement | null) => {
      stageRef.current = node
      view.attachWheel(node)
    },
    [view.attachWheel]
  )

  return (
    <div className="flex flex-col" onPointerDown={(e) => e.stopPropagation()}>
      <div
        className={`relative flex h-[66vh] w-full touch-none select-none items-center justify-center ${
          view.zoomed ? 'cursor-move' : 'cursor-default'
        }`}
        onPointerCancel={(e) => {
          e.stopPropagation()
          drag.current = null
        }}
        onPointerDown={(e) => {
          // 拦住 React 树冒泡，避免底层 smooth-tab 抢指针捕获
          e.stopPropagation()
          if (!view.zoomed || e.button !== 0) return
          e.currentTarget.setPointerCapture(e.pointerId)
          drag.current = {
            id: e.pointerId,
            sx: e.clientX,
            sy: e.clientY,
            px: view.panX,
            py: view.panY,
          }
        }}
        onPointerMove={(e) => {
          const d = drag.current
          if (!d || d.id !== e.pointerId) return
          e.stopPropagation()
          view.setPan(d.px + (e.clientX - d.sx), d.py + (e.clientY - d.sy))
        }}
        onPointerUp={(e) => {
          e.stopPropagation()
          drag.current = null
        }}
        ref={stageCbRef}
      >
        {box && nat && (
          <RasterImage
            alt={node.name}
            className="pointer-events-none max-w-none"
            displayH={displayH}
            displayW={displayW}
            natH={nat.h}
            natW={nat.w}
            panX={view.panX}
            panY={view.panY}
            rot={rot}
            src={originalSrc}
          />
        )}
      </div>
      <div className="flex justify-center py-4">
        <ImageViewToolbar
          onRotateCcw={() => rotateBy(-1)}
          onRotateCw={() => rotateBy(1)}
          view={view}
        />
      </div>
    </div>
  )
}
