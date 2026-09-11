# -*- coding: utf-8 -*-
"""把 8 张体系图标打成 ASCII 轮廓，便于在无图像输入的情况下辨认图形。"""
import os
from PIL import Image

BASE = r"G:\work\牛马\wb工作空间\xuanlan\资料\新参考\图标"
CHARS = " .:*#@"


def ascii_art(im, cols=54, rows=27):
    g = im.convert("L").resize((cols, rows))
    px = g.load()
    lines = []
    for y in range(rows):
        line = []
        for x in range(cols):
            v = px[x, y]
            # 阈值：黑底(<40)算空
            if v < 40:
                line.append(" ")
            else:
                idx = min(len(CHARS) - 1, max(1, int(v / 256 * (len(CHARS) - 1)) + 1))
                line.append(CHARS[idx])
        lines.append("".join(line))
    return lines


def bbox(im):
    """非黑像素的包围盒"""
    g = im.convert("L")
    w, h = g.size
    px = g.load()
    minx, miny, maxx, maxy = w, h, 0, 0
    hit = 0
    for y in range(0, h, 3):
        for x in range(0, w, 3):
            if px[x, y] >= 40:
                hit += 1
                if x < minx:
                    minx = x
                if x > maxx:
                    maxx = x
                if y < miny:
                    miny = y
                if y > maxy:
                    maxy = y
    return (minx, miny, maxx, maxy), hit


def main():
    files = sorted(f for f in os.listdir(BASE) if f.lower().endswith(".png") and "总览" not in f)
    for f in files:
        im = Image.open(os.path.join(BASE, f))
        box, hit = bbox(im)
        print(f"\n########## {f} ##########")
        print(f"  有效图形包围盒 {box}  占比 {hit}")
        crop = im.crop(box)
        for line in ascii_art(crop):
            print("  |" + line + "|")


if __name__ == "__main__":
    main()
