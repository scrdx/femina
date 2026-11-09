import { useEffect, useState } from 'react'
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Toaster } from '@/components/ui/sonner'
import { authApi } from './api'
import { getToken } from './api/client'
import { AuthProvider } from './context/AuthContext'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import PersonDetailPage from './pages/PersonDetailPage'
import SetupPage from './pages/SetupPage'

/**
 * 入口守卫：
 * - 系统未初始化 -> 只有 /setup 可访问
 * - 未登录 -> 只有 /login 可访问
 * - 已登录 -> / 与 /person/:id
 */
function Gate() {
  const location = useLocation()
  const [state, setState] = useState<'loading' | 'need-setup' | 'need-login' | 'ready'>('loading')

  useEffect(() => {
    let mounted = true
    authApi
      .status()
      .then((r) => {
        if (!mounted) return
        if (!r.initialized) setState('need-setup')
        else if (!getToken()) setState('need-login')
        else setState('ready')
      })
      .catch(() => mounted && setState('need-login'))
    return () => {
      mounted = false
    }
  }, [location.pathname])

  if (state === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center font-heading text-sm tracking-[0.3em] text-muted-foreground">
        FEMINA
      </div>
    )
  }
  if (state === 'need-setup') {
    return location.pathname === '/setup' ? <SetupPage /> : <Navigate to="/setup" replace />
  }
  if (state === 'need-login') {
    return location.pathname === '/login' ? <LoginPage /> : <Navigate to="/login" replace />
  }
  // ready
  if (location.pathname === '/login' || location.pathname === '/setup') {
    return <Navigate to="/" replace />
  }
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/person/:id" element={<PersonDetailPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <Gate />
        <Toaster position="top-center" />
      </HashRouter>
    </AuthProvider>
  )
}
