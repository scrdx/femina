import { Pin } from 'lucide-react'

/**
 * 「已固定」标记：贴在容器左上角的折角三角，两条直角边与容器边缘齐平，
 * 外圆角交给容器自己的 overflow-hidden 裁出（卡片面和详情页封面都满足）。
 * 配色与卡片上其它浮层（星星角标、详情按钮）同族：深色玻璃 + 浅色图标，
 * 不额外引入彩色，避免和琥珀色的星星抢注意力。
 * 注意不能加 backdrop-blur：Chromium 下 backdrop-filter 的作用区域不被 clip-path
 * 裁剪，会在三角外面漏出一块方形模糊底。
 * 要求父容器 relative + overflow-hidden。
 */
export default function PinnedFold() {
  return (
    <div
      role="img"
      aria-label="已固定，恒排在最前"
      title="已固定，恒排在最前"
      className="pointer-events-none absolute left-0 top-0 size-11 bg-black/45 [clip-path:polygon(0_0,100%_0,0_100%)] [filter:drop-shadow(1px_1px_2px_rgb(0_0_0/0.35))]"
    >
      <Pin className="absolute left-[7px] top-[7px] size-3.5 text-white/85" />
    </div>
  )
}
