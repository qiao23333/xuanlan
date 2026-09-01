import React from 'react';
import type { Consensus, TopicId } from './core';
import { AXIS_LABELS, overallAgreement } from './core';

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
};

/**
 * 共识度仪表盘——聚合平台的灵魂。
 * 把 N 个体系投影到 6 条决策轴的断言聚成：加权均值（指向）+ 共识度%（一致比例）+ 分歧体系。
 */
export function ConsensusDashboard({ consensus, topic }: { consensus: Consensus[]; topic: TopicId }) {
  if (consensus.length === 0) return null;
  const overall = overallAgreement(consensus);
  const related = TOPIC_AXES[topic] ?? TOPIC_AXES.general;

  return (
    <section className="consensus">
      <div className="cons-head">
        <h3>共识度仪表盘</h3>
        <span className="cons-overall">总体共识 {Math.round(overall * 100)}%</span>
        <span className="cons-hint">
          八大体系在同一维度上的意见一致程度——<b>不是预测准确率</b>，只说明「它们是否想到一块去」
        </span>
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
                </span>
                <span className="axis-agree">
                  {pct}% 一致 · {c.sampleSize} 体系
                </span>
              </div>
              <div className="axis-bar">
                <div className="axis-mid" />
                <div className="axis-mean" style={{ left: `${left}%` }} title={`加权均值 ${c.weightedMean}`} />
              </div>
              <div className="axis-foot">
                <span className="axis-dir">{dir}</span>
                {c.outliers.length > 0 && (
                  <span className="axis-div">分歧：{c.outliers.map((o) => o.systemId).join('、')}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
