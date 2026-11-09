import { useState } from 'react'
import { toast } from 'sonner'
import ParticleButton from '@/components/kokonutui/particle-button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { authApi } from '../api'
import AuthShell from '../components/AuthShell'

/**
 * 首次使用：设置管理员用户名和密码。
 */
export default function SetupPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')

  const submit = async () => {
    if (!username.trim() || !password) throw new Error('请填写用户名和密码')
    if (password.length < 6) throw new Error('密码至少 6 位')
    if (password !== confirm) throw new Error('两次输入的密码不一致')
    await authApi.setup(username.trim(), password)
    toast.success('管理员账号已创建，请登录')
    setTimeout(() => location.reload(), 900)
  }

  return (
    <AuthShell subtitle="首次使用 · 设置管理员账号">
      <form
        className="auth-form flex flex-col gap-5"
        onSubmit={(e) => e.preventDefault()}
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor="su-user">用户名</Label>
          <Input
            id="su-user"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="设置管理员用户名"
            autoFocus
            maxLength={32}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="su-pwd">密码</Label>
          <Input
            id="su-pwd"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="至少 6 位"
            maxLength={64}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="su-pwd2">确认密码</Label>
          <Input
            id="su-pwd2"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="再次输入密码"
            maxLength={64}
          />
        </div>
        <ParticleButton
          className="w-full"
          pendingLabel="创建中"
          successLabel="已创建"
          errorLabel="创建失败"
          onClick={submit}
          onError={(e: unknown) => toast.error(e instanceof Error ? e.message : '创建失败')}
        >
          创建管理员账号
        </ParticleButton>
      </form>
    </AuthShell>
  )
}
