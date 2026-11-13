import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowDownWideNarrow,
  ArrowLeft,
  ArrowUpNarrowWide,
  CalendarDays,
  Clapperboard,
  FolderTree,
  Image as ImageIcon,
  Pencil,
  Play,
  RefreshCw,
} from 'lucide-react'
import { toast } from 'sonner'
import HoldButton from '@/components/kokonutui/hold-button'
import LightboxGrid, { type LightboxImage } from '@/components/kokonutui/lightbox-grid'
import ParticleButton from '@/components/kokonutui/particle-button'
import SmoothTab from '@/components/kokonutui/smooth-tab'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { coverUrl, mediaThumbUrl, mediaUrl, personApi } from '../api'
import type { MediaItem, MediaSortKey, PersonDetail } from '../api/types'
import AccountMenu from '../components/AccountMenu'
import MeetRecordTable from '../components/MeetRecordTable'
import Pagination from '../components/Pagination'
import PersonFileBrowser from '../components/PersonFileBrowser'
import { chipStyle, tagHues } from '@/lib/tagColor'
import StarRating from '../components/StarRating'
import PinnedFold from '../components/PinnedFold'
import PersonFormModal from '../components/PersonFormModal'
import VideoDialog from '../components/VideoDialog'

const DEFAULT_PAGE_SIZE = 30
const PAGE_SIZE_OPTIONS = [30, 60, 120]

interface SortState {
  key: MediaSortKey
  dir: 'asc' | 'desc'
}

const SORT_LABELS: [MediaSortKey, string][] = [
  ['name', '文件名'],
  ['size', '文件大小'],
  ['dims', '尺寸'],
  ['created', '创建时间'],
  ['modified', '修改时间'],
]

