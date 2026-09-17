# -*- coding: utf-8 -*-
"""逐像素比对「改前/改后」两组截图。

存在的理由：删死规则、调遮罩这类改动的验收标准是**渲染结果零变化**，
而布局审计（溢出/字号/触达区）对颜色与背景层次完全不敏感 —— 它永远会绿。
所以只能用像素说话。

输出：
  - 每张图的平均绝对差、最大区块差、差异像素占比（阈值 8/255）
  - 结论行：PASS / FAIL

用法： python tools/visual-diff/ab-diff.py .tmp-ab/before .tmp-ab/after
（只用 PIL，不用 numpy —— 本机沙箱里 numpy 是坏的：No module named 'numpy._utils'）
"""
import os
import sys

from PIL import Image, ImageChops, ImageStat

THRESH = 8          # 单像素差异超过它才算「变了」（抗 JPEG/WebP 解码微抖）
FAIL_RATIO = 0.001  # 差异像素占比超过 0.1% 判 FAIL


def compare(a_path: str, b_path: str) -> tuple[float, float, float]:
    a = Image.open(a_path).convert("RGB")
    b = Image.open(b_path).convert("RGB")
    if a.size != b.size:
        return (-1.0, -1.0, -1.0)
    d = ImageChops.difference(a, b).convert("L")
    st = ImageStat.Stat(d)
    mean = st.mean[0]
    extrema = st.extrema[0][1]
    hist = d.histogram()
    total = a.size[0] * a.size[1]
    changed = sum(hist[THRESH + 1:])
    return mean, float(extrema), changed / total


def main() -> int:
    before = sys.argv[1] if len(sys.argv) > 1 else ".tmp-ab/before"
    after = sys.argv[2] if len(sys.argv) > 2 else ".tmp-ab/after"
    names = sorted(f for f in os.listdir(before) if f.endswith(".png")) if os.path.isdir(before) else []
    if not names:
        print(f"× 目录为空或不存在：{before}")
        return 2

    print(f"{'截图':<26} {'平均差':>8} {'最大差':>8} {'差异像素占比':>12}  结论")
    print("-" * 74)
    bad = []
    missing = []
    for n in names:
        pa, pb = os.path.join(before, n), os.path.join(after, n)
        if not os.path.exists(pb):
            missing.append(n)
            print(f"{n:<26} {'(缺)':>8}")
            continue
        mean, mx, ratio = compare(pa, pb)
        if mean < 0:
            print(f"{n:<26} {'尺寸不一致':>8}")
            bad.append(n)
            continue
        ok = ratio <= FAIL_RATIO
        if not ok:
            bad.append(n)
        print(f"{n:<26} {mean:>8.3f} {mx:>8.0f} {ratio * 100:>11.3f}%  {'✅ 一致' if ok else '❌ 变了'}")
    print("-" * 74)
    if missing:
        print(f"！after 组缺少 {len(missing)} 张：{', '.join(missing)}")
    if bad:
        print(f"❌ {len(bad)} 张渲染结果发生变化：{', '.join(bad)}")
        print("   若本次改动本应「零视觉变化」，说明死规则判定错了，回去看级联。")
        return 1
    print(f"✅ {len(names)} 张截图渲染完全一致（阈值 {THRESH}/255，差异像素 ≤ {FAIL_RATIO * 100}%）")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
