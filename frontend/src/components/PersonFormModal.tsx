import { type ReactNode, useEffect, useMemo, useState } from 'react'
import { Crop, FolderOpen, Image as ImageIcon, RotateCcw, UserRound, X } from 'lucide-react'
import { toast } from 'sonner'
import ParticleButton from '@/components/kokonutui/particle-button'
import SelectMenu from '@/components/kokonutui/select-menu'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitleBar,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Switch } from '@/components/ui/switch'
import { personApi, previewUrl } from '../api'
import type { AccountEntry, PersonDetail } from '../api/types'
import AccountEditor from './AccountEditor'
import DateWheelPicker from './DateWheelPicker'
import FileBrowser from './FileBrowser'
import { FieldShell, ShellInput } from './FormField'
import SmoothTab from '@/components/kokonutui/smooth-tab'
import StarRating from './StarRating'
import CropDialog from './CropDialog'
import TagInput from './TagInput'

const EDUCATION = ['初中', '高中', '中专', '大专', '本科', '硕士', '博士']

interface Props {
  mode: 'create' | 'edit'
  person?: PersonDetail
  onClose: () => void
  onSaved: (id: string) => void
}

interface FormState {
  name: string
  nickname: string
  birthYearOnly: boolean
  birthDate: string
  birthYear: string
  hometown: string
  education: string
  heightCm: string
  weightKg: string
  remarks: string
  /** 评分 1-5，0 表示未评分 */
  rating: number
  /** 固定置顶：始终排在海报墙最前 */
  pinned: boolean
  mediaDir: string
  coverPath: string
  coverData: string
  accounts: AccountEntry[]
  tags: string[]
}

function toFormState(p?: PersonDetail): FormState {
  if (!p) {
    return {
      name: '', nickname: '', birthYearOnly: false, birthDate: '', birthYear: '',
      hometown: '', education: '', heightCm: '', weightKg: '', remarks: '',
      rating: 0, pinned: false,
      mediaDir: '', coverPath: '', coverData: '', accounts: [], tags: [],
    }
  }
  return {
    name: p.name || '',
    nickname: p.nickname || '',
    birthYearOnly: !!p.birthYearOnly,
    birthDate: p.birthDate || '',
    birthYear: p.birthYear != null ? String(p.birthYear) : '',
    hometown: p.hometown || '',
    education: p.education || '',
    heightCm: p.heightCm != null ? String(p.heightCm) : '',
    weightKg: p.weightKg != null ? String(p.weightKg) : '',
    remarks: p.remarks || '',
    rating: p.rating ?? 0,
    pinned: !!p.pinned,
    mediaDir: p.mediaDir || '',
    coverPath: p.coverPath || '',
    coverData: p.coverData || '',
    accounts: p.accounts || [],
    tags: p.tags || [],
  }
}

/** 把 FileBrowser 返回的绝对路径转为相对 mediaDir 的路径 */
function toRelative(mediaDir: string, absPath: string): string | null {
  const norm = (s: string) => s.replace(/\\/g, '/').replace(/\/+$/, '')
  const base = norm(mediaDir)
  const target = norm(absPath)
  if (target.toLowerCase().startsWith(base.toLowerCase())) {
    return target.slice(base.length).replace(/^\/+/, '')
  }
  return null
}

/** 区域卡片：带柔和阴影的分组容器 */
function SectionCard({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-card p-4 shadow-[0_1px_2px_rgb(0_0_0/0.03),0_10px_28px_-14px_rgb(0_0_0/0.10)]">
      <div className="mb-3 flex items-baseline gap-3">
        <h3 className="text-sm font-semibold tracking-wide text-foreground">{title}</h3>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
      {children}
    </section>
  )
}