/** 排序 + 每页数量工具栏：与首页排序组件同款（shadcn Select + outline 方向按钮），控件靠左 */
function MediaSortBar({
  sort,
  onSort,
  pageSize,
  onPageSize,
  withDims,
}: {
  sort: SortState
  onSort: (s: SortState) => void
  pageSize: number
  onPageSize: (n: number) => void
  withDims?: boolean
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-muted-foreground">排序</span>
      <Select value={sort.key} onValueChange={(v) => onSort({ ...sort, key: v as MediaSortKey })}>
        <SelectTrigger className="h-9 w-[124px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper">
          {SORT_LABELS.filter(([k]) => withDims || k !== 'dims').map(([k, label]) => (
            <SelectItem key={k} value={k}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        variant="outline"
        className="h-9 gap-1.5 px-3 text-muted-foreground"
        title="切换升序 / 降序"
        onClick={() => onSort({ ...sort, dir: sort.dir === 'asc' ? 'desc' : 'asc' })}
      >
        {sort.dir === 'desc' ? (
          <ArrowDownWideNarrow className="size-4" />
        ) : (
          <ArrowUpNarrowWide className="size-4" />
        )}
        {sort.dir === 'desc' ? '降序' : '升序'}
      </Button>
      <span className="ml-4 text-xs text-muted-foreground">每页</span>
      <Select value={String(pageSize)} onValueChange={(v) => onPageSize(Number(v))}>
        <SelectTrigger className="h-9 w-[88px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper">
          {PAGE_SIZE_OPTIONS.map((n) => (
            <SelectItem key={n} value={String(n)}>
              {n} 个
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

function birthText(p: PersonDetail): string {
  if (p.birthYearOnly) return p.birthYear ? `${p.birthYear} 年` : '—'
  if (p.birthDate) return p.birthDate
  return p.birthYear ? `${p.birthYear} 年` : '—'
}

export default function PersonDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const [person, setPerson] = useState<PersonDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [video, setVideo] = useState<MediaItem | null>(null)
  // 媒体明细传统分页：只取当前页，避免几千节点一次进 DOM
  const [photos, setPhotos] = useState<MediaItem[]>([])
  const [photoTotal, setPhotoTotal] = useState(0)
  const [photoPage, setPhotoPage] = useState(1)
  const [photoSort, setPhotoSort] = useState<SortState>({ key: 'name', dir: 'asc' })
  const [photoSize, setPhotoSize] = useState(DEFAULT_PAGE_SIZE)
  const [videos, setVideos] = useState<MediaItem[]>([])
  const [videoTotal, setVideoTotal] = useState(0)
  const [videoPage, setVideoPage] = useState(1)
  const [videoSort, setVideoSort] = useState<SortState>({ key: 'name', dir: 'asc' })
  const [videoSize, setVideoSize] = useState(DEFAULT_PAGE_SIZE)
  const [meetCount, setMeetCount] = useState(0)
  const [openReq, setOpenReq] = useState<{ index: number; token: number } | null>(null)
  const openToken = useRef(0)

  const fetchMedia = useCallback(
    async (type: 'PHOTO' | 'VIDEO', page: number, sort: SortState, size: number) => {
      const r = await personApi.mediaPage(id, type, page, {
        size,
        sort: sort.key,
        dir: sort.dir,
      })
      if (type === 'PHOTO') {
        setPhotos(r.items)
        setPhotoTotal(r.total)
      } else {
        setVideos(r.items)
        setVideoTotal(r.total)
      }
      return r.items
    },
    [id]
  )

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const d = await personApi.detail(id)
      setPerson(d)
      setNotFound(false)
      setPhotoTotal(d.photoCount)
      setVideoTotal(d.videoCount)
    } catch (e: any) {
      setNotFound(true)
      toast.error(e.message || '加载失败')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  /** 标题旁的评分：与卡片右键菜单同源，点击即改、点当前星级清除；失败回滚 */
  const handleRate = async (rating: number) => {
    if (!person) return
    const prev = person.rating ?? 0
    if (prev === rating) return
    setPerson({ ...person, rating })
    try {
      await personApi.rate(person.id, rating)
    } catch (e: any) {
      setPerson({ ...person, rating: prev })
      toast.error(e.message || '打分失败')
    }
  }

  // 换人时复位页码、排序与每页数量
  useEffect(() => {
    setPhotoPage(1)
    setVideoPage(1)
    setPhotoSort({ key: 'name', dir: 'asc' })
    setVideoSort({ key: 'name', dir: 'asc' })
    setPhotoSize(DEFAULT_PAGE_SIZE)
    setVideoSize(DEFAULT_PAGE_SIZE)
  }, [id])

  useEffect(() => {
    if (!person) return
    fetchMedia('PHOTO', photoPage, photoSort, photoSize).catch((e) =>
      toast.error(e.message || '媒体加载失败')
    )
  }, [person, photoPage, photoSort, photoSize, fetchMedia])

  useEffect(() => {
    if (!person) return
    fetchMedia('VIDEO', videoPage, videoSort, videoSize).catch((e) =>
      toast.error(e.message || '媒体加载失败')
    )
  }, [person, videoPage, videoSort, videoSize, fetchMedia])

  const photoPages = Math.max(1, Math.ceil(photoTotal / photoSize))
  const videoPages = Math.max(1, Math.ceil(videoTotal / videoSize))

  const gotoPhotoPage = useCallback(
    async (p: number) => {
      const items = await fetchMedia('PHOTO', p, photoSort, photoSize)
      setPhotoPage(p)
      window.scrollTo({ top: 0 })
      return items
    },
    [fetchMedia, photoSort, photoSize]
  )

  const gotoVideoPage = useCallback(
    async (p: number) => {
      const items = await fetchMedia('VIDEO', p, videoSort, videoSize)
      setVideoPage(p)
      window.scrollTo({ top: 0 })
      return items
    },
    [fetchMedia, videoSort, videoSize]
  )

  /** lightbox 翻页越过当前页边界：换页后打开新页的首/末张 */
  const handleStepBeyond = useCallback(
    async (dir: 1 | -1) => {
      try {
        if (dir === 1 && photoPage < photoPages) {
          await gotoPhotoPage(photoPage + 1)
          openToken.current += 1
          setOpenReq({ index: 0, token: openToken.current })
        } else if (dir === -1 && photoPage > 1) {
          const items = await gotoPhotoPage(photoPage - 1)
          openToken.current += 1
          setOpenReq({ index: items.length - 1, token: openToken.current })
        }
      } catch (e: any) {
        toast.error(e.message || '媒体加载失败')
      }
    },
    [gotoPhotoPage, photoPage, photoPages]
  )

  const onRescan = async () => {
    const r = await personApi.rescan(id)
    toast.success(`扫描完成，共 ${r.count} 个媒体文件`)
    await load()
  }

  const onDelete = async () => {
    try {
      await personApi.remove(id)
      toast.success('已删除人物档案（媒体文件保留未动）')
      navigate('/')
    } catch (e: any) {
      toast.error(e.message || '删除失败')
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-primary">
        <div className="animate-pulse font-heading text-sm tracking-[0.3em] text-muted-foreground">
          载入中…
        </div>
      </div>
    )
  }
  if (notFound || !person) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-5 text-muted-foreground">
        <div className="font-heading text-lg text-foreground">人物不存在或已被删除</div>
        <Button variant="outline" onClick={() => navigate('/')}>
          <ArrowLeft className="size-4" /> 返回海报墙
        </Button>
      </div>
    )
  }

  const cells: [string, string, boolean?][] = [
    ['出生日期', birthText(person)],
    ['户籍地', person.hometown || '—'],
    ['学历', person.education || '—'],
    ['身高', person.heightCm ? `${person.heightCm} cm` : '—'],
    ['体重', person.weightKg ? `${person.weightKg} kg` : '—'],
    ['UUID', person.id, true],
  ]

  const hues = tagHues(person.tags)

  const lightboxImages: LightboxImage[] = photos.map((m) => ({
    src: mediaUrl(person.id, m.relPath),
    thumb: mediaThumbUrl(person.id, m.relPath),
    alt: m.fileName,
    width: m.width || 1200,
    height: m.height || 1600,
    caption: m.fileName,
  }))

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-4 px-6 lg:px-10">
          <Button
            variant="ghost"
            className="px-4 text-muted-foreground"
            onClick={() => navigate('/')}
          >
            <ArrowLeft className="size-4" /> 返回
          </Button>
          <button
            className="font-heading text-[22px] font-semibold tracking-[0.14em] text-foreground transition-opacity hover:opacity-80"
            onClick={() => navigate('/')}
          >
            FEMINA<span className="text-primary">.</span>
          </button>
          <div className="ml-auto">
            <AccountMenu />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1440px] px-6 pb-24 lg:px-10">
        {/* Hero */}
        <div className="grid grid-cols-1 gap-10 pt-10 lg:grid-cols-[320px_1fr]">
          <div className="relative aspect-[2/3] max-w-[320px] overflow-hidden rounded-xl border border-border/80 bg-muted shadow-lg">
            {person.coverPath || person.coverData ? (
              <img
                // 与海报墙同源：裁剪结果或缩略图，1000 档足够 320px 宽的 hero（含高分屏）
                src={coverUrl(person.id, 1000)}
                alt={person.name}
                decoding="async"
                className="size-full object-cover"
              />
            ) : (
              <div className="flex size-full items-center justify-center bg-gradient-to-br from-accent via-muted to-accent font-heading text-8xl text-primary/50">
                {(person.nickname || person.name || '?').charAt(0)}
              </div>
            )}
            {/* 与海报墙卡片同一套折角标记：固定的人在这里也看得出来 */}
            {!!person.pinned && <PinnedFold />}
          </div>

          <div className="min-w-0">
            {/* 昵称为必填主显示名，作为标题；姓名选填，作为副行 */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
              <h1 className="detail-name font-heading text-4xl font-semibold text-foreground">
                {person.nickname || person.name || '未命名'}
              </h1>
              {/* 未评分也展示 5 颗空星：这里是打分的正式入口之一，需要可发现 */}
              <StarRating
                variant="input"
                size={22}
                value={person.rating ?? 0}
                onChange={handleRate}
              />
            </div>
            {person.name && person.name !== person.nickname && (
              <div className="mt-2 font-heading text-lg italic text-muted-foreground">
                {person.name}
              </div>
            )}

            {person.tags.length > 0 && (
              <div className="mt-5 flex flex-wrap gap-2">
                {person.tags.map((t) => (
                  <span key={t} style={chipStyle(hues[t])} className="rounded-md border px-2.5 py-1 text-xs font-medium">
                    {t}
                  </span>
                ))}
              </div>
            )}

            <div className="mt-7 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border md:grid-cols-3">
              {cells.map(([k, v, mono]) => (
                <div key={k} className="bg-card p-4">
                  <div className="text-xs text-muted-foreground">{k}</div>
                  <div
                    className={`mt-1.5 break-words text-[15px] text-foreground ${
                      v === '—' ? 'text-border' : ''
                    } ${mono ? 'font-mono text-xs leading-5' : ''}`}
                  >
                    {v}
                  </div>
                </div>
              ))}
            </div>

            {person.accounts.length > 0 && (
              <div className="mt-7">
                <div className="mb-3 flex items-center gap-3 text-xs font-semibold tracking-[0.1em] text-primary">
                  账号 / 联系方式
                  <span className="h-px flex-1 bg-border" />
                </div>
                <div className="overflow-hidden rounded-lg border border-border">
                  {person.accounts.map((a, i) => (
                    <div key={i} className={`grid grid-cols-[130px_1fr] ${i > 0 ? 'border-t border-border' : ''}`}>
                      <div className="bg-muted/60 px-4 py-3 text-sm text-muted-foreground">{a.type}</div>
                      <div className="break-all bg-card px-4 py-3 font-mono text-sm text-foreground">
                        {a.value}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {person.remarks && (
              <div className="mt-7">
                <div className="mb-3 flex items-center gap-3 text-xs font-semibold tracking-[0.1em] text-primary">
                  备注
                  <span className="h-px flex-1 bg-border" />
                </div>
                <div className="whitespace-pre-wrap rounded-lg border border-border bg-card px-4 py-3 text-sm leading-6 text-foreground">
                  {person.remarks}
                </div>
              </div>
            )}

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button variant="outline" className="px-5" onClick={() => setEditOpen(true)}>
                <Pencil className="size-4" /> 编辑
              </Button>
              <ParticleButton
                variant="outline"
                icon={<RefreshCw className="size-4" />}
                pendingLabel="扫描中"
                successLabel="已同步"
                errorLabel="扫描失败"
                onClick={onRescan}
                onError={(e: unknown) => toast.error(e instanceof Error ? e.message : '扫描失败')}
              >
                重新扫描媒体
              </ParticleButton>
              <HoldButton
                variant="red"
                holdDuration={1100}
                holdingLabel="继续按住以删除"
                completeLabel="已删除"
                onHoldComplete={onDelete}
              >
                长按删除档案
              </HoldButton>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              删除仅移除系统内的档案记录，照片与视频文件将完整保留在磁盘上。
            </p>
          </div>
        </div>

        {/* 媒体区：照片 / 视频 滑动标签 */}
        <div className="mt-14">
          <SmoothTab
            className="max-w-none"
            label="媒体"
            swipe={false}
            items={[
              {
                id: 'photos',
                title: `照片 (${photoTotal})`,
                icon: ImageIcon,
                content:
                  photoTotal === 0 ? (
                    <div className="rounded-xl border border-dashed border-border py-14 text-center text-sm text-muted-foreground">
                      暂无照片{person.mediaDir ? '，可点击「重新扫描媒体」刷新' : ''}
                    </div>
                  ) : (
                    <>
                      {/* 排序/每页靠左，页码靠右：图多时不必滚到底才能换页 */}
                      <div className="mb-4 flex flex-wrap items-center gap-2">
                        <MediaSortBar
                          onPageSize={(n) => {
                            setPhotoSize(n)
                            setPhotoPage(1)
                          }}
                          onSort={setPhotoSort}
                          pageSize={photoSize}
                          sort={photoSort}
                          withDims
                        />
                        <Pagination
                          className="ml-auto py-0"
                          onChange={gotoPhotoPage}
                          page={photoPage}
                          pages={photoPages}
                          total={photoTotal}
                        />
                      </div>
                      <LightboxGrid
                        className="max-w-none"
                        hasMoreAfter={photoPage < photoPages}
                        hasMoreBefore={photoPage > 1}
                        images={lightboxImages}
                        onStepBeyond={handleStepBeyond}
                        openRequest={openReq}
                      />
                    </>
                  ),
              },
              {
                id: 'videos',
                title: `视频 (${videoTotal})`,
                icon: Clapperboard,
                content:
                  videoTotal === 0 ? (
                    <div className="rounded-xl border border-dashed border-border py-14 text-center text-sm text-muted-foreground">
                      暂无视频
                    </div>
                  ) : (
                    <>
                    <div className="mb-4 flex flex-wrap items-center gap-2">
                      <MediaSortBar
                        onPageSize={(n) => {
                          setVideoSize(n)
                          setVideoPage(1)
                        }}
                        onSort={setVideoSort}
                        pageSize={videoSize}
                        sort={videoSort}
                      />
                      <Pagination
                        className="ml-auto py-0"
                        onChange={gotoVideoPage}
                        page={videoPage}
                        pages={videoPages}
                        total={videoTotal}
                      />
                    </div>
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
                      {videos.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setVideo(m)}
                          className="group relative aspect-video overflow-hidden rounded-xl border border-border bg-muted transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
                        >
                          <video
                            src={mediaUrl(person.id, m.relPath)}
                            preload="metadata"
                            muted
                            playsInline
                            className="size-full object-cover"
                          />
                          <span className="absolute inset-0 flex items-center justify-center bg-gradient-to-t from-black/50 to-transparent">
                            <span className="flex size-12 items-center justify-center rounded-xl bg-card/95 text-primary shadow-lg transition-transform group-hover:scale-110">
                              <Play className="size-5 translate-x-0.5" />
                            </span>
                          </span>
                          <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/70 to-transparent px-3 pb-2 pt-6 text-left text-[11px] text-white/90 opacity-0 transition-opacity group-hover:opacity-100">
                            {m.fileName}
                          </span>
                        </button>
                      ))}
                    </div>
                    </>
                  ),
              },
              {
                id: 'files',
                title: '文件',
                icon: FolderTree,
                content: <PersonFileBrowser personId={person.id} mediaDir={person.mediaDir} />,
              },
              {
                id: 'meet',
                title: `见面 (${meetCount})`,
                icon: CalendarDays,
                content: <MeetRecordTable onCount={setMeetCount} personId={person.id} />,
              },
            ]}
          />
        </div>
      </main>

      <VideoDialog personId={person.id} item={video} onClose={() => setVideo(null)} />
      {editOpen && (
        <PersonFormModal
          mode="edit"
          person={person}
          onClose={() => setEditOpen(false)}
          onSaved={() => {
            setEditOpen(false)
            load()
          }}
        />
      )}
    </>
  )
}
