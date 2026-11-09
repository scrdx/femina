import React, { useEffect, useMemo, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'
import { chipStyle, tagHues } from '@/lib/tagColor'

interface Props {
  value: string[]
  onChange: (tags: string[]) => void
  allTags?: string[]
  /** 无边框变体：嵌入 FieldShell 输入组时使用 */
  bare?: boolean
}

const MAX_SUGGESTIONS = 20

/**
 * 标签输入：回车/逗号成标签，Backspace 删除末尾标签。
 * 聚焦即列出已有标签供点选（前缀命中排前），输入可过滤；
 * 支持 ↑/↓ + 回车键盘选择，Esc 收起。
 * 候选面板用 Radix Popover 渲染：正确嵌套在弹窗（Dialog）的交互层内，
 * 鼠标可点、可滚动，且不会被弹窗的 overflow 裁剪。
 */
export default function TagInput({ value, onChange, allTags = [], bare }: Props) {
  const [text, setText] = useState('')
  const hues = tagHues(value)
  const [focused, setFocused] = useState(false)
  const [activeIdx, setActiveIdx] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  const suggestions = useMemo(() => {
    const kw = text.trim().toLowerCase()
    const pool = allTags.filter(
      (t) => !value.includes(t) && (!kw || t.toLowerCase().includes(kw))
    )
    if (kw) {
      // 前缀命中优先于中间包含；同类保持原有顺序
      pool.sort(
        (a, b) =>
          Number(!a.toLowerCase().startsWith(kw)) - Number(!b.toLowerCase().startsWith(kw))
      )
    }
    return pool.slice(0, MAX_SUGGESTIONS)
  }, [allTags, text, value])

  const open = focused && suggestions.length > 0

  // 输入或候选变化后重置高亮；键盘移动时保证高亮项可见
  useEffect(() => {
    setActiveIdx(-1)
  }, [text])
  useEffect(() => {
    if (activeIdx >= 0) {
      listRef.current
        ?.querySelector(`[data-idx="${activeIdx}"]`)
        ?.scrollIntoView({ block: 'nearest' })
    }
  }, [activeIdx])

  const addTag = (raw: string) => {
    const t = raw.trim().replace(/[,，]/g, '')
    if (t && !value.includes(t)) {
      onChange([...value, t])
    }
    setText('')
    setActiveIdx(-1)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' && open) {
      e.preventDefault()
      setActiveIdx((i) => (i + 1) % suggestions.length)
    } else if (e.key === 'ArrowUp' && open) {
      e.preventDefault()
      setActiveIdx((i) => (i <= 0 ? suggestions.length - 1 : i - 1))
    } else if (e.key === 'Escape') {
      setFocused(false)
      inputRef.current?.blur()
    } else if (e.key === 'Enter' || e.key === ',' || e.key === '，') {
      e.preventDefault()
      if (open && activeIdx >= 0) addTag(suggestions[activeIdx])
      else addTag(text)
    } else if (e.key === 'Backspace' && !text && value.length) {
      onChange(value.slice(0, -1))
    }
  }

  return (
    <Popover open={open} onOpenChange={(o) => !o && setFocused(false)}>
      <PopoverAnchor asChild>
        <div
          ref={wrapRef}
          className={
            bare
              ? 'relative flex min-w-0 flex-1 flex-wrap items-center gap-1.5 px-1.5 py-0.5'
              : 'relative flex min-h-8 flex-wrap items-center gap-1.5 rounded-lg border border-input bg-background px-2 py-1 transition-[color,box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/30'
          }
          onClick={() => {
            // 已聚焦时再次点击不会有 focus 事件，这里显式打开
            inputRef.current?.focus()
            setFocused(true)
          }}
          onBlur={() => setTimeout(() => setFocused(false), 120)}
        >
          {value.map((t) => (
            <span
              key={t}
              data-tag-chip=""
              style={chipStyle(hues[t])}
              className="inline-flex items-center gap-1 rounded-md border py-0.5 pl-2.5 pr-1 text-xs font-medium"
            >
              {t}
              <button
                type="button"
                className="rounded-md p-0.5 opacity-60 transition hover:bg-primary/15 hover:opacity-100"
                // 阻止 mousedown 默认行为，避免焦点跳到按钮触发输入框 blur 而收起下拉
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(value.filter((x) => x !== t))
                  inputRef.current?.focus()
                }}
              >
                <X size={12} />
              </button>
            </span>
          ))}
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKeyDown}
            onFocus={() => setFocused(true)}
            placeholder={value.length ? '' : '输入新标签或从已有标签中选择'}
            className="min-w-[110px] flex-1 bg-transparent px-1 py-0.5 text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
      </PopoverAnchor>

      <PopoverContent
        align="start"
        sideOffset={6}
        // 焦点始终留在输入框（组合框模式），打开面板的 focusin 事件在冒泡阶段
        // 会被 Radix 判为「焦点在层外」而立即 dismiss，必须阻止；
        // 真正的关闭由 wrapper onBlur / Esc / pointerDownOutside 负责。
        onOpenAutoFocus={(e) => e.preventDefault()}
        onFocusOutside={(e) => e.preventDefault()}
        // 点击落在 anchor 区域内（chip、删除按钮、输入框、内边距）不算「外部」。
        // 注意：Radix 的 pointerDownOutside 在 click 阶段才延迟派发，删 chip 时
        // target 可能已被 React 移除出文档，contains 会失败，需再沿脱离子树
        // 用 data-tag-chip 标记兜底判断。
        onPointerDownOutside={(e) => {
          const t = e.target as HTMLElement | null
          if (t && (wrapRef.current?.contains(t) || t.closest?.('[data-tag-chip]'))) {
            e.preventDefault()
          }
        }}
        style={{ width: 'var(--radix-popover-trigger-width)' }}
        className="overflow-hidden p-1"
      >
        {/* ref 挂在内层：React 18 下函数组件 PopoverContent 不转发 ref */}
        <div
          ref={listRef}
          role="listbox"
          className="max-h-[min(200px,calc(var(--radix-popover-content-available-height)-16px))] overflow-y-auto overflow-x-hidden"
        >
          {!text.trim() && (
            <div className="px-3 pb-1 pt-1.5 text-[11px] tracking-wide text-muted-foreground">
              已有标签 · 点击或按回车选择
            </div>
          )}
          {suggestions.map((s, i) => (
            <div
              key={s}
              data-idx={i}
              role="option"
              aria-selected={i === activeIdx}
              className={`cursor-pointer rounded-lg px-3 py-1.5 text-sm transition ${
                i === activeIdx
                  ? 'bg-accent text-accent-foreground'
                  : 'hover:bg-accent hover:text-accent-foreground'
              }`}
              onMouseEnter={() => setActiveIdx(i)}
              onMouseDown={(e) => {
                // 阻止默认行为避免输入框失焦收起，点选后可连续选择
                e.preventDefault()
                addTag(s)
              }}
            >
              {s}
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
