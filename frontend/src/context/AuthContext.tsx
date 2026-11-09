import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { authApi } from '../api'
import { getToken, getUser, setToken, setUser } from '../api/client'

interface AuthState {
  /** 登录用户名（不可改） */
  username: string | null
  /** 显示名称，未设置时为 null（展示时回退 username） */
  displayName: string | null
  /** 头像 base64 data URL */
  avatar: string | null
  loggedIn: boolean
  login: (token: string, username: string) => void
  logout: () => void
  /** 设置弹窗保存后刷新资料 */
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthState>({
  username: null,
  displayName: null,
  avatar: null,
  loggedIn: false,
  login: () => {},
  logout: () => {},
  refreshProfile: async () => {},
})

export function useAuth() {
  return useContext(AuthContext)
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [username, setUsername] = useState<string | null>(getUser())
  const [displayName, setDisplayName] = useState<string | null>(null)
  const [avatar, setAvatar] = useState<string | null>(null)

  // 拉取账号资料（含显示名与头像）；token 失效时静默忽略
  const refreshProfile = useCallback(async () => {
    try {
      const r = await authApi.me()
      setUsername(r.username)
      setDisplayName(r.displayName)
      setAvatar(r.avatar)
    } catch {
      // 忽略：未登录或网络错误
    }
  }, [])

  useEffect(() => {
    if (getToken()) {
      refreshProfile()
    }
  }, [refreshProfile])

  const login = (token: string, name: string) => {
    setToken(token)
    setUser(name)
    setUsername(name)
    refreshProfile()
  }
  const logout = () => {
    setToken(null)
    setUser(null)
    setUsername(null)
    setDisplayName(null)
    setAvatar(null)
  }

  return (
    <AuthContext.Provider
      value={{ username, displayName, avatar, loggedIn: !!getToken(), login, logout, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  )
}
