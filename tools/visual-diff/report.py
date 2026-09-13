# -*- coding: utf-8 -*-
"""生成「我的实现 vs 用户参考图」的差异报告（含热力图 + 分区差异数值）。
模型看不了图，所以把差异量化成用户一眼能定位的形式。"""
import os
import numpy as np
from PIL import Image, ImageDraw

REF = '资料/新参考'
MINE = 'shots'
OUT = 'shots/report'
W, H = 1672, 941
os.makedirs(OUT, exist_ok=True)


def load(p):
    im = Image.open(p).convert('RGB')
    if im.size != (W, H):
        im = im.resize((W, H), Image.LANCZOS)
    return np.asarray(im).astype(np.float32)


def heat(a, b):
    raw = np.abs(a - b).mean(axis=2)
    d = np.clip(raw / 90.0, 0, 1)        # 90 以上算完全不一样
    g = (d * 255).astype(np.uint8)
    im = Image.fromarray(g).convert('P')
    im.putpalette([int(v) for c in range(256)
                   for v in (min(255, c * 2), max(0, 200 - c * 2), max(0, 120 - c))][:768])
    return im, raw


def grid(d, gh=8, gw=6):
    bh, bw = H // gh, W // gw
    return [[float(d[i * bh:(i + 1) * bh, j * bw:(j + 1) * bw].mean()) for j in range(gw)] for i in range(gh)]


PAIRS = [
    ('首页·深色', f'{MINE}/mine-home-dark.png', f'{REF}/首页（深色模式）.png'),
    ('首页·浅色', f'{MINE}/mine-home-light.png', f'{REF}/首页（浅色模式）.png'),
    ('输入页·浅色', f'{MINE}/mine-form-light.png', f'{REF}/信息输入页.png'),
    ('结果页·浅色', f'{MINE}/mine-result-light.png', f'{REF}/结果页面参考.png'),
]

rows = []
for label, mp, rp in PAIRS:
    if not (os.path.exists(mp) and os.path.exists(rp)):
        continue
    a, b = load(mp), load(rp)
    him, d = heat(a, b)
    him.save(f'{OUT}/heat-{label.split("·")[0]}-{label.split("·")[1]}.png')
    Image.open(mp).save(f'{OUT}/mine-{label.split("·")[0]}-{label.split("·")[1]}.png')
    Image.open(rp).save(f'{OUT}/ref-{label.split("·")[0]}-{label.split("·")[1]}.png')
    g = grid(d)
    flat = sorted(((g[i][j], i, j) for i in range(8) for j in range(6)), reverse=True)

    def loc(i, j):
        y0, y1 = i * H // 8, (i + 1) * H // 8
        x0, x1 = j * W // 6, (j + 1) * W // 6
        vert = '上' if i <= 2 else ('中' if i <= 5 else '下')
        horiz = '左' if j <= 1 else ('中' if j <= 3 else '右')
        return f'{vert}{horiz} y{y0}-{y1} x{x0}-{x1}'

    rows.append({
        'label': label,
        'overall': float(d.mean()),
        'grid': g,
        'worst': [(round(v, 1), loc(i, j)) for v, i, j in flat[:5]],
        'best': [(round(v, 1), loc(i, j)) for v, i, j in flat[-3:]],
        'slug': f'{label.split("·")[0]}-{label.split("·")[1]}',
    })

# ── HTML ──
def cell(v):
    t = min(v / 90.0, 1.0)
    r = int(30 + t * 200); g = int(200 - t * 150); bl = int(140 - t * 110)
    return f'<td style="background:rgb({r},{g},{bl});color:#000;text-align:center">{v:.0f}</td>'

html = ['<!doctype html><meta charset="utf-8"><title>玄览 · 与参考图差异报告</title>',
        '<style>body{font-family:system-ui,"Microsoft YaHei",sans-serif;background:#12141a;color:#e8e4dc;margin:0;padding:24px}',
        'h1{font-size:20px}h2{font-size:16px;margin-top:28px;border-left:3px solid #d8b478;padding-left:8px}',
        '.wrap{display:flex;gap:12px;flex-wrap:wrap}.box{flex:1 1 420px;min-width:320px}',
        '.box img{width:100%;border:1px solid #333;border-radius:6px;display:block}',
        'table{border-collapse:collapse;margin-top:8px}td{padding:4px 10px;border:1px solid #333;font-size:12px}',
        '.cap{font-size:12px;color:#9a9;font-variant-numeric:tabular-nums}',
        'ul{font-size:13px;line-height:1.7}p{font-size:13px;color:#b9b4aa}</style>',
        '<h1>玄览 · 与参考图的像素差异报告</h1>',
        '<p>数值 = 该区域平均 RGB 差值（0=完全一致，90+ = 完全不同）。数字越大说明这块和参考差得越多，照着「差异最大」的区域挑问题最省事。</p>']

for r in rows:
    html.append(f'<h2>{r["label"]} — 全图平均差异 {r["overall"]:.1f}</h2>')
    html.append('<div class="wrap">')
    html.append(f'<div class="box"><div class="cap">我的实现</div><img src="mine-{r["slug"]}.png"></div>')
    html.append(f'<div class="box"><div class="cap">你的参考</div><img src="ref-{r["slug"]}.png"></div>')
    html.append(f'<div class="box"><div class="cap">差异热力（越红差越大）</div><img src="heat-{r["slug"]}.png"></div>')
    html.append('</div>')
    html.append('<table><tr><td></td>' + ''.join(f'<td>{j}</td>' for j in range(6)) + '</tr>')
    for i, row in enumerate(r['grid']):
        html.append(f'<tr><td>行{i}</td>' + ''.join(cell(v) for v in row) + '</tr>')
    html.append('</table>')
    html.append('<ul>')
    for v, l in r['worst']:
        html.append(f'<li>差异最大：{l} → <b>{v}</b></li>')
    html.append('</ul>')

html.append('</body>')
open(f'{OUT}/index.html', 'w', encoding='utf-8').write('\n'.join(html))
print('report ->', f'{OUT}/index.html')
for r in rows:
    print(f'{r["label"]}: overall={r["overall"]:.1f} worst={r["worst"][:3]}')
