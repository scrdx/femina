import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, Check, Plus, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import DateWheelPicker from '@/components/DateWheelPicker'
import { personApi } from '../api'
import type { MeetRecord } from '../api/types'

/**
 * 见面记录表格：表头「日期」可点击切换升/降序（空日期恒垫底）。
 * 表格最后一行是虚线「新增」按钮：点击后插入一条草稿行（假记录），
 * 焦点移到该行的日期格并弹出单日选择器（stay-picker 单日版）；
 * 行尾 ✓ 保存落库、✕ 取消丢弃。日期必填——「非必填」指人物可以没有记录。
 */
export default function MeetRecordTable({
  personId,
  onCount,
}: {
  personId: string
  onCount?: (n: number) => void
}) {
  const [rows, setRows] = useState<MeetRecord[] | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [adding, setAdding] = useState(false)
  const [draftDate, setDraftDate] = useState<string | null>(null)
  const [popOpen, setPopOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const dateBtnRef = useRef<HTMLButtonElement>(null)

  const load = useCallback(async () => {
    const r = await personApi.meets(personId)
    setRows(r)
    onCount?.(r.length)
  }, [personId, onCount])

  useEffect(() => {
    load().catch((e) => toast.error(e.message || '加载见面记录失败'))
  }, [load])

  // 草稿行 + 选择器就绪后：焦点落到日期触发钮（Radix 开弹层时会抢焦点到
  // 内部首个控件，这里在其之后纠正）
  useEffect(() => {
    if (!adding || !popOpen) return
    const t = window.setTimeout(() => dateBtnRef.current?.focus(), 0)
    return () => window.clearTimeout(t)
  }, [adding, popOpen])

  const sorted = useMemo(() => {
    if (!rows) return null
    const dir = sortDir === 'asc' ? 1 : -1
    return [...rows].sort((a, b) => {
      // 空日期恒垫底，与方向无关
      if (!a.meetDate && !b.meetDate) return b.id - a.id
      if (!a.meetDate) return 1
      if (!b.meetDate) return -1
      return a.meetDate === b.meetDate
        ? b.id - a.id
        : (a.meetDate < b.meetDate ? -1 : 1) * dir
    })
  }, [rows, sortDir])

  const startAdd = () => {
    setDraftDate(null)
    setAdding(true)
    setPopOpen(true)
  }

  const cancelAdd = () => {
    setAdding(false)
    setDraftDate(null)
    setPopOpen(false)
  }

  const saveAdd = async () => {
    if (!draftDate) return
    setBusy(true)
    try {
      await personApi.addMeet(personId, draftDate)
      cancelAdd()
      toast.success('已添加见面记录')
      await load()
    } catch (e: any) {
      toast.error(e.message || '添加失败')
    } finally {
      setBusy(false)
    }
  }

  const remove = async (row: MeetRecord) => {
    try {
      await personApi.removeMeet(personId, row.id)
      toast.success('已删除')
      await load()
    } catch (e: any) {
      toast.error(e.message || '删除失败')
    }
  }

  return (
    <div className="min-h-[200px]">
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="grid grid-cols-[1fr_150px_96px] border-b border-border bg-muted/50 px-4 py-2.5 text-xs text-muted-foreground">
          <button
            type="button"
            className="flex items-center gap-1 text-left text-xs transition-colors hover:text-foreground"
            onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
            title="切换升序 / 降序"
          >
            日期
            {sortDir === 'asc' ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" />}
          </button>
          <span className="hidden text-right sm:block">登记时间</span>
          <span className="text-right">操作</span>
        </div>
        {sorted === null ? (
          <div className="px-4 py-10 text-center text-sm text-muted-foreground">载入中…</div>
        ) : sorted.length === 0 && !adding ? (
          <div className="px-4 py-10 text-center text-sm text-muted-foreground">
            暂无见面记录
          </div>
        ) : (
          sorted.map((r) => (
            <div
              key={r.id}
              className="grid grid-cols-[1fr_150px_96px] items-center border-b border-border px-4 py-2.5 text-sm"
            >
              <span
                className={
                  (r.meetDate ? 'text-foreground' : 'text-muted-foreground') + ' font-mono'
                }
              >
                {r.meetDate || '未填写'}
              </span>
              <span className="hidden text-right font-mono text-xs text-muted-foreground sm:block">
                {r.createdAt ? r.createdAt.slice(0, 10) : '—'}
              </span>
              <span className="flex justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  className="px-2 text-muted-foreground hover:text-destructive"
                  aria-label="删除这条见面记录"
                  onClick={() => remove(r)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </span>
            </div>
          ))
        )}
        {adding && (
          <div className="grid grid-cols-[1fr_150px_96px] items-center border-b border-border bg-primary/5 px-4 py-2.5 text-sm">
            <span>
              {/* 与编辑弹窗同款日期选择器：受控开合 + 外部聚焦触发钮 */}
              <DateWheelPicker
                className="max-w-[240px] font-mono"
                label="见面日期"
                mode="date"
                onChange={setDraftDate}
                onOpenChange={setPopOpen}
                open={popOpen}
                placeholder="选择日期"
                triggerRef={dateBtnRef}
                value={draftDate ?? ''}
                yearMax={2060}
              />
            </span>
            <span className="hidden text-right text-xs text-muted-foreground sm:block">—</span>
            <span className="flex justify-end gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="px-2"
                aria-label="保存这条见面记录"
                disabled={!draftDate || busy}
                onClick={saveAdd}
              >
                <Check className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="px-2 text-muted-foreground"
                aria-label="取消新增"
                disabled={busy}
                onClick={cancelAdd}
              >
                <X className="size-4" />
              </Button>
            </span>
          </div>
        )}
        {!adding && (
          <div className="p-2">
            <button
              type="button"
              className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border py-2.5 text-sm text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground"
              onClick={startAdd}
            >
              <Plus className="size-4" /> 新增见面记录
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
