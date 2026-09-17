#!/usr/bin/env python3
"""玄览 · 位图瘦身（可重复执行；注意 --clean 是单向操作）

问题
----
- `src/assets/taiji-*.png` 是 1254×1254 的透明底 PNG（约 2.0MB / 1.8MB 一张），
  但界面上最大只显示到 200px（结果页）——过采样 6 倍。
- `public/icons/system/*/*.png` 是 320×320 的 PNG（平均 80KB），
  最大只显示到 62px（SystemOverview）——过采样 5 倍。
- 合计 5.2MB 图片，与「纯前端 / PWA 可离线」的卖点相冲：首屏 + 滚动都要背它。
- `src/assets/bg-scene-{dark,light}.jpg` 是 1672×941 的山水背景（255KB / 219KB），
  **每次首屏都会下其中一张**（按主题二选一）——是首屏最大的单个资源。

做法
----
等比缩放到刚好覆盖 3× DPR 的尺寸，转 WebP（现代浏览器全支持，透明通道保留）：
- taiji : 1254 → 640（200px 显示 × 3 = 600，取 640 留余量）
- icons : 320  → 192（62px 显示 × 3 = 186，取 192 留余量）
- 背景图 : 尺寸不动，只换格式（q75）。这是照片类，缩小会破坏「铺满视口」的观感；
  实测相对原图 PSNR 40.5dB、相对上一版产物平均绝对差 2.1/255（0.8%），肉眼不可辨。
  注意：它**不缩尺寸**，所以走 BG_JOBS 而不是 JOBS（后者会强转 RGBA 正方裁剪）。

用法
----
    python tools/img-optimize.py            # 生成 WebP（不删原图）
    python tools/img-optimize.py --clean    # 生成 WebP 并删除已替换的原图

改完记得：代码里对原格式的引用要改成 .webp
（TaoWheel.tsx / systemIdentity.tsx / App.tsx 的背景 import）。

⚠️ `--clean` 是**单向**的：原图删掉后本脚本再跑只会打印「跳过（不存在）」，
无法凭 .webp 反向还原（有损编码）。所以要重跑/调质量就**先别 clean**。

原图**不在 HEAD 里**，`git checkout -- src/assets/ public/icons/` 是取不回来的
（这句错话在本文档里挂了很久，踩过）。要取回得从"删掉它的那个提交的父提交"拿：

    f=src/assets/bg-scene-dark.jpg
    c=$(git log --diff-filter=D --format=%H -- "$f" | tail -1)   # 删掉它的那个提交
    git show "$c^:$f" > "$f"

实测两批：`src/assets/taiji-*.png` 与 `public/icons/**` 在 **36745d7** 删的，
`src/assets/bg-scene-*.jpg` 在 **0352c64** 删的。取回后跑本脚本即可重转；
转完记得删掉（或 `--clean`），否则 `node tools/img-weight.mjs --check`
会因「src/assets 里又混进了位图原图」报红 —— 那是**故意**的：仓库里不该留原图。
"""

from __future__ import annotations

import glob
import os
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# (源 glob, 目标边长, WebP 质量)  —— 这类是「方形 + 透明 + 过采样」，要缩放
TAIJI = 640
ICON = 192
JOBS: list[tuple[str, int, int]] = [
    ("src/assets/taiji-dark.png", TAIJI, 88),
    ("src/assets/taiji-light.png", TAIJI, 88),
]
ICON_JOBS = [
    (p, ICON, 92) for p in sorted(glob.glob(os.path.join(ROOT, "public/icons/system/*/*.png")))
]
# (源路径, WebP 质量) —— 照片类背景：**保持原尺寸**、不转 alpha，只换格式
#
# 质量为什么从 82 调到 75（2026-09-17 重扫）：
#   判据不是"文件多小"，而是"用户看到的那张图变了多少" —— 同时看 ①相对原图的 PSNR
#   ②相对上一版产物的平均绝对像素差。深色图实测：
#     q82 148.2K ／ q80 137.1K(均差 1.5) ／ q75 110.0K(2.1) ／ q70 102.6K(2.3) ／ q65 95.5K(2.4)
#   q75 是拐点：一口气省 26%，再往下每 5 个质量点只多省 5%。均差 2.1/255 ≈ 0.8%，肉眼不可辨。
#   也测了"降分辨率"这条看着更划算的路（1500px q78 省 29.7%），但它的失真(2.38)
#   **大于**同等省幅的"只降质量"(q70 = 2.26)：缩放把整幅细节都磨掉，降质量只挑不显眼处省。
#   所以**不缩尺寸**。（AVIF 也试过：同保真度下体积没有优势，不值当付兼容成本。）
BG_JOBS: list[tuple[str, int]] = [
    ("src/assets/bg-scene-dark.jpg", 75),
    ("src/assets/bg-scene-light.jpg", 75),
]


