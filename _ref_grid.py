# -*- coding: utf-8 -*-
"""精细切块分析：定位每屏布局 / 蓝色CTA / 金色元素分布"""
import colorsys
from PIL import Image

def hexc(px):
    return '#%02x%02x%02x' % (int(px[0]), int(px[1]), int(px[2]))

def analyze(path, label):
    img = Image.open(path).convert('RGB')
    w, h = img.size
    print('=' * 80)
    print(label, '%dx%d' % (w, h))

    # 1) 蓝色像素分布图（CTA 定位）——24x14 网格，每格蓝色像素计数
    small = img.resize((480, 270))
    grid_w, grid_h = 24, 14
    cell_w, cell_h = 480 // grid_w, 270 // grid_h
    blue_cnt = [[0] * grid_w for _ in range(grid_h)]
    gold_cnt = [[0] * grid_w for _ in range(grid_h)]
    bright_cnt = [[0] * grid_w for _ in range(grid_h)]
    for gy in range(grid_h):
        for gx in range(grid_w):
            for y in range(gy * cell_h, (gy + 1) * cell_h, 2):
                for x in range(gx * cell_w, (gx + 1) * cell_w, 2):
                    r, g, b = small.getpixel((x, y))
                    mx = max(r, g, b) / 255.0
                    mn = min(r, g, b) / 255.0
                    sat = (mx - mn) / mx if mx > 0 else 0
                    if sat > 0.3 and mx > 0.3:
                        hh, ss, vv = colorsys.rgb_to_hsv(r / 255.0, g / 255.0, b / 255.0)
                        deg = hh * 360
                        if 190 <= deg <= 230:  # 蓝
                            blue_cnt[gy][gx] += 1
                        elif 25 <= deg <= 60:   # 金
                            gold_cnt[gy][gx] += 1
                    if mx > 0.82 and sat < 0.2:  # 亮白（大字/高亮）
                        bright_cnt[gy][gx] += 1

    print('-- blue (CTA) map: . none, 1-9 count scale --')
    for r in range(grid_h):
        print('   ' + ''.join(str(min(9, blue_cnt[r][c])) if blue_cnt[r][c] else '.' for c in range(grid_w)))
    print('-- gold map --')
    for r in range(grid_h):
        print('   ' + ''.join(str(min(9, gold_cnt[r][c])) if gold_cnt[r][c] else '.' for c in range(grid_w)))
    print('-- bright/white text map --')
    for r in range(grid_h):
        print('   ' + ''.join(str(min(9, bright_cnt[r][c] // 3)) if bright_cnt[r][c] // 3 else '.' for c in range(grid_w)))

    # 2) 行亮度剖面（找水平分界线/区块边界）
    lum = img.convert('L').resize((1, 60))
    print('-- row luma profile (60 rows, 0-9) --')
    print('   ' + ''.join(str(min(9, lum.getpixel((0, r)) * 10 // 256)) for r in range(60)))

    # 3) 列亮度剖面
    lumc = img.convert('L').resize((80, 1))
    print('-- col luma profile (80 cols, 0-9) --')
    print('   ' + ''.join(str(min(9, lumc.getpixel((c, 0)) * 10 // 256)) for c in range(80)))

analyze('G:/work/牛马/wb工作空间/xuanlan/资料/Codex 图像 2026年9月11日 15_31_49.png', '图1 暗色完整原型')
analyze('G:/work/牛马/wb工作空间/xuanlan/资料/Codex 图像 2026年9月11日 15_40_11.png', '图3 亮色版')