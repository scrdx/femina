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
  const [sortBy, setSortBy] = useState<SortKey>('created')
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
                {items.map((p, i) => (
                  <motion.div
                    key={p.id}
                    layout
                    initial={{ opacity: 0, scale: 0.94 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.94 }}
                    transition={{ type: 'spring', stiffness: 380, damping: 32, mass: 0.8 }}
                  >
                    <PersonCard person={p} index={i} />
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
