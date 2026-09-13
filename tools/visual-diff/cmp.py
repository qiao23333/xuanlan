# -*- coding: utf-8 -*-
"""把「我的截图」和「用户参考图」做量化比对。
模型看不了图，所以这里不比像素审美，只比**可执行的几何量**：
  - 内容包围盒（上下左右留白）
  - 内容水平重心（判断是否居中）
  - 行密度剖面（找出内容带：标题区/主视觉区/卡片区/页脚区）
  - 主色（判断主题明暗是否对上）
输出纯文本，供直接据此改 CSS。
"""
import os
import numpy as np
from PIL import Image

REF = '资料/新参考'
MINE = 'shots'
W, H = 1672, 941


def load(p):
    im = Image.open(p).convert('RGB')
    if im.size != (W, H):
        im = im.resize((W, H), Image.LANCZOS)
    return np.asarray(im).astype(np.float32)


def bg_profile(a):
    """背景 = 每列出现频次最高的颜色（背景通常是大面积同色/渐变）。"""
    return np.median(a, axis=0)  # 每行的中位色，近似该行背景


def content_mask(a, tol=26):
    """与「全图主色」差异超过 tol 的像素算内容。"""
    med = np.median(a.reshape(-1, 3), axis=0)
    d = np.abs(a - med).sum(axis=2)
    return d > tol, med


def report(name, a):
    m, med = content_mask(a)
    rows = m.mean(axis=1)   # 每行内容占比
    cols = m.mean(axis=0)   # 每列内容占比
    ys = np.where(rows > 0.01)[0]
    xs = np.where(cols > 0.01)[0]
    if len(ys) == 0 or len(xs) == 0:
        return f'{name}: 无内容'
    top, bot = int(ys[0]), int(ys[-1])
    left, right = int(xs[0]), int(xs[-1])
    # 水平重心（按内容密度加权）
    cx = float((cols * np.arange(W)).sum() / max(cols.sum(), 1e-6))
    # 行密度剖面（分 20 段）
    seg = np.array_split(rows, 20)
    prof = ' '.join(f'{s.mean()*100:4.1f}' for s in seg)
    ink = 1.0 - (a.mean() / 255.0)   # 整体明暗：越大越暗
    return (f'{name}\n'
            f'  内容盒: top={top} bottom={bot} left={left} right={right}\n'
            f'  留白:   上{top} 下{H-bot} 左{left} 右{W-right}\n'
            f'  水平重心 cx={cx:.0f}  (画面中线 {W//2})  偏移 {cx-W//2:+.0f}\n'
            f'  整体暗度 ink={ink:.3f}\n'
            f'  行密度(20段, %): {prof}')


def diff(a, b):
    d = np.abs(a - b).mean(axis=2)
    overall = d.mean()
    gh, gw = 8, 6
    bh, bw = H // gh, W // gw
    cells = []
    for i in range(gh):
        for j in range(gw):
            blk = d[i * bh:(i + 1) * bh, j * bw:(j + 1) * bw]
            cells.append((blk.mean(), i, j))
    cells.sort(reverse=True)
    top = ' '.join(f'r{i}c{j}:{v:.0f}' for v, i, j in cells[:8])
    return overall, top


pairs = [
    ('首页·深色', f'{MINE}/mine-home-dark.png', f'{REF}/首页（深色模式）.png'),
    ('首页·浅色', f'{MINE}/mine-home-light.png', f'{REF}/首页（浅色模式）.png'),
    ('输入页', f'{MINE}/mine-form-light.png', f'{REF}/信息输入页.png'),
    ('结果页', f'{MINE}/mine-result-light.png', f'{REF}/结果页面参考.png'),
]

for label, mp, rp in pairs:
    if not os.path.exists(mp) or not os.path.exists(rp):
        print(f'### {label}: 缺文件 {mp} / {rp}')
        continue
    a, b = load(mp), load(rp)
    print('=' * 70)
    print(f'### {label}')
    print('--- 参考图 ---')
    print(report('ref', b))
    print('--- 我的 ---')
    print(report('mine', a))
    ov, top = diff(a, b)
    print(f'--- 差异: 全图平均 {ov:.1f}/255; 差异最大的格子(行r列c): {top}')
print('=' * 70)
