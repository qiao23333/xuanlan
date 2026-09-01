/**
 * 玄览 · 共识度聚合
 *
 * 把 N 个体系的 assertions（各自投影到 6 条决策轴）按轴归并，
 * 算出加权均值与「共识度」，并标出偏离明显的分歧体系。
 *
 * 关键：共识度是本平台定义的「一致性指标」，不代表预测概率，
 * 也不代表任何体系更「准」。它只回答一个问题：这堆体系在同一件事上，意见一致吗？
 */

import type { Assertion, AxisId, Consensus } from './types.ts';
import { AXIS_IDS } from './types.ts';

/**
 * 聚合断言到决策轴。
 * @returns 仅返回「有体系表态」的轴（某轴无断言则不出）
 */
export function aggregateConsensus(assertions: Assertion[]): Consensus[] {
  const groups = new Map<AxisId, Assertion[]>();
  for (const a of assertions) {
    const g = groups.get(a.axis);
    if (g) g.push(a);
    else groups.set(a.axis, [a]);
  }

  const out: Consensus[] = [];
  for (const axis of AXIS_IDS) {
    const list = groups.get(axis);
    if (!list || list.length === 0) continue;

    const totalW = list.reduce((s, a) => s + a.confidence, 0) || 1;
    const weightedMean = list.reduce((s, a) => s + a.score * a.confidence, 0) / totalW;
    const meanSign = Math.sign(weightedMean);
    const sameDir = list.filter((a) => a.score === 0 || Math.sign(a.score) === meanSign).length;
    const agreement = sameDir / list.length;
    const outliers = list
      .filter((a) => Math.abs(a.score - weightedMean) > 1.0)
      .sort((x, y) => Math.abs(y.score - weightedMean) - Math.abs(x.score - weightedMean));

    out.push({ axis, weightedMean, agreement, outliers, sampleSize: list.length });
  }
  return out;
}

/**
 * 总体共识度：所有轴共识度的平均值，0..1。
 * 给「结果墙」顶部一个总览徽章用。
 */
export function overallAgreement(consensus: Consensus[]): number {
  if (consensus.length === 0) return 0;
  return consensus.reduce((s, c) => s + c.agreement, 0) / consensus.length;
}
