export interface AccountEntry {
  type: string
  value: string
}

export interface PersonSummary {
  id: string
  name: string
  nickname: string | null
  coverPath: string | null
  /** 裁剪后封面 data URL，优先于 coverPath 显示 */
  coverData: string | null
  birthYearOnly: boolean | null
  birthDate: string | null
  birthYear: number | null
  hometown: string | null
  education: string | null
  heightCm: number | null
  weightKg: number | null
  /** 媒体文件数（照片+视频） */
  mediaCount: number
  tags: string[]
}

export interface MediaItem {
  id: number
  personId: string
  type: 'PHOTO' | 'VIDEO'
  relPath: string
  fileName: string
  ext: string
  fileSize: number
}

export interface PersonDetail {
  id: string
  name: string
  nickname: string | null
  birthYearOnly: boolean
  birthDate: string | null
  birthYear: number | null
  hometown: string | null
  education: string | null
  heightCm: number | null
  weightKg: number | null
  mediaDir: string | null
  coverPath: string | null
  coverData: string | null
  remarks: string | null
  createdAt: string | null
  accounts: AccountEntry[]
  tags: string[]
  photos: MediaItem[]
  videos: MediaItem[]
}

export interface PersonForm {
  name: string
  nickname: string
  birthYearOnly: boolean
  birthDate: string
  birthYear: number | ''
  hometown: string
  education: string
  heightCm: number | ''
  weightKg: number | ''
  mediaDir: string
  coverPath: string
  coverData: string | null
  accounts: AccountEntry[]
  tags: string[]
}

export interface PageResult<T> {
  items: T[]
  total: number
  page: number
  size: number
}

export interface FsNode {
  name: string
  path: string
  dir: boolean
  image: boolean
}

export interface FsListResult {
  current: string | null
  parent: string | null
  mediaRoot: string | null
  nodes: FsNode[]
}

export interface Tag {
  id: number
  name: string
  /** 使用人数（标签云按热度加权） */
  count: number
}

export interface PersonFileNode {
  name: string
  /** 相对 mediaDir 的路径，/ 分隔 */
  relPath: string
  dir: boolean
  type: 'DIR' | 'PHOTO' | 'VIDEO' | 'FILE'
  size: number
  /** yyyy-MM-dd HH:mm */
  modified: string
}
