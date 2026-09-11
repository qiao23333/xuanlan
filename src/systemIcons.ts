import type { SystemId } from './core';

/**
 * 八大体系图标映射。
 *
 * 图标来源：资料/新参考/图标/ 下 8 张图，已去黑底并生成深浅两版，
 * 落在 public/icons/system/{dark,light}/sys-01..08.png。
 *
 * ⚠️ 序号对应关系是**按图形特征推测**的，尚未经人工确认：
 *   01 四柱（年/月/日/时四竖柱） → 八字
 *   02 圆形十二宫星盘          → 紫微
 *   03 九宫格                  → 奇门
 *   04 圆 + 十字点（天地盘）    → 大六壬
 *   05 十字柱 + 上下方（六神）  → 小六壬
 *   06 大圆 + 十二放射（黄道）  → 西洋占星
 *   07 实心圆象                → 塔罗
 *   08 八方 + 中方（罗盘/八卦） → 梅花
 * 若某几个对不上，只改下面这张表即可，其余代码不用动。
 */
export const SYSTEM_ICON: Record<SystemId, number> = {
  bazi: 1,
  ziwei: 2,
  qimen: 3,
  liuren: 4,
  xiaoliuren: 5,
  astrolabe: 6,
  tarot: 7,
  meihua: 8,
};

/** 用 Vite 的 BASE_URL 拼路径，才能保证 GitHub Pages 子路径部署下也能取到。 */
export function systemIconSrc(id: SystemId, theme: 'dark' | 'light'): string {
  const n = String(SYSTEM_ICON[id] ?? 1).padStart(2, '0');
  return `${import.meta.env.BASE_URL}icons/system/${theme}/sys-${n}.png`;
}
