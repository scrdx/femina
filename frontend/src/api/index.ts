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
 * 缩略图 URL：后端未配置缩略图目录 / 小图 / 生成失败时 302 回退原图，
 * 前端可无脑使用。图片墙与查看器适配态用它，避免解码 12–24MP 原图。
 */
export function mediaThumbUrl(personId: string, relPath: string): string {
  const token = getToken() || ''
  return (
    `/api/media/thumb?personId=${encodeURIComponent(personId)}` +
    `&path=${encodeURIComponent(relPath)}&token=${encodeURIComponent(token)}`
  )
}

/** 按绝对路径预览图片（创建/编辑时选封面用），只读。 */
export function previewUrl(absPath: string): string {
  const token = getToken() || ''
  return `/api/fs/preview?path=${encodeURIComponent(absPath)}&token=${encodeURIComponent(token)}`
}
