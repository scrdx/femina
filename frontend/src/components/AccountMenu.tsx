import { useState } from 'react'
import { Settings } from 'lucide-react'
import { useTheme } from 'next-themes'
import ProfileDropdown, { type AccountTheme } from '@/components/kokonutui/profile-dropdown'
import { useAuth } from '../context/AuthContext'
import SettingsDialog from './SettingsDialog'

/**
 * 右上角账户菜单（kokonut Account Menu）：
 * 主题（浅色·深色·跟随系统）/ 设置（弹窗内含用户信息与密码）/ 长按退出登录。
 * 单管理员系统：不启用 status 与 switch account。
 */
export default function AccountMenu() {
  const { username, displayName, avatar, logout } = useAuth()
  const { theme, setTheme } = useTheme()
  const [showSettings, setShowSettings] = useState(false)

  const accountTheme: AccountTheme =
    theme === 'light' || theme === 'dark' ? theme : 'system'

  return (
    <>
      <ProfileDropdown
        accounts={[
          {
            id: 'admin',
            name: displayName || username || '管理员',
            email: username ? `登录账号 · ${username}` : 'Administrator',
            image: avatar || undefined,
            plan: 'Admin',
          },
        ]}
        items={[
          {
            label: '设置',
            icon: <Settings className="size-4" />,
            onSelect: () => setShowSettings(true),
          },
        ]}
        theme={accountTheme}
        onThemeChange={(t) => setTheme(t)}
        holdDuration={900}
        onSignOut={() => {
          logout()
          location.hash = '#/login'
          location.reload()
        }}
      />
      {showSettings && <SettingsDialog onClose={() => setShowSettings(false)} />}
    </>
  )
}
