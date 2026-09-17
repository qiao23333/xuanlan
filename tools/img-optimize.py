#!/usr/bin/env python3
"""玄览 · 位图瘦身（幂等，可重复执行）

问题
----
- `src/assets/taiji-*.png` 是 1254×1254 的透明底 PNG（约 2.0MB / 1.8MB 一张），
  但界面上最大只显示到 200px（结果页）——过采样 6 倍。
- `public/icons/system/*/*.png` 是 320×320 的 PNG（平均 80KB），
  最大只显示到 62px（SystemOverview）——过采样 5 倍。
- 合计 5.2MB 图片，与「纯前端 / PWA 可离线」的卖点相冲：首屏 + 滚动都要背它。

做法
----
等比缩放到刚好覆盖 3× DPR 的尺寸，转 WebP（现代浏览器全支持，透明通道保留）：
- taiji : 1254 → 640（200px 显示 × 3 = 600，取 640 留余量）
- icons : 320  → 192（62px 显示 × 3 = 186，取 192 留余量）

用法
----
    python tools/img-optimize.py            # 生成 WebP（不删原图）
    python tools/img-optimize.py --clean    # 生成 WebP 并删除已替换的 PNG

改完记得：代码里对 png 的引用要改成 .webp（TaoWheel.tsx / systemIdentity.tsx）。
"""

from __future__ import annotations

import glob
import os
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# (源 glob, 目标边长, WebP 质量)
TAIJI = 640
ICON = 192
JOBS: list[tuple[str, int, int]] = [
    ("src/assets/taiji-dark.png", TAIJI, 88),
    ("src/assets/taiji-light.png", TAIJI, 88),
]
ICON_JOBS = [
    (p, ICON, 92) for p in sorted(glob.glob(os.path.join(ROOT, "public/icons/system/*/*.png")))
]


def convert(src: str, size: int, quality: int) -> tuple[int, int, str]:
    """把 src 等比缩放到 size×size 并存成同名 .webp，返回 (旧字节, 新字节, 目标路径)。"""
    dst = os.path.splitext(src)[0] + ".webp"
    with Image.open(src) as raw:
        im = raw.convert("RGBA")
        if im.size != (size, size):
            im = im.resize((size, size), Image.LANCZOS)
        im.save(dst, "WEBP", quality=quality, method=6)
    return os.path.getsize(src), os.path.getsize(dst), dst


def run(name: str, jobs: list[tuple[str, int, int]], clean: bool) -> tuple[int, int]:
    old_total = new_total = 0
    print(f"\n=== {name} ===")
    for rel, size, q in jobs:
        src = rel if os.path.isabs(rel) else os.path.join(ROOT, rel)
        if not os.path.exists(src):
            print(f"  ! 跳过（不存在）：{rel}")
            continue
        o, n, dst = convert(src, size, q)
        old_total += o
        new_total += n
        show = os.path.relpath(dst, ROOT)
        print(f"  {os.path.relpath(src, ROOT):<48} {o / 1024:7.1f}K -> {n / 1024:6.1f}K   {show}")
        if clean:
            os.remove(src)
    return old_total, new_total


def main() -> int:
    clean = "--clean" in sys.argv[1:]
    o1, n1 = run("太极（结果/加载页）", JOBS, clean)
    o2, n2 = run("系统图标（8 体系 × 深浅）", ICON_JOBS, clean)
    o, n = o1 + o2, n1 + n2
    saved = (1 - n / o) * 100 if o else 0
    print(f"\n合计：{o / 1024 / 1024:.2f}MB -> {n / 1024:.0f}KB（省 {saved:.1f}%）")
    if not clean:
        print("（未删除原 PNG；确认无误后加 --clean 重跑，或手动删）")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