def convert(src: str, size: int | None, quality: int, alpha: bool = True) -> tuple[int, int, str]:
    """转 WebP，返回 (旧字节, 新字节, 目标路径)。

    size=None 表示保持原尺寸（照片类背景用）；alpha=False 时用 RGB，
    避免给不透明照片白背一条 alpha 通道。
    """
    dst = os.path.splitext(src)[0] + ".webp"
    with Image.open(src) as raw:
        im = raw.convert("RGBA" if alpha else "RGB")
        if size and im.size != (size, size):
            im = im.resize((size, size), Image.LANCZOS)
        im.save(dst, "WEBP", quality=quality, method=6)
    return os.path.getsize(src), os.path.getsize(dst), dst


def run(name: str, jobs: list[tuple[str, int, int]], clean: bool) -> tuple[int, int, list[str]]:
    old_total = new_total = 0
    missing: list[str] = []
    print(f"\n=== {name} ===")
    for rel, size, q in jobs:
        src = rel if os.path.isabs(rel) else os.path.join(ROOT, rel)
        if not os.path.exists(src):
            print(f"  ! 跳过（不存在）：{rel}")
            missing.append(os.path.relpath(src, ROOT))
            continue
        o, n, dst = convert(src, size, q)
        old_total += o
        new_total += n
        show = os.path.relpath(dst, ROOT)
        print(f"  {os.path.relpath(src, ROOT):<48} {o / 1024:7.1f}K -> {n / 1024:6.1f}K   {show}")
        if clean:
            os.remove(src)
    return old_total, new_total, missing


def run_bg(clean: bool) -> tuple[int, int, list[str]]:
    """背景山水：不缩放、不带 alpha。"""
    old_total = new_total = 0
    missing: list[str] = []
    print("\n=== 背景山水（首屏最大单资源，按主题二选一下载） ===")
    for rel, q in BG_JOBS:
        src = os.path.join(ROOT, rel)
        if not os.path.exists(src):
            print(f"  ! 跳过（不存在）：{rel}")
            missing.append(rel)
            continue
        o, n, dst = convert(src, None, q, alpha=False)
        old_total += o
        new_total += n
        with Image.open(dst) as im:
            dim = f"{im.size[0]}×{im.size[1]}"
        print(f"  {rel:<48} {o / 1024:7.1f}K -> {n / 1024:6.1f}K   {dim}  {os.path.relpath(dst, ROOT)}")
        if clean:
            os.remove(src)
    return old_total, new_total, missing


def main() -> int:
    clean = "--clean" in sys.argv[1:]
    o1, n1, m1 = run("太极（结果/加载页）", JOBS, clean)
    o2, n2, m2 = run("系统图标（8 体系 × 深浅）", ICON_JOBS, clean)
    o3, n3, m3 = run_bg(clean)
    o, n = o1 + o2 + o3, n1 + n2 + n3
    saved = (1 - n / o) * 100 if o else 0
    done = len(JOBS) + len(ICON_JOBS) + len(BG_JOBS) - len(m1 + m2 + m3)
    print(f"\n合计（本次实际处理 {done} 项）：{o / 1024 / 1024:.2f}MB -> {n / 1024:.0f}KB（省 {saved:.1f}%）")
    # 这个数字只覆盖"本次真的转了"的那几项。原图一旦被 --clean 删掉就再也转不出来，
    # 而脚本又按「跳过（不存在）」继续跑 —— 于是合计会**静默缩水成只剩背景那两项**，
    # 看着像全站只省了 41%，其实是前面几轮已经省过、源文件不在了。必须显式说清，
    # 否则这个数字会骗人（本项目的老毛病：工具自己的汇总要能对得上产物的口径）。
    if m1 + m2 + m3:
        skipped = len(m1 + m2 + m3)
        print(f"！有 {skipped} 项源文件已不存在（多为此前已 --clean 处理过）："
              f"{', '.join(m1 + m2 + m3)}")
        print("  合计不含这些项，故**小于**历史累计节省。原图不在 HEAD 里，"
              "`git checkout --` 取不回来，要从删除它的那个提交的父提交取：")
        print('    f=src/assets/taiji-dark.png; c=$(git log --diff-filter=D --format=%H -- "$f" | tail -1); git show "$c^:$f" > "$f"')
        print("  （taiji 与 icons 在 36745d7 删的，bg-scene 在 0352c64 删的）")
    if not clean:
        print("（未删除原图；确认无误后加 --clean 重跑，或手动删）")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
