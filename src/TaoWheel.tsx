import React from 'react';
import light from './assets/taiji-light.png';
import dark from './assets/taiji-dark.png';

/**
 * 推演结果页用的太极轮（用户指定素材：资料/新参考/图标/浅色·深色结果页图.png）。
 *
 * 为什么用位图：用户给的是带多层同心环 + 星点 + 八卦的渲染稿，矢量简笔出不了这个信息量；
 * 透明底 PNG 直接引用即 100% 保真。浅/深两套图都在 DOM 里，靠 .ic-dark / .ic-light +
 * [data-theme] 切换，换主题不重渲染（与 SystemIcon 同一套路）。
 *
 * 图片由 Vite 经 import 处理，URL 已自带 base，GitHub Pages 子路径(/xuanlan/)下不会 404。
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