export default function PersonFormModal({ mode, person, onClose, onSaved }: Props) {
  const [form, setForm] = useState<FormState>(() => toFormState(person))
  const [allTags, setAllTags] = useState<string[]>([])
  const [browse, setBrowse] = useState<'dir' | 'cover' | null>(null)
  const [cropOpen, setCropOpen] = useState(false)

  useEffect(() => {
    personApi.tags().then((tags) => setAllTags(tags.map((t) => t.name))).catch(() => {})
  }, [])

  const set = <K extends keyof FormState>(key: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: v }))

  const coverPreview = useMemo(() => {
    if (!form.coverPath || !form.mediaDir) return null
    const abs = form.mediaDir.replace(/[\\/]+$/, '') + '/' + form.coverPath
    return previewUrl(abs)
  }, [form.mediaDir, form.coverPath])

  // 显示优先级：裁剪结果 > 原图流
  const coverDisplay = form.coverData || coverPreview

  const openCoverBrowser = () => {
    if (!form.mediaDir.trim()) {
      toast.error('请先填写/选择媒体目录')
      return
    }
    setBrowse('cover')
  }

  const submit = async () => {
    if (!form.nickname.trim()) throw new Error('请填写昵称')
    const body: any = {
      name: form.name.trim(),
      nickname: form.nickname.trim(),
      birthYearOnly: form.birthYearOnly,
      birthDate: form.birthYearOnly ? '' : form.birthDate,
      birthYear: form.birthYear ? parseInt(form.birthYear, 10) : null,
      hometown: form.hometown.trim(),
      education: form.education.trim(),
      heightCm: form.heightCm ? parseInt(form.heightCm, 10) : null,
      weightKg: form.weightKg ? parseFloat(form.weightKg) : null,
      remarks: form.remarks.trim(),
      rating: form.rating,
      pinned: form.pinned,
      mediaDir: form.mediaDir.trim(),
      coverPath: form.coverPath,
      coverData: form.coverData || null,
      accounts: form.accounts.filter((a) => a.type.trim() && a.value.trim()),
      tags: form.tags,
    }
    if (Number.isNaN(body.birthYear)) body.birthYear = null
    if (Number.isNaN(body.heightCm)) body.heightCm = null
    if (Number.isNaN(body.weightKg)) body.weightKg = null

    if (mode === 'create') {
      const r = await personApi.create(body)
      toast.success('人物已创建')
      setTimeout(() => onSaved(r.id), 700)
    } else if (person) {
      await personApi.update(person.id, body)
      toast.success('已保存修改')
      setTimeout(() => onSaved(person.id), 700)
    }
  }

  return (
    <>
      <Dialog open onOpenChange={(o) => !o && onClose()}>
        {/* 点击遮罩不关闭：避免填了一半误触丢失内容；Esc 与「取消」仍可关闭 */}
        <DialogContent
          className="max-w-5xl gap-0 p-0 sm:max-w-5xl"
          showCloseButton={false}
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogTitleBar title={mode === 'create' ? '添加人物' : '编辑人物'} titleClassName="text-lg" />
          <ScrollArea className="max-h-[80vh] p-5">
            <SmoothTab
              className="max-w-none"
              label="表单分区"
              defaultTabId="basic"
              items={[
                {
                  id: 'basic',
                  title: '档案信息',
                  icon: UserRound,
                  content: (
                    <div className="flex flex-col gap-3">
                      <SectionCard title="基本信息">
                        <div className="grid grid-cols-6 gap-x-4 gap-y-3">
                          <div className="col-span-3">
                            <FieldShell label="昵称" required>
                              <ShellInput
                                value={form.nickname}
                                onChange={(e) => set('nickname', e.target.value)}
                                placeholder="必填"
                                maxLength={64}
                              />
                            </FieldShell>
                          </div>
                          <div className="col-span-3">
                            <FieldShell label="姓名">
                              <ShellInput
                                value={form.name}
                                onChange={(e) => set('name', e.target.value)}
                                placeholder="选填"
                                maxLength={64}
                              />
                            </FieldShell>
                          </div>
                          <div className="col-span-3">
                            <FieldShell
                              label="出生日期"
                              right={
                                <span className="flex shrink-0 items-center gap-2 border-l border-border bg-muted/40 px-3">
                                  <Switch
                                    id="year-only"
                                    checked={form.birthYearOnly}
                                    onCheckedChange={(v) => set('birthYearOnly', v)}
                                  />
                                  <Label htmlFor="year-only" className="cursor-pointer text-xs text-muted-foreground">
                                    仅年份
                                  </Label>
                                </span>
                              }
                            >
                              {form.birthYearOnly ? (
                                <DateWheelPicker
                                  bare
                                  mode="year"
                                  value={form.birthYear}
                                  onChange={(v) => set('birthYear', v)}
                                  placeholder="选择年份"
                                />
                              ) : (
                                <DateWheelPicker
                                  bare
                                  mode="date"
                                  value={form.birthDate}
                                  onChange={(v) => set('birthDate', v)}
                                  placeholder="选择日期"
                                />
                              )}
                            </FieldShell>
                          </div>
                          <div className="col-span-3">
                            <FieldShell label="户籍地">
                              <ShellInput
                                value={form.hometown}
                                onChange={(e) => set('hometown', e.target.value)}
                                placeholder="如：河南洛阳"
                              />
                            </FieldShell>
                          </div>
                          <div className="col-span-2">
                            <FieldShell label="学历">
                              <SelectMenu
                                bare
                                value={form.education}
                                onChange={(v) => set('education', v)}
                                options={EDUCATION}
                                allowCustom
                                placeholder="选择或输入"
                              />
                            </FieldShell>
                          </div>
                          <div className="col-span-2">
                            <FieldShell label="身高 cm">
                              <ShellInput type="number" min={0} max={260} value={form.heightCm} onChange={(e) => set('heightCm', e.target.value)} />
                            </FieldShell>
                          </div>
                          <div className="col-span-2">
                            <FieldShell label="体重 kg">
                              <ShellInput type="number" min={0} max={300} step="0.1" value={form.weightKg} onChange={(e) => set('weightKg', e.target.value)} />
                            </FieldShell>
                          </div>
                          {/* 第 4 行：评分 + 固定。点当前已选中的星级即清除评分 */}
                          <div className="col-span-3">
                            <FieldShell label="评分">
                              <div className="flex min-w-0 flex-1 items-center gap-2.5 px-2.5">
                                <StarRating
                                  variant="input"
                                  size={18}
                                  value={form.rating}
                                  onChange={(n) => set('rating', n)}
                                />
                                <span className="text-xs text-muted-foreground">
                                  {form.rating ? `${form.rating} 星` : '未评分'}
                                </span>
                              </div>
                            </FieldShell>
                          </div>
                          <div className="col-span-3">
                            <FieldShell label="固定">
                              <div className="flex min-w-0 flex-1 items-center gap-2.5 px-2.5">
                                <Switch
                                  id="pin-person"
                                  checked={form.pinned}
                                  onCheckedChange={(v) => set('pinned', v)}
                                />
                                <Label
                                  htmlFor="pin-person"
                                  className="cursor-pointer text-xs text-muted-foreground"
                                >
                                  始终排在海报墙最前
                                </Label>
                              </div>
                            </FieldShell>
                          </div>
                        </div>
                      </SectionCard>

                      <SectionCard title="社交账号">
                        <AccountEditor value={form.accounts} onChange={(rows) => set('accounts', rows)} />
                      </SectionCard>

                      <SectionCard title="标签">
                          <TagInput value={form.tags} onChange={(tags) => set('tags', tags)} allTags={allTags} />
                      </SectionCard>

                      <SectionCard title="备注">
                          <textarea
                            value={form.remarks}
                            onChange={(e) => set('remarks', e.target.value)}
                            rows={3}
                            className="min-h-[92px] w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30"
                      />
                      </SectionCard>
                    </div>
                  ),
                },
                {
                  id: 'media',
                  title: '媒体与封面',
                  icon: ImageIcon,
                  content: (
                    <SectionCard title="媒体与封面" hint="选填">
                      <div className="flex flex-col gap-4">
                        <div className="flex flex-col gap-1.5">
                          <FieldShell
                            label="媒体目录"
                            right={
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-auto shrink-0 self-stretch rounded-none border-l border-border bg-muted/70 px-4 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                                onClick={() => setBrowse('dir')}
                              >
                                <FolderOpen className="size-4" /> 浏览
                              </Button>
                            }
                          >
                            <ShellInput
                              value={form.mediaDir}
                              onChange={(e) => {
                                set('mediaDir', e.target.value)
                                set('coverPath', '')
                              }}
                              placeholder="照片/视频所在目录的绝对路径"
                            />
                          </FieldShell>
                          <p className="text-xs text-muted-foreground">
                            创建后将自动扫描该目录（含子目录）中的图片与视频。
                          </p>
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <Label>封面</Label>
                          <div className="flex gap-5">
                            <button
                              type="button"
                              onClick={openCoverBrowser}
                              title="点击从媒体目录选择封面"
                              className="relative flex h-[240px] w-[160px] shrink-0 flex-col items-center justify-center gap-2 overflow-hidden rounded-lg border border-dashed border-border bg-muted/60 text-muted-foreground transition hover:border-primary hover:bg-accent/50 hover:text-primary"
                            >
                              {coverDisplay ? (
                                <img
                                  src={coverDisplay}
                                  alt="封面预览"
                                  className="absolute inset-0 size-full object-cover"
                                  onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
                                />
                              ) : (
                                <>
                                  <ImageIcon className="size-6" />
                                  <span className="px-2 text-center text-xs leading-4">点击选择封面图片</span>
                                </>
                              )}
                              {coverDisplay && (
                                <span
                                  role="button"
                                  tabIndex={0}
                                  className="absolute right-1.5 top-1.5 rounded-md bg-black/50 p-1 text-white/90 transition hover:bg-black/70"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setForm((f) => ({ ...f, coverPath: '', coverData: '' }))
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.stopPropagation()
                                      setForm((f) => ({ ...f, coverPath: '', coverData: '' }))
                                    }
                                  }}
                                >
                                  <X className="size-3" />
                                </span>
                              )}
                            </button>
                            <div className="flex min-h-[240px] flex-col justify-center gap-2.5">
                              <p className="max-w-[420px] break-all text-xs text-muted-foreground">
                                {form.coverPath
                                  ? `已选：${form.coverPath}${form.coverData ? '（已裁剪）' : ''}`
                                  : '未选择封面（海报墙将显示首字占位）'}
                              </p>
                              <div className="flex flex-wrap gap-2">
                                <Button variant="outline" size="sm" className="h-8" onClick={openCoverBrowser}>
                                  <ImageIcon className="size-4" /> 从目录选择
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8"
                                  disabled={!coverDisplay}
                                  onClick={() => setCropOpen(true)}
                                >
                                  <Crop className="size-4" /> 裁剪
                                </Button>
                              </div>
                              {form.coverData && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 self-start text-muted-foreground"
                                  onClick={() => set('coverData', '')}
                                >
                                  <RotateCcw className="size-3.5" /> 恢复原图
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </SectionCard>
                  ),
                },
              ]}
            />
          </ScrollArea>
          {/* p-0 内容区下抵消默认负边距，底栏贴边通栏 */}
          <DialogFooter className="mx-0 mb-0">
            <Button variant="outline" onClick={onClose}>
              取消
            </Button>
            <ParticleButton
              pendingLabel="保存中"
              successLabel={mode === 'create' ? '已创建' : '已保存'}
              errorLabel="保存失败"
              onClick={submit}
              onError={(e: unknown) => toast.error(e instanceof Error ? e.message : '保存失败')}
            >
              {mode === 'create' ? '创建' : '保存'}
            </ParticleButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {browse === 'dir' && (
        <FileBrowser
          mode="dir"
          initialPath={form.mediaDir || null}
          onClose={() => setBrowse(null)}
          onPick={(p) => {
            setForm((f) => ({ ...f, mediaDir: p, coverPath: '', coverData: '' }))
            setBrowse(null)
          }}
        />
      )}
      {cropOpen && coverDisplay && (
        <CropDialog
          src={coverDisplay}
          onConfirm={(d) => {
            set('coverData', d)
            setCropOpen(false)
            toast.success('封面已裁剪，保存后生效')
          }}
          onClose={() => setCropOpen(false)}
        />
      )}
      {browse === 'cover' && (
        <FileBrowser
          mode="image"
          title="选择封面图片"
          initialPath={form.mediaDir || null}
          onClose={() => setBrowse(null)}
          onPick={(abs) => {
            const rel = toRelative(form.mediaDir, abs)
            if (rel === null) toast.error('封面必须位于媒体目录内')
            else setForm((f) => ({ ...f, coverPath: rel, coverData: '' }))
            setBrowse(null)
          }}
        />
      )}
    </>
  )
}
