"use client";

/**
 * @author: @dorianbaffier
 * @description: Lightbox Grid
 * @version: 1.0.0
 * @date: 2026-10-15
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import {
  animate,
  type MotionValue,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "motion/react";
import {
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  type Ref,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import ImageViewToolbar from "@/components/ImageViewToolbar";
import {
  useImageView,
  viewBox,
  type ImageViewApi,
} from "@/hooks/useImageView";
import RasterImage from "@/components/RasterImage";
import { THUMB_LONG_EDGE } from "@/api";

export interface LightboxImage {
  src: string;
  /** 缩略图（≤1600px）：网格与查看器适配态用它，缺省回退 src */
  thumb?: string;
  alt: string;
  /** Natural size, used to fit the open view without waiting for a load. */
  width: number;
  height: number;
  caption?: string;
}

export interface LightboxGridProps {
  images?: LightboxImage[];
  className?: string;
  /** 翻页越过已加载列表边界时调用（分页场景由父级换页） */
  onStepBeyond?: (direction: 1 | -1) => void;
  /** 父级换页后请求打开指定下标；token 变化才生效 */
  openRequest?: { index: number; token: number } | null;
  /** 分页上下文：当前页之前/之后还有页（边界处箭头不置灰、可跨页） */
  hasMoreBefore?: boolean;
  hasMoreAfter?: boolean;
}

const unsplash = (id: string, w: number, h: number) =>
  `https://images.unsplash.com/photo-${id}?w=${w}&h=${h}&fit=crop&auto=format&q=80`;

const DEFAULT_IMAGES: LightboxImage[] = [
  {
    src: unsplash("1501785888041-af3ef285b470", 1600, 1067),
    alt: "A lake below mountains",
    width: 1600,
    height: 1067,
    caption: "Lake shore, early morning",
  },
  {
    src: unsplash("1506905925346-21bda4d32df4", 1200, 1600),
    alt: "Peaks above the clouds",
    width: 1200,
    height: 1600,
    caption: "Above the cloud line",
  },
  {
    src: unsplash("1470071459604-3b5ec3a7fe05", 1600, 1067),
    alt: "Misty hills",
    width: 1600,
    height: 1067,
    caption: "Fog over the hills",
  },
  {
    src: unsplash("1441974231531-c6227db76b6e", 1200, 1600),
    alt: "Light through a forest",
    width: 1200,
    height: 1600,
    caption: "Forest, late afternoon",
  },
  {
    src: unsplash("1469474968028-56623f02e42e", 1600, 1067),
    alt: "Sun setting over a valley",
    width: 1600,
    height: 1067,
    caption: "Valley at sunset",
  },
  {
    src: unsplash("1433086966358-54859d0ed716", 1200, 1600),
    alt: "A waterfall",
    width: 1200,
    height: 1600,
    caption: "Waterfall after rain",
  },
];

const EASE: [number, number, number, number] = [0.23, 1, 0.32, 1];
const OPEN = { type: "spring", duration: 0.5, bounce: 0.12 } as const;
const CLOSE = { type: "spring", duration: 0.42, bounce: 0.08 } as const;
const SETTLE = { type: "spring", duration: 0.35, bounce: 0.2 } as const;
// The open image keeps this much room around it, and below for the caption.
const MARGIN = 48;
const MARGIN_SMALL = 12;
// 图片下方预留带：文件名(+18) 与查看工具栏(+56..+108)。
const CAPTION_ROOM = 120;
const OPEN_RADIUS = 10;
// Drag thresholds: distance in px, speed in px/ms.
const DISMISS_DISTANCE = 110;
const DISMISS_SPEED = 0.55;
const SWIPE_SPEED = 0.45;
const AXIS_LOCK = 6;

interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface Frame {
  x: number;
  y: number;
  scale: number;
  clip: string;
}

