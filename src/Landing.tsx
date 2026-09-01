import React from 'react';

/** 先天八卦：1 = 阳爻（整划），0 = 阴爻（断划） */
const TRIGRAMS: number[][] = [
  [1, 1, 1], // 乾
  [1, 1, 0], // 兑
  [1, 0, 1], // 离
  [1, 0, 0], // 震
  [0, 1, 1], // 巽
  [0, 1, 0], // 坎
  [0, 0, 1], // 艮
  [0, 0, 0], // 坤
];

function TaijiRing({ size = 190, spinning = false }: { size?: number; spinning?: boolean }) {
  return (
    <svg
      className={`taiji-ring${spinning ? ' spinning' : ''}`}
      viewBox="0 0 100 100"
      width={size}
      height={size}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="goldGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f4dc9c" />
          <stop offset="100%" stopColor="#c39a4e" />
        </linearGradient>
      </defs>

      {/* 外环 */}
      <circle cx="50" cy="50" r="47" fill="none" stroke="#3a2e52" strokeWidth="0.6" />
      <circle cx="50" cy="50" r="34" fill="none" stroke="#3a2e52" strokeWidth="0.6" />

      {/* 八卦：绕环排布 */}
      {TRIGRAMS.map((lines, i) => {
        const angle = (i / 8) * Math.PI * 2 - Math.PI / 2;
        const r = 40.5;
        const cx = 50 + r * Math.cos(angle);
        const cy = 50 + r * Math.sin(angle);
        const rot = (angle * 180) / Math.PI + 90;
        return (
          <g key={i} transform={`translate(${cx} ${cy}) rotate(${rot})`}>
            {lines.map((v, j) => {
              const y = (j - 1) * 4.1 - 1;
              if (v === 1) {
                return <rect key={j} x={-5.6} y={y} width={11.2} height={1.9} rx={0.5} fill="url(#goldGrad)" />;
              }
              return (
                <g key={j}>
                  <rect x={-5.6} y={y} width={4.4} height={1.9} rx={0.5} fill="url(#goldGrad)" />
                  <rect x={1.2} y={y} width={4.4} height={1.9} rx={0.5} fill="url(#goldGrad)" />
                </g>
              );
            })}
          </g>
        );
      })}

      {/* 太极：外圆 r=16 心在 (50,50)，则上顶点 (50,34)、下顶点 (50,66)。
          阴鱼 = 右侧大半圆 + S 形曲线（两段 r=8 半圆），两点落在两小圆圆心 (50,42)/(50,58)。 */}
      <g className="taiji-core">
        <path
          d="M50 34 a16 16 0 0 1 0 32 a8 8 0 0 1 0 -16 a8 8 0 0 0 0 -16 z"
          fill="url(#goldGrad)"
        />
        <circle cx="50" cy="50" r="16" fill="none" stroke="url(#goldGrad)" strokeWidth="0.9" />
        <circle cx="50" cy="42" r="2.6" fill="#0a0810" />
        <circle cx="50" cy="58" r="2.6" fill="url(#goldGrad)" />
      </g>
    </svg>
  );
}

/**
 * 入场页：产品的"入口"。
 * 玄学产品的第一秒就该有仪式感——太极缓转，八卦环列，点「启」才进主应用。
 */
export function Landing({
  onEnter,
  onCase,
}: {
  onEnter: () => void;
  onCase: () => void;
}) {
  return (
    <section className="landing">
      <div className="landing-glow" />
      <TaijiRing size={190} />
      <h1 className="landing-title">玄览</h1>
      <p className="landing-sub">一次输入 · 八大体系并排推演</p>
      <p className="landing-desc">
        八字 · 紫微 · 奇门 · 大六壬 · 小六壬 · 梅花易数 · 西洋占星 · 塔罗
        <br />
        内核按古籍规则确定性计算，结果可解释、可复现、可溯源。
      </p>

      <div className="landing-actions">
        <button className="enter-btn" type="button" onClick={onEnter}>
          <span>启</span>
        </button>
        <button className="link case-link" type="button" onClick={onCase}>
          看看这个项目是怎么做出来的 →
        </button>
      </div>

      <p className="landing-foot">内核严肃 · 外壳科普 · 仅供文化体验与学习</p>
    </section>
  );
}

export { TaijiRing };
