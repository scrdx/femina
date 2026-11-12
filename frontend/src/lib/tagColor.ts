import type { CSSProperties } from 'react'

/**
 * 标签展示色（不入库）：
 * 标签名经 murmur 风格哈希落到 12 个等距色相桶；同一展示集合内若撞色，
 * 线性探测到下一个空桶，保证同组标签颜色互不相同。
 */

const BUCKETS = 12

function baseBucket(name: string): number {
  let h = 0
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) >>> 0
  }
  h ^= h >>> 16
  h = Math.imul(h, 0x85ebca6b)
  h ^= h >>> 13
  h = Math.imul(h, 0xc2b2ae35)
  h ^= h >>> 16
  return (h >>> 0) % BUCKETS
}

/** 单个标签的稳定色相（度）；大量标签（如标签云）用这个，不保证互不相同 */
export function hueOf(name: string): number {
  return baseBucket(name) * (360 / BUCKETS)
}

/**
 * 为一组标签分配互不相同的色相（度）。
 * 前 BUCKETS 个走「哈希桶 + 线性探测」，探测必须是有界的：桶占满后再用
 * while (used.has(b)) 会在 12 个已占桶里无限绕圈，把渲染卡死。
 * 超出部分按黄金角另给色相，既不与前面撞色，也不受 BUCKETS 上限约束。
 */
export function tagHues(names: string[]): Record<string, number> {
  const used = new Set<number>()
  const out: Record<string, number> = {}
  for (const n of names) {
    if (out[n] !== undefined) continue
    let b = baseBucket(n)
    let free = !used.has(b)
    for (let step = 1; !free && step < BUCKETS; step++) {
      b = (b + 1) % BUCKETS
      free = !used.has(b)
    }
    if (!free) {
      // 桶已满：黄金角（≈137.508°）递推，色相彼此拉开且不会重色
      out[n] = (Object.keys(out).length * 137.508) % 360
      continue
    }
    used.add(b)
    out[n] = b * (360 / BUCKETS)
  }
  return out
}

/** onDark：用于照片渐变等深色背景上的标签 chip */
export function chipStyle(hue: number, onDark = false): CSSProperties {
  return onDark
    ? {
        background: `hsla(${hue}, 65%, 55%, 0.30)`,
        borderColor: `hsla(${hue}, 75%, 78%, 0.50)`,
        color: '#ffffff',
      }
    : {
        background: `hsl(${hue} 78% 93%)`,
        borderColor: `hsl(${hue} 55% 82%)`,
        color: `hsl(${hue} 62% 30%)`,
      }
}
