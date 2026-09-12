import React from 'react';
import type { Consensus } from './core';
import { AXIS_LABELS, overallAgreement } from './core-meta';

interface ResultSummaryProps {
  consensus: Consensus[];
  headline?: string;
  topicLabel: string;
  qtext?: string;
}

/** 综合结论区左侧太极装饰（参考设计稿 Screen 03） */
function TaijiDecor({ size = 120 }: { size?: number }) {
  const cx = 50, cy = 50, r = 42;
  return (
    <svg className="rs-taiji" viewBox="0 0 100 100" width={size} height={size} aria-hidden="true">
      <defs>
        <linearGradient id="rsTjGold" x1="0" y1="0" x2="0.55" y2="1">
          <stop offset="0%" stopColor="var(--taiji-light, #f6e3ae)" />
          <stop offset="100%" stopColor="color-mix(in srgb, var(--taiji-light) 82%, var(--gold-soft))" />
        </linearGradient>
      </defs>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--gold)" strokeWidth="0.4" opacity=".25" />
      <circle cx={cx} cy={cy} r={r-2} fill="none" stroke="var(--gold)" strokeWidth="0.2" opacity=".15" />
      <g>
        <circle cx={cx} cy={cy} r={r * 0.48} fill="var(--taiji-ink, #2a1f15)" />
        <path d={`M${cx} ${cy - r*0.48}A${r*0.48} ${r*0.48} 0 0 1 ${cx} ${cy + r*0.48}Z`} fill="url(#rsTjGold)" />
        {/* 朝向与参考稿一致：金鱼头在下、墨鱼头在上 */}
        <circle cx={cx} cy={cy + r*0.24} r={r * 0.24} fill="url(#rsTjGold)" />
        <circle cx={cx} cy={cy - r*0.24} r={r * 0.24} fill="var(--taiji-ink, #2a1f15)" />
        <circle cx={cx} cy={cy + r*0.24} r={r * 0.08} fill="var(--taiji-ink, #2a1f15)" />
        <circle cx={cx} cy={cy - r*0.24} r={r * 0.08} fill="url(#rsTjGold)" />
      </g>
    </svg>
  );
}

/**
 * 结果页 —— 综合结论（参考设计稿：左侧太极 + 右侧文字）。
 */
export function ResultSummary({ consensus, headline, topicLabel, qtext }: ResultSummaryProps) {
  if (consensus.length === 0) return null;

  const overall = overallAgreement(consensus);
  const overallPct = Math.round(overall * 100);

  const topAxes = [...consensus]
    .sort((a, b) => Math.abs(b.weightedMean) - Math.abs(a.weightedMean))
    .slice(0, 3);

  const directionWord = overall >= 0.65 ? '较为明确' : overall >= 0.4 ? '有一定参考' : '分歧较大，建议综合参考各体系原文';

  return (
    <section className="result-summary xl-card">
      <div className="rs-layout">
        {/* 左侧：太极装饰 */}
        <div className="rs-taiji-wrap">
          <TaijiDecor />
        </div>

        {/* 右侧：文字内容 */}
        <div className="rs-body">
          <div className="rs-head">
            <span className="rs-kicker">综合结论</span>
            <span className="rs-kicker-en">OVERALL CONCLUSION</span>
          </div>

          {headline && (
            <h3 className="rs-title">{headline}</h3>
          )}

          <p className="rs-desc">
            你是一个{overall >= 0.5 ? '思想缜密、意蕴丰富' : '内心丰富、善于观察'}的人。
            在变中寻找恒常，具各体系的引路微光，指引内在探索之路。
            {topAxes.length > 0 && (
              <> 当前在 <strong>{AXIS_LABELS[topAxes[0].axis]?.name || topAxes[0].axis}</strong> 维度上倾向最为显著。</>
            )}
          </p>

          {headline && (
            <blockquote className="rs-quote">"{headline}"</blockquote>
          )}

          <div className="rs-meta-row">
            <span className="rs-label">体系共识度</span>
            <strong className="rs-pct">{overallPct}%</strong>
            <span className={`rs-tag ${overallPct >= 65 ? 'rs-high' : overallPct >= 40 ? 'rs-mid' : 'rs-low'}`}>
              {directionWord}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