/** Where an image of this size sits when open, fitted to the window. */
function fitRect(image: LightboxImage): Rect {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const margin = vw < 640 ? MARGIN_SMALL : MARGIN;
  const maxW = vw - margin * 2;
  const maxH = vh - margin * 2 - CAPTION_ROOM;
  const scale = Math.min(maxW / image.width, maxH / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  return {
    left: (vw - width) / 2,
    top: (vh - CAPTION_ROOM - height) / 2,
    width,
    height,
  };
}

/** 旋转后重新适配：90° 的奇数倍按交换宽高拟合外框 */
function fitRectFor(image: LightboxImage, rot: number): Rect {
  return rot % 180 !== 0
    ? fitRect({ ...image, width: image.height, height: image.width })
    : fitRect(image);
}

const openClip = () => `inset(0px 0px 0px 0px round ${OPEN_RADIUS}px)`;

/**
 * The transform and crop that make the open image look exactly like its
 * thumbnail: scaled down to the thumbnail's cover size, moved onto it, and
 * cropped to its box. Animating from here to identity is the whole trick.
 */
function thumbFrame(
  open: Rect,
  thumb: DOMRect,
  image: LightboxImage,
  radius: number
): Frame {
  const imageRatio = image.width / image.height;
  const thumbRatio = thumb.width / thumb.height;
  const coverWidth =
    imageRatio > thumbRatio ? thumb.height * imageRatio : thumb.width;
  const scale = coverWidth / open.width;
  const insetX = (open.width - thumb.width / scale) / 2;
  const insetY = (open.height - thumb.height / scale) / 2;
  return {
    x: thumb.left + thumb.width / 2 - (open.left + open.width / 2),
    y: thumb.top + thumb.height / 2 - (open.top + open.height / 2),
    scale,
    clip: `inset(${insetY}px ${insetX}px ${insetY}px ${insetX}px round ${radius / scale}px)`,
  };
}

function isVisible(rect: DOMRect) {
  return (
    rect.bottom > 0 &&
    rect.top < window.innerHeight &&
    rect.right > 0 &&
    rect.left < window.innerWidth
  );
}

function IconButton({
  label,
  onClick,
  className,
  children,
  buttonRef,
  unavailable,
}: {
  label: string;
  onClick: () => void;
  className?: string;
  children: ReactNode;
  buttonRef?: Ref<HTMLButtonElement>;
  /** Dimmed but still focusable, so focus never drops out of the viewer. */
  unavailable?: boolean;
}) {
  return (
    <button
      aria-disabled={unavailable || undefined}
      aria-label={label}
      className={cn(
        "flex size-10 items-center justify-center rounded-full bg-white/10 text-white transition-[background-color,opacity] duration-150 hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-white/70 aria-disabled:cursor-default aria-disabled:opacity-30 aria-disabled:hover:bg-white/10",
        className
      )}
      onClick={onClick}
      ref={buttonRef}
      type="button"
    >
      {children}
    </button>
  );
}

function Chevron({ flip }: { flip?: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className={cn("size-4", flip && "rotate-180")}
      fill="none"
      viewBox="0 0 16 16"
    >
      <path
        d="m6 3.5 4.5 4.5L6 12.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
    </svg>
  );
}

interface ViewerProps {
  images: LightboxImage[];
  index: number;
  rect: Rect;
  x: MotionValue<number>;
  y: MotionValue<number>;
  scale: MotionValue<number>;
  clip: MotionValue<string>;
  alpha: MotionValue<number>;
  fade: MotionValue<number>;
  settled: boolean;
  view: ImageViewApi;
  rot: number;
  hasMoreBefore: boolean;
  hasMoreAfter: boolean;
  onRotate: (direction: 1 | -1) => void;
  onClose: (velocity?: { x: number; y: number }) => void;
  onStep: (direction: 1 | -1) => void;
}

function Viewer({
  images,
  index,
  rect,
  x,
  y,
  scale,
  clip,
  alpha,
  fade,
  settled,
  view,
  rot,
  hasMoreBefore,
  hasMoreAfter,
  onRotate,
  onClose,
  onStep,
}: ViewerProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    id: number;
    startX: number;
    startY: number;
    axis: "x" | "y" | "pan" | null;
    /** 按下时的平移起点，pan 模式用绝对落位避免累积误差 */
    panStart: { x: number; y: number };
    samples: { x: number; y: number; t: number }[];
  } | null>(null);
  // wheel 门控：开合动画未落定时不缩放。settled 经 ref 读，保持 ref 回调稳定。
  const settledRef = useRef(settled);
  settledRef.current = settled;
  const wheelRef = useCallback(
    (node: HTMLDivElement | null) => {
      view.attachWheel(node, () => settledRef.current);
    },
    [view.attachWheel]
  );
  const backdrop = useTransform(fade, (v) => v * 0.92);
  const image = images[index];
  const box = viewBox(rect, rot);
  // 分页上下文里列表边界之外还有页：箭头不置灰，越界翻页交给父级
  const hasPrev = index > 0 || hasMoreBefore;
  const hasNext = index < images.length - 1 || hasMoreAfter;
  // 显示尺寸 = 适配盒 × zoom；光栅化与 1:1 展示由 RasterImage 负责
  const displayW = box.width * view.zoom;
  const displayH = box.height * view.zoom;
  // 适配态吃缩略图（解码快、内存小）；放大超过缩略图分辨率切回原图保清晰
  const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
  const viewerSrc =
    image.thumb && Math.max(displayW, displayH) * dpr <= THUMB_LONG_EDGE
      ? image.thumb
      : image.src;

  useEffect(() => {
    closeRef.current?.focus({ preventScroll: true });
  }, []);

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    // React 合成事件沿 React 树冒泡（跨 portal），不拦住的话底层 smooth-tab
    // 的 onPointerDown 会 setPointerCapture 把指针中途抢走
    event.stopPropagation();
    if (!settled || event.button !== 0) {
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      id: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      // 放大后拖拽 = 平移，不再进入关闭/翻页手势
      axis: view.zoomed ? "pan" : null,
      panStart: { x: view.panX, y: view.panY },
      samples: [{ x: event.clientX, y: event.clientY, t: event.timeStamp }],
    };
  };

  // Pulling away shrinks the photo and lets the page show through.
  const followVertical = (dx: number, dy: number) => {
    const pull = Math.min(Math.abs(dy) / window.innerHeight, 1);
    x.set(dx);
    y.set(dy);
    scale.set(1 - pull * 0.45);
    fade.set(1 - Math.min(Math.abs(dy) / 360, 1) * 0.85);
  };

  // Past the first or last photo the drag only gives a little.
  const followHorizontal = (dx: number) => {
    const blocked = (dx > 0 && !hasPrev) || (dx < 0 && !hasNext);
    x.set(blocked ? dx * 0.25 : dx);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== event.pointerId) {
      return;
    }
    event.stopPropagation();
    const dx = event.clientX - d.startX;
    const dy = event.clientY - d.startY;
    if (d.axis === "pan") {
      view.setPan(d.panStart.x + dx, d.panStart.y + dy);
      return;
    }
    if (!d.axis) {
      if (Math.hypot(dx, dy) < AXIS_LOCK) {
        return;
      }
      d.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
    }
    d.samples.push({ x: event.clientX, y: event.clientY, t: event.timeStamp });
    if (d.samples.length > 5) {
      d.samples.shift();
    }
    if (d.axis === "y") {
      followVertical(dx, dy);
    } else {
      followHorizontal(dx);
    }
  };

  const releaseVertical = (dy: number, velocity: { x: number; y: number }) => {
    if (
      Math.abs(dy) > DISMISS_DISTANCE ||
      Math.abs(velocity.y) > DISMISS_SPEED
    ) {
      onClose(velocity);
      return;
    }
    animate(x, 0, SETTLE);
    animate(y, 0, SETTLE);
    animate(scale, 1, SETTLE);
    animate(fade, 1, { duration: 0.2, ease: EASE });
  };

  const releaseHorizontal = (dx: number, vx: number) => {
    const far = Math.abs(dx) > rect.width * 0.22 || Math.abs(vx) > SWIPE_SPEED;
    if (far && dx < 0 && hasNext) {
      onStep(1);
    } else if (far && dx > 0 && hasPrev) {
      onStep(-1);
    } else {
      animate(x, 0, SETTLE);
    }
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== event.pointerId) {
      return;
    }
    event.stopPropagation();
    drag.current = null;
    // 平移就地停住，不做回弹也不触发关闭/翻页
    if (d.axis === "pan") {
      return;
    }
    const first = d.samples[0];
    const last = d.samples.at(-1) ?? first;
    const dt = Math.max(1, last.t - first.t);
    const velocity = { x: (last.x - first.x) / dt, y: (last.y - first.y) / dt };
    if (d.axis === "y") {
      releaseVertical(event.clientY - d.startY, velocity);
    } else if (d.axis === "x") {
      releaseHorizontal(event.clientX - d.startX, velocity.x);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    } else if (event.key === "ArrowRight" && hasNext) {
      onStep(1);
    } else if (event.key === "ArrowLeft" && hasPrev) {
      onStep(-1);
    } else if (!event.ctrlKey && !event.metaKey && (event.key === "+" || event.key === "=")) {
      // 不带修饰键才接管，避免劫持浏览器缩放
      event.preventDefault();
      view.zoomStep(1);
    } else if (!event.ctrlKey && !event.metaKey && (event.key === "-" || event.key === "_")) {
      event.preventDefault();
      view.zoomStep(-1);
    } else if (!event.ctrlKey && !event.metaKey && event.key === "0") {
      event.preventDefault();
      view.reset();
    } else if (event.key === "r") {
      onRotate(1);
    } else if (event.key === "R") {
      onRotate(-1);
    } else if (event.key === "Tab") {
      // Keep focus inside the viewer.
      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLButtonElement>(
          "button:not(:disabled)"
        ) ?? []
      );
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
  };

  return (
    // biome-ignore lint/a11y/noNoninteractiveElementInteractions: keys for the whole viewer: Escape, arrows and the focus trap
    <div
      aria-label={image.caption ?? image.alt}
      aria-modal="true"
      className="fixed inset-0 z-[100]"
      onKeyDown={handleKeyDown}
      // 查看器内任何区域的按下都不许漏到 React 树下层（smooth-tab 会抢指针）；
      // 同时收回焦点，保证拖拽之后 Escape / 方向键仍然可用
      onPointerDown={(event) => {
        event.stopPropagation();
        dialogRef.current?.focus({ preventScroll: true });
      }}
      ref={dialogRef}
      role="dialog"
      tabIndex={-1}
    >
      <motion.div
        aria-hidden="true"
        className="absolute inset-0 bg-zinc-950"
        onClick={() => onClose()}
        style={{ opacity: backdrop }}
      />

      <motion.div
        className={cn(
          // 不裁切：放大是整张图片直接变大，超出适配框也完整可见；
          // flex 居中代替百分比 translate，减少合成层小数偏移
          "absolute flex touch-none select-none items-center justify-center",
          view.zoomed
            ? "cursor-move active:cursor-move"
            : "cursor-grab active:cursor-grabbing"
        )}
        onLostPointerCapture={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        ref={wheelRef}
        style={{
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
          x,
          y,
          scale,
          // 放大时解除裁切，让整张图超出适配框完整显示；开合飞行仍走 clip 动画
          clipPath: view.zoomed ? "none" : clip,
          opacity: alpha,
          willChange: "transform, clip-path",
        }}
      >
        {/* Vite/React 项目：以普通 img 替代 next/image。
            盒宽高在奇数倍 90° 时与外框交换，rotate 后恰好铺满外框；
            缩放/平移/旋转全部走 transform，与外层开合动画解耦。 */}
        <RasterImage
          alt={image.alt}
          className="pointer-events-none max-w-none"
          displayH={displayH}
          displayW={displayW}
          natH={image.height}
          natW={image.width}
          panX={view.panX}
          panY={view.panY}
          rot={rot}
          src={viewerSrc}
        />
      </motion.div>

      <motion.div
        className="pointer-events-none absolute inset-0"
        style={{ opacity: fade }}
      >
        <div className="pointer-events-auto absolute top-3 right-3 flex items-center gap-3 sm:top-4 sm:right-4">
          <span className="text-sm text-white/60 tabular-nums">
            {index + 1} / {images.length}
          </span>
          <IconButton
            buttonRef={closeRef}
            label="Close"
            onClick={() => onClose()}
          >
            <svg
              aria-hidden="true"
              className="size-4"
              fill="none"
              viewBox="0 0 16 16"
            >
              <path
                d="m4 4 8 8M12 4l-8 8"
                stroke="currentColor"
                strokeLinecap="round"
                strokeWidth="1.6"
              />
            </svg>
          </IconButton>
        </div>
        <IconButton
          className="pointer-events-auto absolute top-1/2 left-4 hidden -translate-y-1/2 sm:flex"
          label="Previous photo"
          onClick={() => hasPrev && onStep(-1)}
          unavailable={!hasPrev}
        >
          <Chevron flip />
        </IconButton>
        <IconButton
          className="pointer-events-auto absolute top-1/2 right-4 hidden -translate-y-1/2 sm:flex"
          label="Next photo"
          onClick={() => hasNext && onStep(1)}
          unavailable={!hasNext}
        >
          <Chevron />
        </IconButton>
        {image.caption ? (
          <p
            className="absolute inset-x-4 text-center text-sm text-white/80"
            style={{ top: rect.top + rect.height + 18 }}
          >
            {image.caption}
          </p>
        ) : null}
        <ImageViewToolbar
          className="pointer-events-auto absolute left-1/2 -translate-x-1/2"
          onRotateCcw={() => onRotate(-1)}
          onRotateCw={() => onRotate(1)}
          style={{ top: rect.top + rect.height + 56 }}
          view={view}
        />
      </motion.div>
    </div>
  );
}

