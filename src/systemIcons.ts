import type { SystemId } from './core';

/**
 * 八大体系图标映射。
 *
 * 图标来源：资料/新参考/图标/ 下 8 张 Codex 2026-09-12 截图，
 * 去黑底、按主题调色后落在 public/icons/system/{dark,light}/sys-01..08.png。
 *
 * 映射依据（按 ASCII 缩略图判读）：
 *   sys-01  四列格子（年/月/日/时 四竖柱）   → 八字
 *   sys-02  圆盘+星点（十二宫星盘）           → 紫微斗数
 *   sys-03  3×3 九宫格                       → 奇门遁甲
 *   sys-04  复杂格（天地盘/九宫变体）         → 大六壬
 *   sys-05  菱形/八瓣花（梅花易数主图）       → 梅花易数
 *   sys-06  圆+十字（铜钱布局/天地圆盘）      → 小六壬
 *   sys-07  圆+底座（塔罗主视觉/卡座）        → 塔罗
 *   sys-08  圆+四方位十字（Aries/Cancer/Libra/Capricorn） → 西洋本命占星
 *
 * 若某几个对不上，只改下面这张表即可，其余代码不用动。
 */
export const SYSTEM_ICON: Record<SystemId, number> = {
  bazi: 1,
  ziwei: 2,
  qimen: 3,
  liuren: 4,
  meihua: 5,
  xiaoliuren: 6,
  tarot: 7,
  astrolabe: 8,
};

/** 用 Vite 的 BASE_URL 拼路径，才能保证 GitHub Pages 子路径部署下也能取到。 */
export function systemIconSrc(id: SystemId, theme: 'dark' | 'light'): string {
  const n = String(SYSTEM_ICON[id] ?? 1).padStart(2, '0');
  return `${import.meta.env.BASE_URL}icons/system/${theme}/sys-${n}.png`;
}
