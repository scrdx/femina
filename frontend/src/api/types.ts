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
  /** 评分 1-5，0 表示未评分（卡片仅在 >0 时显示星星） */
  rating: number
  /** 固定置顶：恒排列表最前，不参与排序 */
  pinned: boolean
  tags: string[]
}

export type MediaSortKey = 'name' | 'size' | 'dims' | 'created' | 'modified'

/** 见面记录；meetDate 可为 null（非必填） */
export interface MeetRecord {
  id: number
  personId: string
  meetDate: string | null
  createdAt: string | null
}

export interface MediaItem {
  id: number
  personId: string
  type: 'PHOTO' | 'VIDEO'
  relPath: string
  fileName: string
  ext: string
  fileSize: number
  /** 图片宽高 px；0/null 表示未知（存量回填完成前） */
  width: number | null
  height: number | null
  modifiedAt: string | null
  /** 文件创建时间（文件系统） */
  fileCreatedAt: string | null
  /** 记录登记时间 */
  createdAt: string | null
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
  /** 评分 1-5，0 表示未评分 */
  rating: number
  /** 固定置顶 */
  pinned: boolean
  createdAt: string | null
  accounts: AccountEntry[]
  tags: string[]
  /** 媒体明细走分页接口，详情只带计数 */
  photoCount: number
  videoCount: number
}

export interface MediaPage {
  items: MediaItem[]
  total: number
  page: number
  size: number
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
  /** 评分 1-5，0 表示未评分 */
  rating: number
  pinned: boolean
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
