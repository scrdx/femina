import client, { getToken } from './client'
import type {
  FsListResult,
  MediaPage,
  MediaSortKey,
  MeetRecord,
  PageResult,
  PersonDetail,
  PersonFileNode,
  PersonForm,
  PersonSummary,
  Tag,
} from './types'

// ---- Auth ----
export const authApi = {
  status: () => client.get<any, { initialized: boolean }>('/auth/status'),
  setup: (username: string, password: string) =>
    client.post<any, void>('/auth/setup', { username, password }),
  login: (username: string, password: string) =>
    client.post<any, { token: string; username: string; expireHours: number }>('/auth/login', {
      username,
      password,
    }),
  me: () =>
    client.get<any, { username: string; displayName: string | null; avatar: string | null }>(
      '/auth/me'
    ),
  updateProfile: (displayName: string, avatar: string | null) =>
    client.put<any, void>('/auth/profile', { displayName, avatar }),
  changePassword: (oldPassword: string, newPassword: string) =>
    client.put<any, void>('/auth/password', { oldPassword, newPassword }),
}

// ---- Persons ----
export type SortKey =
  | 'nickname'
  | 'created'
  | 'updated'
  | 'media'
  | 'firstMeet'
  | 'lastMeet'
  | 'rating'
export type SortDir = 'asc' | 'desc'

export const personApi = {
  list: (
    keyword: string,
    page: number,
    size = 24,
    sortBy: SortKey = 'created',
    sortDir: SortDir = 'desc'
  ) =>
    client.get<any, PageResult<PersonSummary>>('/persons', {
      params: { keyword: keyword || undefined, page, size, sortBy, sortDir },
    }),
  create: (form: PersonForm) => client.post<any, { id: string }>('/persons', form),
  detail: (id: string) => client.get<any, PersonDetail>(`/persons/${id}`),
  update: (id: string, form: PersonForm) => client.put<any, void>(`/persons/${id}`, form),
  remove: (id: string) => client.delete<any, void>(`/persons/${id}`),
  rescan: (id: string) => client.post<any, { count: number }>(`/persons/${id}/rescan`),
  /** 快捷打分（卡片右键菜单）：rating 取 0-5，0 表示清除评分 */
  rate: (id: string, rating: number) =>
    client.put<any, void>(`/persons/${id}/rating`, { rating }),
  /** 固定 / 取消固定：固定后在列表里恒排最前 */
  pin: (id: string, pinned: boolean) =>
    client.put<any, void>(`/persons/${id}/pinned`, { pinned }),
  /** 见面记录：列表 / 新增（date 可为 null）/ 删除 */
  meets: (id: string) => client.get<any, MeetRecord[]>(`/persons/${id}/meets`),
  addMeet: (id: string, meetDate: string | null) =>
    client.post<any, MeetRecord>(`/persons/${id}/meets`, { meetDate }),
  removeMeet: (id: string, meetId: number) =>
    client.delete<any, void>(`/persons/${id}/meets/${meetId}`),
  /** 媒体明细分页；type=PHOTO|VIDEO，page 从 1 起，sort/dir 服务端白名单校验 */
  mediaPage: (
    id: string,
    type: 'PHOTO' | 'VIDEO',
    page: number,
    opts: { size?: number; sort?: MediaSortKey; dir?: 'asc' | 'desc' } = {}
  ) =>
    client.get<any, MediaPage>(`/persons/${id}/media`, {
      params: {
        type,
        page,
        size: opts.size ?? 48,
        sort: opts.sort ?? 'name',
        dir: opts.dir ?? 'asc',
      },
    }),
  /** 浏览人物媒体目录（只读）；path 为相对路径，空串为根目录 */
  files: (id: string, path = '') =>
    client.get<any, PersonFileNode[]>(`/persons/${id}/files`, {
      params: { path: path || undefined },
    }),
  tags: () => client.get<any, Tag[]>('/tags'),
}

// ---- Filesystem browse ----
export const fsApi = {
  list: (path: string | null, mode: 'dir' | 'image') =>
    client.get<any, FsListResult>('/fs/list', {
      params: { path: path || undefined, mode },
    }),
}

/**
 * 构造媒体文件访问 URL。<img>/<video> 无法带 Authorization 头，
 * 因此通过 token query 参数鉴权（后端已支持）。
 */
export function mediaUrl(personId: string, relPath: string): string {
  const token = getToken() || ''
  return (
    `/api/media/file?personId=${encodeURIComponent(personId)}` +
    `&path=${encodeURIComponent(relPath)}&token=${encodeURIComponent(token)}`
  )
}

/** 缩略图最长边（与后端 ThumbService.LONG_EDGE 一致） */
export const THUMB_LONG_EDGE = 1600

/**
 * 海报墙用的尺寸档：卡片只有 ~200-320px 宽，2x 屏也只要 ~640。
 * 用 1600 档等于让浏览器解码 6 倍于显示尺寸的图，110 张卡时直接掉帧。
 */
export const WALL_LONG_EDGE = 640

/**
 * 缩略图 URL：后端未配置缩略图目录 / 小图 / 生成失败时 302 回退原图，
 * 前端可无脑使用。图片墙与查看器适配态用它，避免解码 12–24MP 原图。
 * longEdge 为尺寸档（后端吸附到固定档位），不传用后端默认 1600。
 */
export function mediaThumbUrl(personId: string, relPath: string, longEdge?: number): string {
  const token = getToken() || ''
  return (
    `/api/media/thumb?personId=${encodeURIComponent(personId)}` +
    `&path=${encodeURIComponent(relPath)}` +
    (longEdge ? `&longEdge=${longEdge}` : '') +
    `&token=${encodeURIComponent(token)}`
  )
}

/**
 * 封面 URL：有裁剪封面时后端输出裁剪结果（按尺寸档降采样、可长缓存），
 * 否则 302 到缩略图接口。列表 JSON 不再内联 base64 封面，封面一律走这里。
 */
export function coverUrl(personId: string, longEdge: number = WALL_LONG_EDGE): string {
  const token = getToken() || ''
  return `/api/persons/${encodeURIComponent(personId)}/cover?longEdge=${longEdge}&token=${encodeURIComponent(token)}`
}

/** 按绝对路径预览图片（创建/编辑时选封面用），只读。 */
export function previewUrl(absPath: string): string {
  const token = getToken() || ''
  return `/api/fs/preview?path=${encodeURIComponent(absPath)}&token=${encodeURIComponent(token)}`
}
