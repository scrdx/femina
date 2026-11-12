import { useState, type KeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, Pin, PinOff, Star } from 'lucide-react'
import CardFlip from '@/components/kokonutui/card-flip'
import PinnedFold from '@/components/PinnedFold'
import StarRating, { starTone } from '@/components/StarRating'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { mediaThumbUrl } from '../api'
import { cn } from '@/lib/utils'
import { chipStyle, tagHues } from '@/lib/tagColor'
import type { PersonSummary } from '../api/types'

interface Props {
  person: PersonSummary
  /** 右键菜单「快捷打分」：rating 为 0 表示清除评分 */
  onRate?: (id: string, rating: number) => void
  /** 右键菜单「固定 / 取消固定」 */
  onTogglePin?: (id: string) => void
  /**
   * 菜单开合上报。Radix 的右键菜单锚定在「点击那一刻的虚拟坐标点」上而不是卡片元素，
   * 所以首页要把重排推迟到菜单收起，否则卡片会从打开的菜单底下滑走。
   */
  onMenuOpenChange?: (id: string, open: boolean) => void
}

function birthText(p: PersonSummary): string {
  if (p.birthYearOnly) return p.birthYear ? `${p.birthYear} 年` : '—'
  if (p.birthDate) return p.birthDate
  return p.birthYear ? `${p.birthYear} 年` : '—'
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] text-zinc-500 dark:text-zinc-400">{label}</dt>
      <dd className="mt-0.5 truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
        {value}
      </dd>
    </div>
  )
}

/**
 * 海报墙翻卡：正面封面海报，背面档案摘要。
 * 点击/拖拽卡片翻面；卡上的链接按钮进入详情页（不触发翻面）。
 * 右键弹出快捷菜单（打分 / 固定）——CardFlip 的 onPointerDown 对 button!==0 早退，
 * 所以右键不会误触发翻面。正面左上角显示评分星星（未评分不占位），
 * 右上角详情按钮左侧显示固定图钉。
 */
