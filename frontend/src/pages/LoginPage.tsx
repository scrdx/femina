import { useState } from 'react'
import { toast } from 'sonner'
import ParticleButton from '@/components/kokonutui/particle-button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { authApi } from '../api'
import { useAuth } from '../context/AuthContext'
import AuthShell from '../components/AuthShell'

export default function LoginPage() {
  const { login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  const submit = async () => {
    if (!username.trim() || !password) throw new Error('请填写用户名和密码')
    const r = await authApi.login(username.trim(), password)
    login(r.token, r.username)
    setTimeout(() => location.reload(), 700) // Gate 重新判定进入主页
  }

  return (
    <AuthShell subtitle="人物档案 · 登录以继续">
      <form className="auth-form flex flex-col gap-5" onSubmit={(e) => e.preventDefault()}>
        <div className="flex flex-col gap-2">
          <Label htmlFor="lg-user">用户名</Label>
          <Input id="lg-user" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="lg-pwd">密码</Label>
          <Input
            id="lg-pwd"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <ParticleButton
          className="w-full"
          pendingLabel="登录中"
          successLabel="已登录"
          errorLabel="密码错误"
          onClick={submit}
          onError={(e: unknown) => toast.error(e instanceof Error ? e.message : '登录失败')}
        >
          登 录
        </ParticleButton>
      </form>
    </AuthShell>
  )
}
