import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Tags, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import AccountMenu from './AccountMenu'
import TagCloudDialog from './TagCloudDialog'

interface Props {
  keyword: string
  onKeyword: (v: string) => void
  onAdd: () => void
}

export default function TopBar({ keyword, onKeyword, onAdd }: Props) {
  const navigate = useNavigate()
  const [tagCloudOpen, setTagCloudOpen] = useState(false)
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-5 px-6 lg:px-10">
        <button
          className="font-heading text-[22px] font-semibold tracking-[0.14em] text-foreground transition-opacity hover:opacity-80"
          onClick={() => navigate('/')}
        >
          FEMINA<span className="text-primary">.</span>
        </button>

        <div className="search-box relative max-w-md flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={keyword}
            onChange={(e) => onKeyword(e.target.value)}
            placeholder="搜索姓名 / 昵称 / 账号 / 标签…"
            className={`h-10 w-full rounded-lg border border-input bg-card pl-10 text-sm transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30 focus-visible:outline-none ${
              keyword ? 'pr-16' : 'pr-10'
            }`}
          />
          {keyword && (
            <button
              className="absolute right-9 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition hover:bg-accent hover:text-foreground"
              onClick={() => onKeyword('')}
              aria-label="清除搜索"
            >
              <X className="size-4" />
            </button>
          )}
          {/* 标签云入口收进搜索框内右侧 */}
          <button
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground transition hover:bg-accent hover:text-foreground"
            onClick={() => setTagCloudOpen(true)}
            title="标签"
            aria-label="打开标签"
          >
            <Tags className="size-4" />
          </button>
        </div>

        <TagCloudDialog
          open={tagCloudOpen}
          onClose={() => setTagCloudOpen(false)}
          onPick={(name) => {
            onKeyword(name)
            setTagCloudOpen(false)
          }}
        />

        <div className="ml-auto flex items-center gap-3">
          <Button onClick={onAdd} className="px-5">
            <Plus className="size-4" /> 添加人物
          </Button>
          <AccountMenu />
        </div>
      </div>
    </header>
  )
}
