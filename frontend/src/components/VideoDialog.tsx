import { Dialog, DialogContent, DialogTitleBar } from '@/components/ui/dialog'
import { mediaUrl } from '../api'
import type { MediaItem } from '../api/types'

interface Props {
  personId: string
  item: MediaItem | null
  onClose: () => void
}

/**
 * 视频播放弹窗。src 走后端 Range 流接口，支持进度拖动。
 * 浏览器原生可播 mp4/webm 等；mkv/avi 等取决于浏览器编解码支持。
 */
export default function VideoDialog({ personId, item, onClose }: Props) {
  return (
    <Dialog open={!!item} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl gap-0 border-none bg-black/95 p-0 sm:rounded-lg" showCloseButton={false}>
        <DialogTitleBar
          title={item?.fileName ?? '视频播放'}
          className="border-white/15"
          titleClassName="text-zinc-100"
        />
        {item && (
          <video
            src={mediaUrl(personId, item.relPath)}
            controls
            autoPlay
            controlsList="nodownload"
            className="max-h-[80vh] w-full rounded-lg bg-black"
          >
            您的浏览器不支持该视频格式。
          </video>
        )}
      </DialogContent>
    </Dialog>
  )
}
