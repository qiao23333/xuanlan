import React from 'react';
import light from './assets/taiji-light.webp';
import dark from './assets/taiji-dark.webp';

/**
 * 推演结果页用的太极轮（用户指定素材：资料/新参考/图标/浅色·深色结果页图.png）。
 *
 * 为什么用位图：用户给的是带多层同心环 + 星点 + 八卦的渲染稿，矢量简笔出不了这个信息量；
 * 透明底位图直接引用即 100% 保真。浅/深两套图都在 DOM 里，靠 .ic-dark / .ic-light +
 * [data-theme] 切换，换主题不重渲染（与 SystemIcon 同一套路）。
 *
 * 素材是 640×640 的 WebP（不是原始 1254² PNG）：最大显示 200px，640 已覆盖 3× DPR，
 * 单图 2MB → 178KB，两张省下 3.6MB —— 见 tools/img-optimize.py。
 * 图片由 Vite import 处理，URL 已自带 base，GitHub Pages 子路径(/xuanlan/)下不会 404。
 */
export function TaoWheel({
  size = 104,
  spinning = false,
  className = '',
}: {
  size?: number;
  spinning?: boolean;
  className?: string;
}) {
  return (
    <span
      className={`tao-wheel${spinning ? ' wheel-spin' : ''} ${className}`.trim()}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <img className="ic-dark" src={dark} alt="" width={size} height={size} decoding="async" />
      <img className="ic-light" src={light} alt="" width={size} height={size} decoding="async" />
    </span>
  );
}
