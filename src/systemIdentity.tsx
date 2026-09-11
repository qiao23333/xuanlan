import type { SystemId } from './core';

/**
 * 玄览「八席」视觉身份：每个体系独一无二的席纹（sigil）+ 专属 accent 色。
 * 目的：让八张结果卡 / 八位顾问一眼可辨、各美其美，回应「各体系没有独立优化」的批评。
 * sigil 为 0 0 24 24 视图内的 SVG 内部标记，由 <SystemSigil> 渲染。
 */
export const ACCENTS: Record<SystemId, string> = {
  bazi: '#e0a93f', // 琥珀金 · 干支
  ziwei: '#c792ea', // 紫 · 帝星
  qimen: '#6fc3a0', // 青绿 · 遁甲
  liuren: '#4fb3c9', // 壬水蓝
  xiaoliuren: '#e0a05a', // 暖橙 · 掌诀
  meihua: '#8bbf6a', // 梅绿 · 爻
  astrolabe: '#9b8cff', // 星紫蓝
  tarot: '#d98cae', // 塔罗粉
};

export const SIGILS: Record<SystemId, string> = {
  bazi: `<g fill="currentColor"><rect x="6" y="4" width="3" height="3"/><rect x="15" y="4" width="3" height="3"/><rect x="6" y="17" width="3" height="3"/><rect x="15" y="17" width="3" height="3"/></g><line x1="12" y1="3" x2="12" y2="21" stroke="currentColor" stroke-width="1.1"/>`,
  ziwei: `<path fill="currentColor" d="M12 2 L13.4 10.6 L22 12 L13.4 13.4 L12 22 L10.6 13.4 L2 12 L10.6 10.6 Z"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/>`,
  qimen: `<g fill="none" stroke="currentColor" stroke-width="1.2"><rect x="4" y="4" width="16" height="16" rx="1"/><path d="M4 12h16M12 4v16"/></g>`,
  liuren: `<g fill="none" stroke="currentColor" stroke-width="1.2"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/></g><circle cx="12" cy="12" r="1.4" fill="currentColor"/>`,
  xiaoliuren: `<path fill="none" stroke="currentColor" stroke-width="1.2" d="M12 3l7.8 4.5v9L12 21l-7.8-4.5v-9z"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/>`,
  meihua: `<g stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><line x1="5" y1="6" x2="19" y2="6"/><line x1="5" y1="12" x2="11" y2="12"/><line x1="13" y1="12" x2="19" y2="12"/><line x1="5" y1="18" x2="19" y2="18"/></g>`,
  astrolabe: `<g fill="none" stroke="currentColor" stroke-width="1.2"><circle cx="12" cy="12" r="9"/><path d="M12 3v18M3 12h18"/></g><circle cx="12" cy="7" r="1.3" fill="currentColor"/><circle cx="17" cy="12" r="1.3" fill="currentColor"/>`,
  tarot: `<g fill="none" stroke="currentColor" stroke-width="1.2"><rect x="7.5" y="3" width="9" height="18" rx="2"/></g><path fill="currentColor" d="M12 6.5l.9 2.3 2.5.1-1.9 1.7.6 2.5L12 11.8 10.9 13.1l.6-2.5L9.6 8.9l2.5-.1z"/>`,
};

/** 各体系单字（用于 canvas 导出等无法承载 SVG 的场合）。 */
export const GLYPHS: Record<SystemId, string> = {
  bazi: '八', ziwei: '紫', qimen: '奇', liuren: '壬',
  xiaoliuren: '小', meihua: '梅', astrolabe: '星', tarot: '塔',
};

export function SystemSigil({ id, size = 22 }: { id: SystemId; size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className="sigil"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: SIGILS[id] }}
    />
  );
}
