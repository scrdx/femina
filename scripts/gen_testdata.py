# -*- coding: utf-8 -*-
"""生成海报墙演示用的测试媒体（纯色渐变 + 首字），每个人物一个目录。
注意：仅在 testdata 下创建演示文件，不涉及任何用户真实媒体。"""
import os
from PIL import Image, ImageDraw, ImageFont

BASE = os.path.join(os.path.dirname(__file__), "..", "testdata", "people")
BASE = os.path.abspath(BASE)

PEOPLE = [
    ("alice",  "A", [(214, 155, 122), (120, 62, 48)]),
    ("bella",  "B", [(176, 196, 168), (58, 82, 58)]),
    ("cecile", "C", [(206, 176, 196), (96, 58, 88)]),
    ("diana",  "D", [(168, 190, 206), (48, 72, 96)]),
    ("elena",  "E", [(222, 198, 150), (120, 92, 44)]),
    ("faye",   "F", [(200, 168, 168), (96, 52, 52)]),
]

W, H = 600, 900


def gradient(top, bottom, letter, path):
    img = Image.new("RGB", (W, H))
    d = ImageDraw.Draw(img)
    for y in range(H):
        t = y / (H - 1)
        r = int(top[0] + (bottom[0] - top[0]) * t)
        g = int(top[1] + (bottom[1] - top[1]) * t)
        b = int(top[2] + (bottom[2] - top[2]) * t)
        d.line([(0, y), (W, y)], fill=(r, g, b))
    # 大首字
    font = None
    for fp in ["arial.ttf", "DejaVuSerif.ttf", "DejaVuSans.ttf"]:
        try:
            font = ImageFont.truetype(fp, 360)
            break
        except Exception:
            continue
    if font is None:
        font = ImageFont.load_default()
    bbox = d.textbbox((0, 0), letter, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    d.text(((W - tw) / 2 - bbox[0], (H - th) / 2 - bbox[1] - 20), letter,
           font=font, fill=(255, 250, 242))
    img.save(path, quality=88)


def solid(top, bottom, path, size=(600, 600)):
    img = Image.new("RGB", size)
    d = ImageDraw.Draw(img)
    for y in range(size[1]):
        t = y / (size[1] - 1)
        r = int(top[0] + (bottom[0] - top[0]) * t)
        g = int(top[1] + (bottom[1] - top[1]) * t)
        b = int(top[2] + (bottom[2] - top[2]) * t)
        d.line([(0, y), (size[0], y)], fill=(r, g, b))
    img.save(path, quality=88)


for name, letter, (c1, c2) in PEOPLE:
    pdir = os.path.join(BASE, name)
    os.makedirs(pdir, exist_ok=True)
    gradient(c1, c2, letter, os.path.join(pdir, "cover.jpg"))
    # 几张"照片"
    solid(c1, c2, os.path.join(pdir, "photo_01.jpg"))
    solid(c2, c1, os.path.join(pdir, "photo_02.jpg"))
    lighter = tuple(min(255, x + 30) for x in c1)
    solid(lighter, c2, os.path.join(pdir, "photo_03.png"))
    # 子目录一张
    subdir = os.path.join(pdir, "album")
    os.makedirs(subdir, exist_ok=True)
    solid(c2, lighter, os.path.join(subdir, "photo_04.jpg"))
    # 一个演示"视频"（占位内容，用于测试流/Range；浏览器不保证能解码）
    with open(os.path.join(pdir, "clip.mp4"), "wb") as f:
        f.write(b"\x00" * 4096)
    print("generated:", pdir)

print("DONE ->", BASE)