export default function PersonCard({ person, onRate, onTogglePin, onMenuOpenChange }: Props) {
  const [imgOk, setImgOk] = useState(true)
  const [menuOpen, setMenuOpen] = useState(false)
  // 菜单里悬停/聚焦第 n 颗星时的预览：连同前面的星一起点亮
  const [hoverStar, setHoverStar] = useState(0)
  // 防御性兜底：滚动升级时旧后端可能不带这两个字段
  const rating = person.rating ?? 0
  const pinned = !!person.pinned
  const shownStars = hoverStar || rating

  // Radix 菜单的 roving focus 硬编码竖排，←/→ 在竖排菜单里是死键；
  // 星级是横排的一组，这里自己接管左右键（Radix 对这两个键 return undefined，不冲突）
  const onStarKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if ((e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') || e.defaultPrevented) return
    e.preventDefault()
    const nodes = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]'))
    const i = nodes.indexOf(document.activeElement as HTMLElement)
    if (i < 0) return
    nodes[(i + (e.key === 'ArrowRight' ? 1 : -1) + nodes.length) % nodes.length]?.focus()
  }
  // 裁剪版优先，其次原文件流
  // 海报墙用缩略图（后端未配置时 302 回退原图），避免整墙解码原图
  const coverSrc =
    person.coverData || (person.coverPath ? mediaThumbUrl(person.id, person.coverPath) : null)
  const hasCover = !!coverSrc && imgOk
  // 姓名可能未知：正面以昵称为准，昵称也缺省时才回退姓名
  const display = person.nickname || person.name || '佚名'
  const hues = tagHues(person.tags)
  const initial = display.charAt(0)

  const front = (
    <div className="relative h-full w-full">
      {hasCover ? (
        <img
          src={coverSrc!}
          alt={display}
          loading="lazy"
          onError={() => setImgOk(false)}
          className="absolute inset-0 size-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-100 dark:bg-zinc-800">
          <span className="font-semibold text-7xl text-zinc-300 dark:text-zinc-600">{initial}</span>
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent px-4 pb-4 pt-16">
        <div className="text-lg font-semibold leading-tight text-white">{display}</div>
        {person.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {person.tags.slice(0, 3).map((t) => (
              <span
                key={t}
                style={chipStyle(hues[t], true)}
                className="rounded-md border px-2 py-0.5 text-[11px] backdrop-blur-sm"
              >
                {t}
              </span>
            ))}
          </div>
        )}
      </div>
      {/* 固定标记：左上角折角，样式见 PinnedFold */}
      {pinned && <PinnedFold />}
      {/* 评分星星：只有评过分才出现，未评分的卡片左上角保持干净。
          固定时右移让开折角。pointer-events-none 是必需的——角标盖在 CardFlip 上，
          否则会吃掉点击/拖拽翻面 */}
      {rating > 0 && (
        <div
          className={cn(
            'pointer-events-none absolute top-3 flex items-center rounded-md border border-white/15 bg-black/30 px-1.5 py-1 backdrop-blur-[2px] [filter:drop-shadow(0_1px_3px_rgb(0_0_0/0.5))]',
            pinned ? 'left-12' : 'left-3'
          )}
        >
          <StarRating value={rating} onDark size={13} />
        </div>
      )}
      <Link
        to={`/person/${person.id}`}
        aria-label={`查看 ${display} 的详情`}
        className="group/detail absolute right-3 top-3 flex size-9 items-center justify-center rounded-md border border-white/15 bg-black/30 text-white backdrop-blur-[2px] [filter:drop-shadow(0_1px_3px_rgb(0_0_0/0.5))] transition-all duration-300 hover:border-white/40 hover:bg-black/50 focus-visible:outline-2 focus-visible:outline-white/70"
      >
        <ArrowUpRight className="size-4 transition-transform duration-300 group-hover/detail:translate-x-px group-hover/detail:-translate-y-px" />
      </Link>
    </div>
  )

  const back = (
    <div className="flex h-full flex-col p-5">
      <div className="flex items-baseline justify-between gap-2">
        {/* 昵称为必填主显示名；姓名选填，作为次要信息 */}
        <h3 className="truncate text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          {person.nickname || person.name || '未命名'}
        </h3>
        {person.name && person.name !== person.nickname && (
          <span className="shrink-0 text-xs text-zinc-500 dark:text-zinc-400">{person.name}</span>
        )}
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3.5">
        <Field label="出生" value={birthText(person)} />
        <Field label="户籍地" value={person.hometown || '—'} />
        <Field label="学历" value={person.education || '—'} />
        <Field
          label="身高(cm) / 体重(kg)"
          value={
            person.heightCm || person.weightKg
              ? `${person.heightCm ?? '—'} / ${person.weightKg ?? '—'}`
              : '—'
          }
        />
      </dl>

      {person.tags.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {person.tags.slice(0, 4).map((t) => (
            <span
              key={t}
              style={chipStyle(hues[t])}
              className="rounded-md border px-2 py-0.5 text-[11px] font-medium"
            >
              {t}
            </span>
          ))}
        </div>
      )}

      <div className="mt-auto flex flex-col gap-3 pt-4">
        <Link
          to={`/person/${person.id}`}
          className="flex h-10 items-center justify-center gap-1.5 rounded-xl bg-zinc-900 text-sm font-medium text-zinc-50 transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          查看详情与媒体 <ArrowUpRight className="size-4" />
        </Link>
      </div>
    </div>
  )

  return (
    <ContextMenu
      open={menuOpen}
      onOpenChange={(o) => {
        setMenuOpen(o)
        if (!o) setHoverStar(0)
        // 首页据此把重排推迟到菜单收起（菜单锚在虚拟坐标点上，不会跟着卡片走）
        onMenuOpenChange?.(person.id, o)
      }}
    >
      {/* Trigger 用 asChild 挂在普通 div 上：CardFlip 不转发 props/ref，接不住 Radix 注入的事件 */}
      <ContextMenuTrigger asChild>
        <div className="poster-card">
          <CardFlip
            label={`${display} 的档案卡`}
            className="aspect-[2/3] w-full"
            front={front}
            back={back}
          />
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="min-w-44">
        {/* 5 颗星各自是一个 ContextMenuItem：只有 menuitem 才进 Radix 的 roving focus，
            裸 button 用方向键够不着。onSelect 里 preventDefault 让菜单打分后不关闭，
            可以连续调整，也正好和「再点一次当前星级即清除」配合。 */}
        <ContextMenuGroup
          aria-label="评分"
          className="flex items-center gap-0.5 px-1.5 py-1"
          onKeyDown={onStarKeyDown}
        >
          <span className="px-1 text-xs text-muted-foreground">评分</span>
          {[1, 2, 3, 4, 5].map((n) => (
            <ContextMenuItem
              key={n}
              aria-label={rating === n ? `清除评分（当前 ${n} 星）` : `设为 ${n} 星`}
              title={rating === n ? '再次点击清除评分' : `设为 ${n} 星`}
              className="flex-none rounded-md p-1"
              onMouseEnter={() => setHoverStar(n)}
              onFocus={() => setHoverStar(n)}
              onMouseLeave={() => setHoverStar(0)}
              onBlur={() => setHoverStar(0)}
              onSelect={(e) => {
                e.preventDefault()
                onRate?.(person.id, rating === n ? 0 : n)
              }}
            >
              <Star
                aria-hidden="true"
                className={cn('size-4', starTone(n <= shownStars))}
              />
            </ContextMenuItem>
          ))}
        </ContextMenuGroup>
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={() => onTogglePin?.(person.id)}>
          {pinned ? <PinOff className="size-4" /> : <Pin className="size-4" />}
          <span>{pinned ? '取消固定' : '固定在最前'}</span>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
