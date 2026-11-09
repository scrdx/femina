import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { Tags } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitleBar,
} from '@/components/ui/dialog'
import { personApi } from '../api'
import type { Tag } from '../api/types'
import { chipStyle, hueOf } from '@/lib/tagColor'

interface Props {
  open: boolean
  onClose: () => void
  /** 点击标签：直接以标签名搜索 */
  onPick: (name: string) => void
}

const MIN_FONT = 11
const MAX_FONT = 19

/** 字号按使用人数加权（sqrt 缩放，避免热门标签过分碾压） */
function fontSize(count: number, min: number, max: number): number {
  if (max <= min) return (MIN_FONT + MAX_FONT) / 2
  const t = (Math.sqrt(count) - Math.sqrt(min)) / (Math.sqrt(max) - Math.sqrt(min))
  return MIN_FONT + (MAX_FONT - MIN_FONT) * t
}

/**
 * 标签云弹窗：按使用人数决定字号，色彩沿用全站标签哈希色板。
 * 点击任意标签即以该标签为关键字搜索。
 */
export default function TagCloudDialog({ open, onClose, onPick }: Props) {
  const [tags, setTags] = useState<Tag[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    let alive = true
    setLoading(true)
    personApi
      .tags()
      .then((r) => {
        if (!alive) return
        // 热度降序；同热度按名称，保证顺序稳定
        setTags([...r].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)))
      })
      .catch(() => alive && setTags([]))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [open])

  const counts = tags.map((t) => t.count)
  const min = counts.length ? Math.min(...counts) : 0
  const max = counts.length ? Math.max(...counts) : 0

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl gap-0 p-0 sm:max-w-2xl" showCloseButton={false}>
        <DialogTitleBar
          title={
            <span className="flex items-center gap-2">
              <Tags className="size-4 text-primary" /> 标签云
            </span>
          }
        />
        {/* Radix 要求可访问描述，视觉上隐藏 */}
        <DialogDescription className="sr-only">全部标签，点击直接搜索</DialogDescription>
        <div className="p-4">

        {loading ? (
          <div className="py-16 text-center text-sm text-muted-foreground">载入中…</div>
        ) : tags.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            还没有标签，给人物添加标签后会出现在这里
          </div>
        ) : (
          <div className="flex max-h-[56vh] flex-wrap items-center justify-center gap-x-3 gap-y-2.5 overflow-y-auto px-2 py-6">
            {tags.map((t, i) => (
              <motion.button
                key={t.id}
                type="button"
                title={`${t.name} · ${t.count} 人`}
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{
                  delay: Math.min(i * 0.02, 0.5),
                  type: 'spring',
                  stiffness: 380,
                  damping: 24,
                }}
                whileHover={{ scale: 1.12 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => onPick(t.name)}
                style={{
                  ...chipStyle(hueOf(t.name)),
                  fontSize: `${fontSize(t.count, min, max)}px`,
                }}
                className="rounded-md border px-2 py-0.5 font-medium leading-snug transition-shadow hover:shadow-md"
              >
                {t.name}
                <span className="ml-1 align-super text-[0.55em] opacity-60">{t.count}</span>
              </motion.button>
            ))}
          </div>
        )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
