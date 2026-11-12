import { Plus, Trash2 } from 'lucide-react'
import SelectMenu from '@/components/kokonutui/select-menu'
import type { AccountEntry } from '../api/types'
import { ShellInput } from './FormField'

export const ACCOUNT_TYPES = [
  '手机号', '微信', 'QQ', 'Telegram', 'Telegram频道', 'Telegram群组',
  '抖音', '快手', '小红书', '微博',
  'Instagram', 'Twitter/X', 'Facebook', '邮箱', '其他',
]

interface Props {
  value: AccountEntry[]
  onChange: (rows: AccountEntry[]) => void
}

/**
 * 账号动态表格：每行为一个连体输入组——左侧按钮样的类型下拉 + 右侧账号值。
 */
export default function AccountEditor({ value, onChange }: Props) {
  const update = (i: number, patch: Partial<AccountEntry>) => {
    onChange(value.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  }

  return (
    <div className="flex flex-col gap-1.5">
      {value.length === 0 && (
        <div className="rounded-lg border border-dashed border-border px-4 py-3 text-center text-xs text-muted-foreground">
          暂无账号，点击「添加账号」
        </div>
      )}
      {value.map((row, i) => (
        <div
          key={i}
          className="flex h-8 items-stretch overflow-hidden rounded-lg border border-input bg-background transition-[color,box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/30"
        >
          {/* 160px：扣掉内边距/间隔/chevron 后剩 ~118px 文字位，
              能完整放下最长内置项「Telegram频道」及常见自定义类型 */}
          <div className="flex w-[160px] shrink-0 border-r border-border bg-muted/40">
            <SelectMenu
              bare
              value={row.type}
              onChange={(v) => update(i, { type: v })}
              options={ACCOUNT_TYPES}
              allowCustom
              placeholder="类型"
              label="账号类型"
            />
          </div>
          <ShellInput
            placeholder="账号 / 号码"
            value={row.value}
            onChange={(e) => update(i, { value: e.target.value })}
          />
          <button
            type="button"
            title="删除此行"
            className="shrink-0 px-2.5 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
            onClick={() => onChange(value.filter((_, idx) => idx !== i))}
          >
            <Trash2 size={15} />
          </button>
        </div>
      ))}
      <button
        type="button"
        className="mt-1 inline-flex h-8 items-center gap-1.5 self-start rounded-lg border border-dashed border-border px-3 text-xs font-medium text-muted-foreground transition hover:border-foreground/40 hover:bg-accent hover:text-foreground"
        onClick={() => onChange([...value, { type: '', value: '' }])}
      >
        <Plus size={13} /> 添加账号
      </button>
    </div>
  )
}
