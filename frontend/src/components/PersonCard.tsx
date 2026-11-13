import { useState, type KeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, Pin, PinOff, Star } from 'lucide-react'
import CardFlip from '@/components/kokonutui/card-flip'
import StarRating, { starTone } from '@/components/StarRating'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { coverUrl } from '../api'
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
  // 封面统一走 /cover 接口：裁剪结果或缩略图，按 640 档降采样（后端未配置缩略图目录
  // 且无裁剪时 302 回退原图）。列表 JSON 不再内联 base64 封面——110 个人物时那是
  // 几十 MB 的响应体 + 110 次 base64/图像解码，海报墙掉帧的主因之一
  const coverSrc = person.coverPath ? coverUrl(person.id) : null
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
          decoding="async"
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
      {/* 右上角贴边连体条，从右往左依次是 [查看详情][固定][星级]，前两段按需省略：
          都没有时只剩贴边方块，固定时两连，评过分时三连。段间发丝线分隔，
          最左一段的左下角用卡片同半径圆角（悬空的直角最突兀），相接处保持直角。
          整条 pointer-events-none，只有 Link 重新打开指针事件——星星/图钉区不能吃掉翻面 */}
      <div className="pointer-events-none absolute right-0 top-0 flex items-stretch">
        {rating > 0 && (
          // 星级在就一定是最左段，圆角恒加； pinned 只影响它右边还有没有图钉段
          <div className="flex h-9 items-center rounded-bl-xl border-r border-white/10 bg-black/45 px-1.5">
            <StarRating value={rating} onDark size={12} />
          </div>
        )}
        {pinned && (
          <div
            role="img"
            aria-label="已固定，恒排在最前"
            title="已固定，恒排在最前"
            className={cn(
              'flex h-9 w-8 items-center justify-center border-r border-white/10 bg-black/45',
              rating === 0 && 'rounded-bl-xl'
            )}
          >
            <Pin className="size-3.5 text-white/85" />
          </div>
        )}
        <Link
          to={`/person/${person.id}`}
          aria-label={`查看 ${display} 的详情`}
          className={cn(
            'pointer-events-auto flex size-9 items-center justify-center bg-black/45 text-white transition-colors duration-200 hover:bg-black/65 focus-visible:-outline-offset-2 focus-visible:outline-2 focus-visible:outline-white/70',
            // 既没评分也没固定时，方块自己就是最左段，左下圆角同样要有
            rating === 0 && !pinned && 'rounded-bl-xl'
          )}
        >
          <ArrowUpRight className="size-4" />
        </Link>
      </div>
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
