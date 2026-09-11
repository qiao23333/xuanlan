# -*- coding: utf-8 -*-
"""像素判读新参考图：尺寸 / 版式分栏 / 主色板 / 图标单体 bounding box。
模型不支持读图，只能靠像素统计量还原设计意图。
"""
import os
import sys
from collections import Counter

from PIL import Image

BASE = r"G:\work\牛马\wb工作空间\xuanlan\资料\新参考"


def info(path):
    im = Image.open(path).convert("RGB")
    w, h = im.size
    return im, w, h


def palette(im, n=8, step=4):
    small = im.resize((im.width // step, im.height // step))
    c = Counter(small.getdata())
    total = sum(c.values())
    return [(rgb, round(v / total * 100, 1)) for rgb, v in c.most_common(n)]


def col_profile(im, thresh=12):
    """列方向方差：找纵向分栏间隙（方差低的列 = 纯色分隔带）"""
    w, h = im.size
    px = im.load()
    prof = []
    for x in range(0, w, 2):
        vals = [sum(px[x, y]) / 3 for y in range(0, h, 6)]
        m = sum(vals) / len(vals)
        var = sum((v - m) ** 2 for v in vals) / len(vals)
        prof.append((x, var))
    return prof


def find_bands(prof, w, min_run=8):
    """方差低于阈值的连续列 = 分隔带"""
    bands = []
    run = None
    for x, var in prof:
        if var < 30:
            if run is None:
                run = [x, x]
            else:
                run[1] = x
        else:
            if run and run[1] - run[0] >= min_run:
                bands.append(tuple(run))
            run = None
    if run and run[1] - run[0] >= min_run:
        bands.append(tuple(run))
    return bands


def main():
    files = []
    for root, _, fs in os.walk(BASE):
        for f in sorted(fs):
            if f.lower().endswith((".png", ".jpg", ".jpeg")):
                files.append(os.path.join(root, f))

    for p in files:
        im, w, h = info(p)
        rel = os.path.relpath(p, BASE)
        print(f"\n=== {rel} ===")
        print(f"  尺寸 {w}x{h}  比例 {w/h:.2f}  方向 {'横屏/桌面' if w>h else '竖屏/移动'}")
        pal = palette(im)
        print("  主色: " + "  ".join(f"rgb{c[0]} {c[1]}%" for c in pal[:5]))
        if w > h:
            prof = col_profile(im)
            bands = find_bands(prof, w)
            merged = []
            for b in bands:
                if merged and b[0] - merged[-1][1] <= 6:
                    merged[-1] = (merged[-1][0], b[1])
                else:
                    merged.append(list(b) if False else (b[0], b[1]))
            print(f"  疑似纵向留白带(x范围): {merged[:8]}")


if __name__ == "__main__":
    main()
