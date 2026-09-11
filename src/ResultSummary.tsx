import React from 'react';
import type { Consensus } from './core';
import { AXIS_LABELS, overallAgreement } from './core-meta';

interface ResultSummaryProps {
  consensus: Consensus[];
  headline?: string;
  topicLabel: string;
  qtext?: string;
}

/** 结论卡右侧的山水装饰（主题化渐变，参考图 Screen 03 的配图位） */
function SummaryScenery() {
  return (
    <svg className="rs-scenery" viewBox="0 0 220 120" aria-hidden="true" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="rs-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--atmo-1)" />
          <stop offset="100%" stopColor="transparent" />
        </linearGradient>
        <linearGradient id="rs-mtn" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--mtn-far)" />
          <stop offset="100%" stopColor="var(--mtn-near)" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="220" height="120" fill="url(#rs-sky)" />
      {/* 月 */}
      <circle cx="176" cy="26" r="12" fill="var(--gold)" fillOpacity="0.55" />
      <circle cx="176" cy="26" r="18" fill="var(--gold)" fillOpacity="0.12" />
      {/* 远山 */}
      <path d="M0 84 L36 52 L64 76 L96 44 L128 72 L160 50 L192 78 L220 60 L220 120 L0 120 Z" fill="url(#rs-mtn)" opacity="0.9" />
      <path d="M0 100 L30 82 L70 98 L110 80 L150 100 L190 86 L220 96 L220 120 L0 120 Z" fill="var(--mtn-near)" opacity="0.85" />
      {/* 星点 */}
      {[[20, 20], [52, 12], [88, 24], [124, 10], [150, 30]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="1" fill="var(--gold)" fillOpacity="0.7" />
      ))}
    </svg>
  );
}

/**
 * 结果页顶部 —— 「本次推演结论」卡片。
 * 照参考图 Screen 03：左侧 kicker + 一句话结论 + 主题，右侧山水配图。
 */
export function ResultSummary({ consensus, headline, topicLabel, qtext }: ResultSummaryProps) {
  if (consensus.length === 0) return null;

  const overall = overallAgreement(consensus);
  const overallPct = Math.round(overall * 100);

  // 取加权均值最极端的 2~3 条轴作为"倾向"快照
  const topAxes = [...consensus]
    .sort((a, b) => Math.abs(b.weightedMean) - Math.abs(a.weightedMean))
    .slice(0, 3);

  const directionWord = overall >= 0.65 ? '较为明确' : overall >= 0.4 ? '有一定参考' : '分歧较大，建议综合参考各体系原文';

  return (
    <section className="result-summary xl-card">
      <div className="rs-main">
        <div className="rs-head">
          <span className="rs-kicker">本次推演结论</span>
          <span className="rs-topic">{topicLabel}{qtext ? ` · ${qtext}` : ''}</span>
        </div>

        {headline && (
          <blockquote className="rs-quote">“{headline}”</blockquote>
        )}

        <div className="rs-verdict">
          <span className="rs-label">总体倾向</span>
          <strong>{directionWord}</strong>
          <span className="rs-align">
            {overallPct >= 65 ? (
              <span className="rs-tag rs-high">{overallPct}% 体系方向接近</span>
            ) : overallPct >= 40 ? (
              <span className="rs-tag rs-mid">{overallPct}% 存在分歧</span>
            ) : (
              <span className="rs-tag rs-low">{overallPct}% 分歧显著</span>
            )}
          </span>
        </div>

        {topAxes.length > 0 && (
          <div className="rs-dims">
            {topAxes.map((c) => {
              const lab = AXIS_LABELS[c.axis];
              const val = c.weightedMean > 0.2 ? lab.positive : c.weightedMean < -0.2 ? lab.negative : '中性';
              return (
                <span className="rs-dim" key={c.axis}>
                  {lab.positive}/{lab.negative}
                  <strong>{val}</strong>
                </span>
              );
            })}
          </div>
        )}
      </div>
      <SummaryScenery />
    </section>
  );
}
