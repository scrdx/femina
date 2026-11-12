import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowDownWideNarrow, ArrowUpNarrowWide } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { toast } from 'sonner'
import Loader from '@/components/kokonutui/loader'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { personApi } from '../api'
import type { SortDir, SortKey } from '../api'
import type { PersonSummary } from '../api/types'
import PersonCard from '../components/PersonCard'
import PersonFormModal from '../components/PersonFormModal'
import TopBar from '../components/TopBar'

const PAGE_SIZE = 24

/** 各排序字段下升/降序的业务语义标签 */
const DIR_LABELS: Record<SortKey, Record<SortDir, string>> = {
  created: { desc: '新→旧', asc: '旧→新' },
  updated: { desc: '新→旧', asc: '旧→新' },
  rating: { desc: '高→低', asc: '低→高' },
  nickname: { desc: 'Z→A', asc: 'A→Z' },
  media: { desc: '多→少', asc: '少→多' },
  firstMeet: { desc: '晚→早', asc: '早→晚' },
  lastMeet: { desc: '晚→早', asc: '早→晚' },
}

export default function HomePage() {
  const [keyword, setKeyword] = useState('')
  const [debounced, setDebounced] = useState('')
  const [items, setItems] = useState<PersonSummary[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  // 静默刷新中（排序/关键字切换）：保留旧卡片做位移动画，仅轻微降透明度提示
  const [refreshing, setRefreshing] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  // 默认按评分从高到低；都没评分时所有人 rating=0 同分，靠 created_at DESC 兜底，
  // 表现与原来的「添加日期」默认序一致，不构成回归
  const [sortBy, setSortBy] = useState<SortKey>('rating')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const firstRun = useRef(true)

  // 搜索防抖
  useEffect(() => {
    const t = setTimeout(() => setDebounced(keyword.trim()), 320)
    return () => clearTimeout(t)
  }, [keyword])

  const load = useCallback(
    async (kw: string, targetPage: number, append: boolean, silent = false) => {
      if (append) setLoadingMore(true)
      else if (silent) setRefreshing(true)
      else setLoading(true)
      try {
        const r = await personApi.list(kw, targetPage, PAGE_SIZE, sortBy, sortDir)
        setItems((prev) => (append ? [...prev, ...r.items] : r.items))
        setTotal(r.total)
        setPage(targetPage)
      } catch (e: any) {
        toast.error(e.message || '加载失败')
      } finally {
        setLoading(false)
        setLoadingMore(false)
        setRefreshing(false)
      }
    },
    [sortBy, sortDir]
  )

  // 关键字或排序变化 → 回到第 1 页；首次进入显示载入动画，之后静默刷新配合卡片动画
  useEffect(() => {
    const silent = !firstRun.current
    firstRun.current = false
    load(debounced, 1, false, silent)
  }, [debounced, load])

  const refresh = () => load(debounced, 1, false)

  /**
   * 本地重排：items 本来就是服务端按 ORDER BY 排好的，所以只需复刻其中会因
   * 快捷操作而变化的两条规则——「p.pinned DESC 前置」和 rating 排序本身。
   * 两次都用稳定排序，保证同组内其余字段（昵称/日期/媒体数…）的既有顺序不被打乱。
   */
  const reorder = (list: PersonSummary[]) => {
    const next = [...list]
    if (sortBy === 'rating') {
      next.sort((a, b) => {
        const ra = a.rating || 0
        const rb = b.rating || 0
        // 未评分（0）恒垫底，方向只作用于评分本身（与后端 (p.rating = 0), p.rating 一致）
        if (!ra !== !rb) return ra ? -1 : 1
        return sortDir === 'asc' ? ra - rb : rb - ra
      })
    }
    return next.sort((a, b) => Number(b.pinned) - Number(a.pinned))
  }

  // 快捷打分/固定走乐观更新：先本地改（motion layout 自动播重排动画），失败再回滚。
  // 刻意不调 refresh()——那会回到第 1 页、闪一次全屏 Loader，并丢掉已「加载更多」的后续页。
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)

  // 菜单开着时只改数据、不重排：Radix 的右键菜单锚定在点击那一刻的虚拟坐标点上，
  // 卡片当场滑走的话菜单会静止悬在原地。收起时再 flush 一次（reorder 幂等）。
  const patch = (id: string, p: Partial<PersonSummary>) =>
    setItems((prev) => {
      const merged = prev.map((x) => (x.id === id ? { ...x, ...p } : x))
      return menuOpenId ? merged : reorder(merged)
    })

  const handleMenuOpenChange = (id: string, open: boolean) => {
    setMenuOpenId(open ? id : null)
    if (!open) setItems((prev) => reorder(prev))
  }

  const handleRate = async (id: string, rating: number) => {
    const prev = items.find((p) => p.id === id)?.rating ?? 0
    if (prev === rating) return
    patch(id, { rating })
    try {
      await personApi.rate(id, rating)
    } catch (e: any) {
      patch(id, { rating: prev })
      toast.error(e.message || '打分失败')
    }
  }

  const handleTogglePin = async (id: string) => {
    const cur = items.find((p) => p.id === id)
    if (!cur) return
    const next = !cur.pinned
    patch(id, { pinned: next })
    try {
      await personApi.pin(id, next)
      toast.success(next ? '已固定到最前' : '已取消固定')
    } catch (e: any) {
      patch(id, { pinned: !next })
      toast.error(e.message || '操作失败')
    }
  }

  return (
    <>
      <TopBar keyword={keyword} onKeyword={setKeyword} onAdd={() => setShowAdd(true)} />
      <main className="mx-auto max-w-[1440px] px-6 pb-24 lg:px-10">
        {/* 排序工具栏：控件靠左，搜索时结果提示靠右 */}
        <div className="flex flex-wrap items-center gap-2 pt-8">
          <span className="text-xs text-muted-foreground">排序</span>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)}>
            <SelectTrigger className="h-9 w-[124px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper">
              <SelectItem value="created">添加日期</SelectItem>
              <SelectItem value="updated">修改日期</SelectItem>
              <SelectItem value="rating">评分</SelectItem>
              <SelectItem value="nickname">昵称</SelectItem>
              <SelectItem value="media">媒体数量</SelectItem>
              <SelectItem value="firstMeet">首次见面</SelectItem>
              <SelectItem value="lastMeet">最近见面</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            className="h-9 gap-1.5 px-3 text-muted-foreground"
            onClick={() => setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))}
            title="切换升序 / 降序"
          >
            {sortDir === 'desc' ? (
              <ArrowDownWideNarrow className="size-4" />
            ) : (
              <ArrowUpNarrowWide className="size-4" />
            )}
            {DIR_LABELS[sortBy][sortDir]}
          </Button>
          {debounced && (
            <p className="ml-auto self-center text-sm text-muted-foreground">
              “{debounced}” 的搜索结果
            </p>
          )}
        </div>

        {loading ? (
          <div className="flex min-h-[420px] items-center justify-center">
            <Loader title="载入中" subtitle="人物档案" size="md" className="text-primary" />
          </div>
        ) : items.length === 0 ? (
          <div className="py-28 text-center text-muted-foreground">
            <div className="font-heading text-xl text-foreground">
              {debounced ? '没有匹配的人物' : '还没有人物档案'}
            </div>
            <p className="mt-2 text-sm">{debounced ? '换个关键词试试' : '点击右上角「添加人物」创建第一份档案'}</p>
          </div>
        ) : (
          <>
            <div
              className={`mt-10 grid grid-cols-[repeat(auto-fill,minmax(178px,1fr))] gap-x-6 gap-y-12 transition-opacity duration-200 ${
                refreshing ? 'opacity-60' : 'opacity-100'
              }`}
            >
              <AnimatePresence mode="popLayout">
                {items.map((p) => (
                  <motion.div
                    key={p.id}
                    layout
                    initial={{ opacity: 0, scale: 0.94 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.94 }}
                    transition={{ type: 'spring', stiffness: 380, damping: 32, mass: 0.8 }}
                  >
                    <PersonCard
                      person={p}
                      onRate={handleRate}
                      onTogglePin={handleTogglePin}
                      onMenuOpenChange={handleMenuOpenChange}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
            <p className="mt-12 text-center text-xs tracking-[0.08em] text-muted-foreground">
              共 {total} 位人物
            </p>
            {items.length < total && (
              <div className="mt-6 flex justify-center">
                <Button
                  variant="outline"
                  className="px-7"
                  disabled={loadingMore}
                  onClick={() => load(debounced, page + 1, true)}
                >
                  {loadingMore ? '载入中…' : '加载更多'}
                </Button>
              </div>
            )}
          </>
        )}
      </main>

      {showAdd && (
        <PersonFormModal
          mode="create"
          onClose={() => setShowAdd(false)}
          onSaved={() => {
            setShowAdd(false)
            refresh()
          }}
        />
      )}
    </>
  )
}
