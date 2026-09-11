# -*- coding: utf-8 -*-
"""把 8 张体系图标（黑底 + 金/红/米白线条）处理为透明 PNG。
- dark/  : 原色，深色模式直接用
- light/ : 同色相但压暗到 L≈0.34，浅色底上才看得见
输出到 public/icons/system/
"""
import os
from PIL import Image

SRC = r"G:\work\牛马\wb工作空间\xuanlan\资料\新参考\图标"
OUT = r"G:\work\牛马\wb工作空间\xuanlan\public\icons\system"
SIZE = 256
PAD = 0.04  # 裁完留 4% 白边


def bbox_nonblack(im, thr=42):
    g = im.convert("L")
    w, h = g.size
    px = g.load()
    minx, miny, maxx, maxy = w, h, 0, 0
    for y in range(0, h, 2):
        for x in range(0, w, 2):
            if px[x, y] >= thr:
                if x < minx: minx = x
                if x > maxx: maxx = x
                if y < miny: miny = y
                if y > maxy: maxy = y
    if maxx < minx:
        return (0, 0, w, h)
    return (minx, miny, maxx + 1, maxy + 1)


def strip_black(im, thr=34, soft=46):
    """黑底 -> 透明；soft 是抗锯齿过渡带宽度"""
    im = im.convert("RGBA")
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            lum = 0.299 * r + 0.587 * g + 0.114 * b
            if lum <= thr:
                px[x, y] = (r, g, b, 0)
            elif lum < thr + soft:
                alpha = int(255 * (lum - thr) / soft)
                px[x, y] = (r, g, b, alpha)
    return im


def darken_for_light(im, target_l=0.34):
    """保持色相与饱和度，把亮度压到浅色底可见的水平"""
    im = im.convert("RGBA")
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            hh, ll, ss = rgb_to_hls(r, g, b)
            r2, g2, b2 = hls_to_rgb(hh, target_l, min(1.0, ss * 1.15))
            px[x, y] = (int(r2), int(g2), int(b2), a)
    return im


def rgb_to_hls(r, g, b):
    return colorsys_rgb_to_hls(r / 255, g / 255, b / 255)


def hls_to_rgb(h, l, s):
    return tuple(int(round(v * 255)) for v in colorsys_hls_to_rgb(h, l, s))


import colorsys
def colorsys_rgb_to_hls(r, g, b):
    return colorsys.rgb_to_hls(r, g, b)


def colorsys_hls_to_rgb(h, l, s):
    return colorsys.hls_to_rgb(h, l, s)


def crop_square(im, box):
    x0, y0, x1, y1 = box
    w = x1 - x0
    h = y1 - y0
    side = max(w, h)
    pad = int(side * PAD)
    side += pad * 2
    cxx = (x0 + x1) // 2
    cyy = (y0 + y1) // 2
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(im, (side // 2 - w // 2, side // 2 - h // 2))
    return canvas.resize((SIZE, SIZE), Image.LANCZOS)


def main():
    os.makedirs(os.path.join(OUT, "dark"), exist_ok=True)
    os.makedirs(os.path.join(OUT, "light"), exist_ok=True)
    files = sorted(f for f in os.listdir(SRC) if f.lower().endswith(".png") and "总览" not in f)
    for i, f in enumerate(files, 1):
        im = Image.open(os.path.join(SRC, f)).convert("RGBA")
        box = bbox_nonblack(im)
        cropped = crop_square(im, box)
        dark = strip_black(cropped)
        light = darken_for_light(dark)
        dark.save(os.path.join(OUT, "dark", f"sys-{i:02d}.png"))
        light.save(os.path.join(OUT, "light", f"sys-{i:02d}.png"))
        print(f"sys-{i:02d}.png  <- {f}  bbox={box}")


if __name__ == "__main__":
    main()