/**
 * A photo grid whose thumbnails grow into a full view. The open photo is the
 * same element at every moment: a transform and a crop take it from its
 * slot to the middle of the screen and back, wherever it was dragged to.
 */
export default function LightboxGrid({
  images = DEFAULT_IMAGES,
  className,
  onStepBeyond,
  openRequest,
  hasMoreBefore = false,
  hasMoreAfter = false,
}: LightboxGridProps) {
  const [active, setActive] = useState<number | null>(null);
  const [rect, setRect] = useState<Rect | null>(null);
  const [settled, setSettled] = useState(false);
  const [closing, setClosing] = useState(false);
  // 旋转角由父级持有：setRot 与 setRect 同 tick 批处理，元素盒/外框不错帧
  const [rot, setRot] = useState(0);
  const thumbs = useRef<(HTMLButtonElement | null)[]>([]);
  const closeTimer = useRef(0);
  const reduceMotion = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const scale = useMotionValue(1);
  const clip = useMotionValue(openClip());
  const alpha = useMotionValue(1);
  const fade = useMotionValue(0);
  // 缩放/旋转/平移：独立于外层开合 MotionValue 的查看变换。
  // oneToOne = 原图自然像素 / 屏幕像素（奇数倍旋转时水平轴对应自然高度）
  // 换页瞬间 active 可能越界（旧下标 + 新列表）：所有 images[active] 读取走这里
  const activeImage = active !== null ? images[active] : undefined;
  const oneToOne =
    activeImage && rect
      ? (rot % 180 !== 0 ? activeImage.height : activeImage.width) / rect.width
      : null;
  const view = useImageView({
    frame: rect ? { width: rect.width, height: rect.height } : null,
    oneToOne,
    reduceMotion,
  });

  const frameFor = useCallback(
    (index: number, open: Rect): Frame | null => {
      const thumb = thumbs.current[index];
      if (!thumb) {
        return null;
      }
      const box = thumb.getBoundingClientRect();
      if (!isVisible(box)) {
        return null;
      }
      const radius =
        Number.parseFloat(getComputedStyle(thumb).borderTopLeftRadius) || 0;
      return thumbFrame(open, box, images[index], radius);
    },
    [images]
  );

  const open = useCallback(
    (index: number) => {
      const target = fitRect(images[index]);
      const from = frameFor(index, target);
      setActive(index);
      setRect(target);
      setClosing(false);
      setSettled(false);
      setRot(0);
      view.resetAll();
      alpha.set(1);
      if (!from || reduceMotion) {
        x.set(0);
        y.set(0);
        scale.set(1);
        clip.set(openClip());
        fade.set(0);
        alpha.set(0);
        animate(alpha, 1, { duration: 0.18 });
        animate(fade, 1, { duration: 0.18 }).then(() => setSettled(true));
        return;
      }
      x.set(from.x);
      y.set(from.y);
      scale.set(from.scale);
      clip.set(from.clip);
      fade.set(0);
      animate(x, 0, OPEN);
      animate(y, 0, OPEN);
      animate(scale, 1, OPEN);
      animate(clip, openClip(), OPEN);
      animate(fade, 1, { duration: 0.3, ease: EASE }).then(() =>
        setSettled(true)
      );
    },
    [alpha, clip, fade, frameFor, images, reduceMotion, scale, view.resetAll, x, y]
  );

  const close = useCallback(
    (velocity?: { x: number; y: number }) => {
      if (active === null || !rect || closing || !images[active]) {
        return;
      }
      setClosing(true);
      const index = active;
      // Instant, so the slot is measured where it will be (pages often scroll smoothly).
      thumbs.current[index]?.scrollIntoView({
        behavior: "instant",
        block: "nearest",
        inline: "nearest",
      });
      // 关闭瞬间回到适配初态（与 setRect 同 tick 批处理，无中间帧）：
      // 归航飞行必须从正常姿态起步，旋转/缩放态会扭曲 thumbFrame 的落点
      view.resetAll();
      setRot(0);
      const base = fitRect(images[index]);
      setRect(base);
      const to = frameFor(index, base);
      const finish = () => {
        setActive(null);
        setRect(null);
        setClosing(false);
        thumbs.current[index]?.focus({ preventScroll: true });
      };
      if (!to || reduceMotion) {
        animate(alpha, 0, { duration: 0.16 });
        animate(fade, 0, { duration: 0.16 }).then(finish);
        return;
      }
      // A flick carries its speed into the flight home.
      const vx = (velocity?.x ?? 0) * 1000;
      const vy = (velocity?.y ?? 0) * 1000;
      animate(x, to.x, { ...CLOSE, velocity: vx });
      animate(y, to.y, { ...CLOSE, velocity: vy });
      animate(scale, to.scale, CLOSE);
      animate(clip, to.clip, CLOSE);
      animate(fade, 0, { duration: 0.28, ease: EASE });
      // The clip spring settles last; reveal the thumbnail when it lands.
      closeTimer.current = window.setTimeout(finish, 420);
    },
    [
      active,
      alpha,
      clip,
      closing,
      fade,
      frameFor,
      rect,
      reduceMotion,
      scale,
      view.resetAll,
      x,
      y,
    ]
  );

  const rotateBy = useCallback(
    (direction: 1 | -1) => {
      const image = active === null ? undefined : images[active];
      if (!image || closing) {
        return;
      }
      const next = ((rot + direction * 90) % 360 + 360) % 360;
      const newRect = fitRectFor(image, next);
      // 旋转重新适配会改变 oneToOne；同比调整 zoom 使屏幕上的实际比例不变
      const oNew = (next % 180 !== 0 ? image.height : image.width) / newRect.width;
      setRot(next);
      setRect(newRect);
      if (oneToOne && oNew) {
        view.rescaleZoom(oNew / oneToOne);
      }
    },
    [active, closing, images, oneToOne, rot, view.rescaleZoom]
  );

  const step = useCallback(
    (direction: 1 | -1) => {
      // Mid-close, the photo is already flying home to this slot.
      if (active === null || closing) {
        return;
      }
      const next = active + direction;
      if (next < 0 || next >= images.length) {
        // 越界 = 分页边界：交给父级换页，换完经 openRequest 打开对应位置
        onStepBeyond?.(direction);
        return;
      }
      setActive(next);
      view.resetAll();
      setRot(0);
      setRect(fitRect(images[next]));
      y.set(0);
      scale.set(1);
      clip.set(openClip());
      fade.set(1);
      if (reduceMotion) {
        x.set(0);
        alpha.set(1);
        return;
      }
      // The next photo slides in from the side it was swiped from.
      x.set(direction * 72);
      alpha.set(0);
      animate(x, 0, { duration: 0.32, ease: EASE });
      animate(alpha, 1, { duration: 0.22, ease: EASE });
    },
    [active, alpha, clip, closing, fade, images, onStepBeyond, reduceMotion, scale, view.resetAll, x, y]
  );

  useEffect(() => () => window.clearTimeout(closeTimer.current), []);

  // 父级换页后请求打开指定下标；useLayoutEffect 避免新列表先渲染一帧旧下标的图
  const openToken = useRef(0);
  useLayoutEffect(() => {
    if (!openRequest || openRequest.token === openToken.current) {
      return;
    }
    openToken.current = openRequest.token;
    if (openRequest.index >= 0 && openRequest.index < images.length) {
      open(openRequest.index);
    }
  }, [openRequest, images.length, open]);

  // 换页瞬间 active 可能越界：视作未打开，避免 images[active] 取空崩溃
  const idx = active !== null && active < images.length ? active : null;

  // 预解码相邻图片：切换时 <img> 换 src 能直接命中已解码位图，
  // 避免大图解码空窗造成的黑帧闪烁
  const decoded = useRef(new Set<string>());
  useEffect(() => {
    if (active === null) {
      return;
    }
    let alive = true;
    for (const d of [1, -1]) {
      const i = active + d;
      if (i < 0 || i >= images.length) {
        continue;
      }
      // 预解码相邻图：优先缩略图，避免后台解码十几 MB 的原图
      const src = images[i].thumb ?? images[i].src;
      if (decoded.current.has(src)) {
        continue;
      }
      const im = new Image();
      im.src = src;
      im.decode?.()
        .then(() => {
          if (alive) {
            decoded.current.add(src);
          }
        })
        .catch(() => {});
    }
    return () => {
      alive = false;
    };
  }, [active, images]);

  // Lock the page behind the viewer and keep the open photo fitted.
  useEffect(() => {
    if (active === null || !images[active]) {
      return;
    }
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = "hidden";
    const onResize = () => setRect(fitRectFor(images[active], rot));
    window.addEventListener("resize", onResize);
    return () => {
      root.style.overflow = previous;
      window.removeEventListener("resize", onResize);
    };
  }, [active, images, rot]);

  return (
    <div className={cn("w-full max-w-xl", className)}>
      <ul className="grid grid-cols-3 gap-2">
        {images.map((image, index) => (
          <li
            className={cn(index === 0 && "col-span-2 row-span-2")}
            key={image.src}
          >
            <button
              aria-label={`Open ${image.alt}`}
              className="relative block aspect-square w-full overflow-hidden rounded-xl bg-zinc-100 outline-offset-2 focus-visible:outline-2 focus-visible:outline-zinc-900 dark:bg-zinc-800 dark:focus-visible:outline-white"
              onClick={() => open(index)}
              ref={(node) => {
                thumbs.current[index] = node;
              }}
              // The open photo has left its slot; the slot stays empty until it returns.
              style={{ opacity: idx === index ? 0 : 1 }}
              type="button"
            >
              <img
                alt=""
                className="h-full w-full object-cover transition-[filter] duration-200 hover:brightness-95"
                decoding="async"
                draggable={false}
                loading="lazy"
                src={image.thumb ?? image.src}
              />
            </button>
          </li>
        ))}
      </ul>
      {idx !== null && rect
        ? createPortal(
            <Viewer
              alpha={alpha}
              clip={clip}
              fade={fade}
              hasMoreAfter={hasMoreAfter}
              hasMoreBefore={hasMoreBefore}
              images={images}
              index={idx}
              onClose={close}
              onRotate={rotateBy}
              onStep={step}
              rect={rect}
              rot={rot}
              scale={scale}
              settled={settled && !closing}
              view={view}
              x={x}
              y={y}
            />,
            document.body
          )
        : null}
    </div>
  );
}
