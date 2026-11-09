import axios from 'axios'

const TOKEN_KEY = 'femina_token'
const USER_KEY = 'femina_user'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}
export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}
export function getUser(): string | null {
  return localStorage.getItem(USER_KEY)
}
export function setUser(name: string | null) {
  if (name) localStorage.setItem(USER_KEY, name)
  else localStorage.removeItem(USER_KEY)
}

const client = axios.create({
  baseURL: '/api',
  timeout: 30000,
})

client.interceptors.request.use((config) => {
  const token = getToken()
  if (token) config.headers.Authorization = 'Bearer ' + token
  return config
})

client.interceptors.response.use(
  (resp) => {
    // 后端统一响应体 {code, message, data}
    const body = resp.data
    if (body && typeof body === 'object' && 'code' in body) {
      if (body.code === 0) return body.data
      return Promise.reject(new Error(body.message || '请求失败'))
    }
    return body
  },
  (error) => {
    const status = error.response?.status
    const message = error.response?.data?.message || error.message || '网络错误'
    if (status === 401) {
      setToken(null)
      setUser(null)
      // 跳登录（避免在登录页循环）
      if (!location.hash.startsWith('#/login') && !location.hash.startsWith('#/setup')) {
        location.hash = '#/login'
      }
    }
    return Promise.reject(new Error(message))
  }
)

export default client
