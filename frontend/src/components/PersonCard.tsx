import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import CardFlip from '@/components/kokonutui/card-flip'
import { mediaThumbUrl } from '../api'
import { chipStyle, tagHues } from '@/lib/tagColor'
import type { PersonSummary } from '../api/types'

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
 */
export default function PersonCard({ person }: { person: PersonSummary; index: number }) {
  const [imgOk, setImgOk] = useState(true)
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
    <div className="poster-card">
      <CardFlip
        label={`${display} 的档案卡`}
        className="aspect-[2/3] w-full"
        front={front}
        back={back}
      />
    </div>
  )
}
