import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, Folder, Image as ImageIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitleBar,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { fsApi, previewUrl } from '../api'
import type { FsListResult } from '../api/types'

interface Props {
  mode: 'dir' | 'image'
  initialPath?: string | null
  title?: string
  onPick: (absPath: string) => void
  onClose: () => void
}

/**
 * 服务端目录浏览器（只读）。
 * - mode=dir：选择目录（点击「选择此目录」确认当前目录）
 * - mode=image：在目录中选择一张图片作为封面（点击图片即选中）
 */
export default function FileBrowser({ mode, initialPath, title, onPick, onClose }: Props) {
  const [path, setPath] = useState<string | null>(initialPath || null)
  const [data, setData] = useState<FsListResult | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(
    async (p: string | null) => {
      setLoading(true)
      try {
        const r = await fsApi.list(p, mode)
        setData(r)
      } catch (e: any) {
        toast.error(e.message || '无法打开目录')
      } finally {
        setLoading(false)
      }
    },
    [mode]
  )

  useEffect(() => {
    load(path)
  }, [path, load])

  const clickNode = (nodePath: string, isDir: boolean, isImage: boolean) => {
    if (isDir) setPath(nodePath)
    else if (mode === 'image' && isImage) onPick(nodePath)
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl gap-0 p-0 sm:max-w-2xl" showCloseButton={false}>
        <DialogTitleBar title={title || (mode === 'dir' ? '选择媒体目录' : '选择封面图片')} />
        <div className="p-4">

        <div className="mb-3 flex min-h-10 items-center gap-2 rounded-lg border border-border bg-muted/60 px-3 py-2">
          <Button
            variant="ghost"
            size="sm"
            className="px-3 text-muted-foreground"
            disabled={loading || !data?.current}
            onClick={() => setPath(data?.parent ?? null)}
          >
            <ArrowLeft className="size-4" /> 上级
          </Button>
          <span className="flex-1 break-all font-mono text-xs text-muted-foreground">
            {data?.current || '请选择磁盘 / 根目录'}
          </span>
        </div>

        <ScrollArea className="max-h-[46vh] min-h-[220px] rounded-lg border border-border bg-card">
          {loading ? (
            <div className="p-10 text-center text-sm text-muted-foreground">载入中…</div>
          ) : !data || data.nodes.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              {data?.current ? '此目录为空' : '正在列出可用磁盘…'}
            </div>
          ) : (
            data.nodes.map((n) => (
              <button
                key={n.path}
                type="button"
                className="flex w-full items-center gap-3 border-b border-border px-4 py-2.5 text-left text-sm transition-colors last:border-b-0 hover:bg-accent/60"
                onClick={() => clickNode(n.path, n.dir, n.image)}
              >
                {n.dir ? (
                  <Folder className="size-[18px] shrink-0 text-zinc-500 dark:text-zinc-400" />
                ) : n.image ? (
                  <img
                    className="size-9 shrink-0 rounded-md object-cover"
                    src={previewUrl(n.path)}
                    alt=""
                    loading="lazy"
                  />
                ) : (
                  <ImageIcon className="size-[18px] shrink-0 text-muted-foreground" />
                )}
                <span className="flex-1 break-all text-foreground">{n.name}</span>
                {mode === 'image' && !n.dir && n.image && (
                  <span className="text-xs text-primary">选择</span>
                )}
              </button>
            ))
          )}
        </ScrollArea>

        {mode === 'image' && (
          <p className="text-xs text-muted-foreground">
            点击目录进入，点击图片选为封面。仅显示受支持的图片格式。
          </p>
        )}

        </div>
        <DialogFooter className="mx-0 mb-0">
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          {mode === 'dir' && (
            <Button
              disabled={!data?.current}
              onClick={() => data?.current && onPick(data.current)}
            >
              选择此目录
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
