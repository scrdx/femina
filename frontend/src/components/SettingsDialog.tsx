import { useEffect, useRef, useState } from 'react'
import { Camera, KeyRound, User, X } from 'lucide-react'
import { toast } from 'sonner'
import ParticleButton from '@/components/kokonutui/particle-button'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitleBar,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { authApi } from '../api'
import { useAuth } from '../context/AuthContext'
import { cn } from '@/lib/utils'

type Section = 'profile' | 'password'

const NAV: { id: Section; label: string; icon: typeof User }[] = [
  { id: 'profile', label: '用户信息', icon: User },
  { id: 'password', label: '密码', icon: KeyRound },
]

/** 头像上传上限（原图字节数；后端另限制 base64 字符串长度） */
const MAX_AVATAR_BYTES = 500 * 1024

/**
 * 设置弹窗：左侧功能导航 + 右侧内容。
 * - 用户信息：修改显示名称与头像（头像以 base64 存库，不落盘）
 * - 密码：修改登录密码（需验证原密码）
 */
export default function SettingsDialog({ onClose }: { onClose: () => void }) {
  const [section, setSection] = useState<Section>('profile')

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="max-w-[620px] gap-0 overflow-hidden p-0 sm:max-w-[620px]"
        showCloseButton={false}
      >
        {/* 只加左内边距：右侧必须留空，关闭按钮才能贴住弹窗右上角 */}
        <DialogTitleBar title="设置" className="pl-6" />
        <DialogDescription className="sr-only">账户设置：用户信息与密码</DialogDescription>

        <div className="grid grid-cols-[150px_1fr]">
          {/* 左侧功能列表 */}
          <nav aria-label="设置分类" className="flex flex-col gap-1 border-r border-border bg-muted/40 p-2.5">
            {NAV.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setSection(id)}
                aria-current={section === id}
                className={cn(
                  'flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors',
                  section === id
                    ? 'bg-card font-medium text-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-card/60 hover:text-foreground'
                )}
              >
                <Icon className="size-4" />
                {label}
              </button>
            ))}
          </nav>

          {/* 右侧内容 */}
          <div className="min-h-[340px] p-6">
            {section === 'profile' ? <ProfilePanel /> : <PasswordPanel />}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** 用户信息：显示名称 + 头像 */
function ProfilePanel() {
  const { username, displayName, avatar, refreshProfile } = useAuth()
  const [name, setName] = useState(displayName || username || '')
  const [avatarDraft, setAvatarDraft] = useState<string | null>(avatar)
  const fileRef = useRef<HTMLInputElement>(null)

  // 上下文异步加载完成后同步初始值
  useEffect(() => {
    setName((prev) => (prev ? prev : displayName || username || ''))
    setAvatarDraft(avatar)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayName, avatar])

  const pickAvatar = (file: File | undefined) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('请选择图片文件')
      return
    }
    if (file.size > MAX_AVATAR_BYTES) {
      toast.error('图片过大，请选择 500KB 以内的图片')
      return
    }
    const reader = new FileReader()
    reader.onload = () => setAvatarDraft(String(reader.result))
    reader.readAsDataURL(file)
  }

  const save = async () => {
    const trimmed = name.trim()
    if (!trimmed) throw new Error('用户名称不能为空')
    if (trimmed.length > 32) throw new Error('用户名称最长 32 字')
    await authApi.updateProfile(trimmed, avatarDraft)
    await refreshProfile()
    toast.success('用户信息已保存')
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Label>头像</Label>
        <div className="mt-2.5 flex items-center gap-4">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            title="点击更换头像"
            className="group relative grid size-20 shrink-0 place-items-center overflow-hidden rounded-full border border-border bg-muted text-lg font-medium text-muted-foreground transition hover:border-primary/60"
          >
            {avatarDraft ? (
              <img src={avatarDraft} alt="头像预览" className="absolute inset-0 size-full object-cover" />
            ) : (
              (displayName || username || '?').charAt(0).toUpperCase()
            )}
            <span className="absolute inset-0 hidden items-center justify-center bg-black/45 text-white group-hover:flex">
              <Camera className="size-5" />
            </span>
          </button>
          <div className="flex flex-col gap-1.5">
            <Button variant="outline" size="sm" className="h-8 self-start" onClick={() => fileRef.current?.click()}>
              选择图片
            </Button>
            {avatarDraft && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 self-start text-muted-foreground"
                onClick={() => setAvatarDraft(null)}
              >
                <X className="size-3.5" /> 移除头像
              </Button>
            )}
            <p className="text-xs text-muted-foreground">jpg / png / webp，500KB 以内</p>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              pickAvatar(e.target.files?.[0])
              e.target.value = ''
            }}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="set-name">用户名称</Label>
        <Input
          id="set-name"
          value={name}
          maxLength={32}
          onChange={(e) => setName(e.target.value)}
          placeholder="菜单与账号卡显示的名称"
        />
        <p className="text-xs text-muted-foreground">登录账号 {username || '—'} 保持不变，仅修改显示名称</p>
      </div>

      <div className="mt-auto flex justify-end pt-2">
        <ParticleButton
          variant="outline"
          pendingLabel="保存中"
          successLabel="已保存"
          errorLabel="保存失败"
          onClick={save}
          onError={(e: unknown) => toast.error(e instanceof Error ? e.message : '保存失败')}
        >
          保存
        </ParticleButton>
      </div>
    </div>
  )
}

/** 密码：修改登录密码 */
function PasswordPanel() {
  const [oldPassword, setOld] = useState('')
  const [newPassword, setNew] = useState('')
  const [confirm, setConfirm] = useState('')

  const submit = async () => {
    if (!oldPassword || !newPassword) throw new Error('请填写完整')
    if (newPassword.length < 6) throw new Error('新密码至少 6 位')
    if (newPassword !== confirm) throw new Error('两次输入的新密码不一致')
    await authApi.changePassword(oldPassword, newPassword)
    setOld('')
    setNew('')
    setConfirm('')
    toast.success('密码已修改，下次登录请使用新密码')
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="set-pw-old">原密码</Label>
        <Input id="set-pw-old" type="password" value={oldPassword} onChange={(e) => setOld(e.target.value)} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="set-pw-new">新密码</Label>
        <Input
          id="set-pw-new"
          type="password"
          value={newPassword}
          onChange={(e) => setNew(e.target.value)}
          placeholder="至少 6 位"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="set-pw-new2">确认新密码</Label>
        <Input id="set-pw-new2" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      </div>
      <div className="mt-auto flex justify-end pt-2">
        <ParticleButton
          variant="outline"
          pendingLabel="提交中"
          successLabel="已修改"
          errorLabel="修改失败"
          onClick={submit}
          onError={(e: unknown) => toast.error(e instanceof Error ? e.message : '修改失败')}
        >
          确认修改
        </ParticleButton>
      </div>
    </div>
  )
}
