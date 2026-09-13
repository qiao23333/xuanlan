import React from 'react';
import type { Consensus } from './core';
import { AXIS_LABELS, overallAgreement } from './core-meta';
import { TaoWheel } from './TaoWheel';

interface ResultSummaryProps {
  consensus: Consensus[];
  headline?: string;
  topicLabel: string;
  qtext?: string;
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
        {/* 左侧：太极轮（用户素材，按主题切换） */}
        <div className="rs-taiji-wrap">
          <TaoWheel size={200} />
        </div>

        {/* 中间：文字内容 */}
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

        {/* 右侧：竖排行动指引（参考图 Screen 03） */}
        <aside className="rs-sidebar" aria-hidden="true">
          <span className="rs-sb-item">知己</span>
          <span className="rs-sb-item">识己</span>
          <span className="rs-sb-item">解势</span>
          <span className="rs-sb-item">趋远</span>
        </aside>
      </div>
    </section>
  );
}
