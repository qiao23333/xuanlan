import React from 'react';
import type { Consensus, TopicId } from './core';
import { AXIS_LABELS, overallAgreement } from './core-meta';

/** 问事主题 → 高亮相关决策轴 */
const TOPIC_AXES: Record<TopicId, string[]> = {
  general: ['action', 'timing', 'social', 'risk', 'change', 'auspicious'],
  career: ['risk', 'timing', 'auspicious'],
  romance: ['social', 'auspicious'],
  money: ['auspicious', 'risk'],
  move: ['action', 'timing'],
  study: ['timing', 'auspicious'],
  health: ['auspicious'],
  relationship: ['social', 'change'],
  // TopicId 含 timing（择时），表单暂未开放 —— 但 Record<TopicId,…> 是穷尽的，
  // 漏键本就该被类型检查抓住（此前前端整片不在 tsc 范围内，所以没抓到）。
  timing: ['timing', 'auspicious'],
};

/** 一致率 → 颜色：高=玉(稳)，中=金，低=红(分歧大) */
function agreeColor(p: number): string {
  if (p >= 0.75) return 'var(--jade)';
  if (p >= 0.5) return 'var(--gold)';
  return 'var(--red)';
}

function ConsensusRing({ pct }: { pct: number }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const off = c * (1 - pct);
  const label = Math.round(pct * 100);
  return (
    <svg className="cons-ring" viewBox="0 0 120 120" width="120" height="120" role="img" aria-label={`总体共识度 ${label}%`}>
      <defs>
        <linearGradient id="ringGold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f3dd9a" />
          <stop offset="100%" stopColor="#c9a44a" />
        </linearGradient>
      </defs>
      <circle cx="60" cy="60" r={r} fill="none" stroke="var(--line)" strokeWidth="10" />
      <circle
        cx="60" cy="60" r={r} fill="none" stroke="url(#ringGold)" strokeWidth="10" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={off} transform="rotate(-90 60 60)"
      />
      <text x="60" y="56" textAnchor="middle" className="ring-num">{label}</text>
      <text x="60" y="74" textAnchor="middle" className="ring-pct">%</text>
    </svg>
  );
}

/**
 * 共识度仪表盘——聚合平台的灵魂。
 * 顶部：总体共识 SVG 圆环（直观、有质感）。
 * 轴列表：每条决策轴一张「一致率色条 + 方向仪表」，相关主题轴高亮，分歧体系点名。
 */
export function ConsensusDashboard({ consensus, topic }: { consensus: Consensus[]; topic: TopicId }) {
  if (consensus.length === 0) return null;
  const overall = overallAgreement(consensus);
  const related = TOPIC_AXES[topic] ?? TOPIC_AXES.general;

  // 找分歧最大的轴（一致率最低且样本≥3），给一句引导
  const dissent = [...consensus].filter((c) => c.sampleSize >= 3).sort((a, b) => a.agreement - b.agreement)[0];

  return (
    <section className="consensus">
      <div className="cons-head">
        <h3>共识度仪表盘</h3>
        <span className="cons-overall">总体共识 {Math.round(overall * 100)}%</span>
        <span className="cons-hint">
          八大体系在同一维度上的意见一致程度——<b>不是预测准确率</b>，只说明「它们是否想到一块去」
        </span>
      </div>

      <div className="cons-layout">
        <div className="cons-ringwrap">
          <ConsensusRing pct={overall} />
          <div className="ring-cap">共识度</div>
        </div>

        <div className="cons-axes">
          {consensus.map((c) => {
            const lab = AXIS_LABELS[c.axis];
            const pct = Math.round(c.agreement * 100);
            const isRelated = related.includes(c.axis);
            const left = 50 + c.weightedMean * 25; // [-2,2] → [0,100]%
            const dir = c.weightedMean > 0.3 ? lab.positive : c.weightedMean < -0.3 ? lab.negative : '中性';
            return (
              <div className={`cons-axis${isRelated ? ' cons-related' : ''}`} key={c.axis}>
                <div className="axis-top">
                  <span className="axis-name">
                    {lab.positive} ↔ {lab.negative}
                    {isRelated && <span className="axis-tag" title="与你所选主题最相关">主题相关</span>}
                  </span>
                  <span className="axis-agree">{c.sampleSize} 体系 · {pct}% 一致</span>
                </div>

                <div className="axis-gauge">
                  <span className="g-end g-neg">{lab.negative}</span>
                  <div className="axis-bar">
                    <div className="axis-mid" />
                    <div className="axis-mean" style={{ left: `${left}%` }} title={`加权均值 ${c.weightedMean}`} />
                  </div>
                  <span className="g-end g-pos">{lab.positive}</span>
                </div>

                <div className="axis-meter" aria-label={`一致率 ${pct}%`}>
                  <div className="meter-fill" style={{ width: `${pct}%`, background: agreeColor(c.agreement) }} />
                </div>

                <div className="axis-foot">
                  <span className="axis-dir" style={{ color: agreeColor(c.agreement) }}>{dir}</span>
                  {c.outliers.length > 0 && (
                    <span className="axis-div">分歧：{c.outliers.map((o) => o.systemId).join('、')}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {dissent && dissent.agreement < 0.75 && (
        <p className="cons-dissent-note">
          分歧最大的维度是「{AXIS_LABELS[dissent.axis].positive} ↔ {AXIS_LABELS[dissent.axis].negative}」（仅 {Math.round(dissent.agreement * 100)}% 一致）
          —— 玄览已把它放进下方「<b>合议分歧</b>」，两派理由都给你看。
        </p>
      )}
    </section>
  );
}
