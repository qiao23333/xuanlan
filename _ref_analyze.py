# -*- coding: utf-8 -*-
"""参考图像素分析（纯 PIL，绕开 numpy）"""
import glob, os, colorsys
from PIL import Image

def hexc(px):
    return '#%02x%02x%02x' % (int(px[0]), int(px[1]), int(px[2]))

files = sorted(glob.glob('G:/work/牛马/wb工作空间/xuanlan/资料/*.png'))
print('files:', [os.path.basename(f) for f in files])

for f in files:
    img = Image.open(f).convert('RGB')
    w, h = img.size
    print('=' * 76)
    print(os.path.basename(f), '%dx%d' % (w, h))

    # 主色板
    q = img.resize((240, 240)).quantize(colors=8)
    pal = q.getpalette()
    counts = sorted(q.getcolors(240 * 240), reverse=True)
    print('-- dominant palette --')
    for cnt, idx in counts:
        rgb = pal[idx * 3: idx * 3 + 3]
        print('   %s  %5.1f%%' % (hexc(rgb), cnt * 100.0 / (240 * 240)))

    # 饱和色：200x200 缩图遍历
    small = img.resize((200, 200))
    total = 200 * 200
    bucket = {}
    for y in range(200):
        for x in range(200):
            r, g, b = small.getpixel((x, y))
            mx = max(r, g, b) / 255.0
            mn = min(r, g, b) / 255.0
            sat = (mx - mn) / mx if mx > 0 else 0
            if sat > 0.35 and mx > 0.25:
                hh, ss, vv = colorsys.rgb_to_hsv(r / 255.0, g / 255.0, b / 255.0)
                key = int(hh * 360) // 30
                bucket.setdefault(key, []).append((ss * 100, vv * 100, r, g, b))
    sat_n = sum(len(v) for v in bucket.values())
    print('-- saturated accents share %.1f%% --' % (sat_n * 100.0 / total))
    for k in sorted(bucket.keys(), key=lambda k: -len(bucket[k])):
        lst = bucket[k]
        hs = sum(x[0] for x in lst) / len(lst)
        vs = sum(x[1] for x in lst) / len(lst)
        ex = lst[0]
        print('   hue %3d-%3d  n=%4d  avgS=%3d  avgV=%3d  e.g. %s'
              % (k * 30, k * 30 + 30, len(lst), int(hs), int(vs), hexc((ex[2], ex[3], ex[4]))))

    # 亮度 ASCII 图 48x24
    lum = img.convert('L').resize((48, 24))
    chars = ' .:-=+*#%@'
    print('-- luma 48x24 --')
    for r in range(24):
        row = ''
        for c in range(48):
            v = lum.getpixel((c, r))
            row += chars[min(9, v * 10 // 256)]
        print('   ' + row)

    # 8x12 平均色网格
    grid = img.resize((8, 12))
    print('-- avg color grid 8x12 --')
    for r in range(12):
        print('   ' + ' '.join(hexc(grid.getpixel((c, r))) for c in range(8)))