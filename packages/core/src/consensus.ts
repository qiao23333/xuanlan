/**
 * 玄览 · 共识度聚合
 *
 * 把 N 个体系的 assertions（各自投影到 6 条决策轴）按轴归并，
 * 算出加权均值与「共识度」，并标出偏离明显的分歧体系。
 *
 * 关键：共识度是本平台定义的「一致性指标」，不代表预测概率，
 * 也不代表任何体系更「准」。它只回答一个问题：这堆体系在同一件事上，意见一致吗？
 */

import type { Assertion, AxisId, Consensus, SystemId } from './types.ts';
import { AXIS_IDS, AXIS_LABELS } from './types.ts';
import { SYSTEM_META } from './registry.ts';

/**
 * 层：命盘（长期结构） vs 卜卦（当前事件窗口）。
 *
 * 这两层回答的根本不是同一个问题 —— 命盘问「你这个人 / 这段运势的底色」，
 * 卜卦问「这件事此刻怎么走」。把它们加权平均成一个数字，等于把
 * 「性格谨慎」和「这事现在别动」混为一谈。所以共识必须分层算。
 */
export type LayerId = 'chart' | 'divination';

/** 同一根轴上，两层的方向错位 */
export interface CrossLayerGap {
  axis: AxisId;
  chartMean: number;
  divinationMean: number;
  /** 两层均值之差的绝对值，越大说明「底色」与「当下」越拧巴 */
  distance: number;
  chartDir: -1 | 0 | 1;
  divinationDir: -1 | 0 | 1;
  chartSize: number;
  divinationSize: number;
}

export interface LayeredConsensus {
  chart: Consensus[];
  divination: Consensus[];
  /**
   * 全层混算。保留它**只为了对照**：默认不再单独作为结论呈现，
   * 因为它是把两个不同问题压成了一个数字。
   */
  all: Consensus[];
  /** 两层方向相反或明显错位的轴，按距离降序 */
  crossLayerGaps: CrossLayerGap[];
}

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

    out.push(summarizeAxis(axis, list));
  }
  return out;
}

/** 单轴的均值 / 共识度 / 离群，抽出来供分层聚合复用 */
function summarizeAxis(axis: AxisId, list: Assertion[]): Consensus {
  const totalW = list.reduce((s, a) => s + a.confidence, 0) || 1;
  const weightedMean = list.reduce((s, a) => s + a.score * a.confidence, 0) / totalW;
  const meanSign = Math.sign(weightedMean);
  const sameDir = list.filter((a) => a.score === 0 || Math.sign(a.score) === meanSign).length;
  const agreement = sameDir / list.length;
  const outliers = list
    .filter((a) => Math.abs(a.score - weightedMean) > 1.0)
    .sort((x, y) => Math.abs(y.score - weightedMean) - Math.abs(x.score - weightedMean));

  return { axis, weightedMean, agreement, outliers, sampleSize: list.length };
}

/**
 * 分层聚合：命盘层与卜卦层**分别**算共识，再找出两层的错位。
 *
 * 为什么不直接改 aggregateConsensus 的返回值：
 * 老函数已被 report / golden 测试 / 分享卡等多处依赖，改签名属于破坏性变更。
 * 这里新增一个函数，老的保持原样，UI 层自行决定呈现哪一套。
 */
export function aggregateConsensusByLayer(assertions: Assertion[]): LayeredConsensus {
  const categoryOf = (id: SystemId): LayerId => SYSTEM_META[id]?.category ?? 'divination';

  const byLayer: Record<LayerId, Map<AxisId, Assertion[]>> = { chart: new Map(), divination: new Map() };
  for (const a of assertions) {
    const layer = categoryOf(a.systemId);
    const m = byLayer[layer];
    const g = m.get(a.axis);
    if (g) g.push(a);
    else m.set(a.axis, [a]);
  }

  const build = (m: Map<AxisId, Assertion[]>): Consensus[] => {
    const out: Consensus[] = [];
    for (const axis of AXIS_IDS) {
      const list = m.get(axis);
      if (list && list.length) out.push(summarizeAxis(axis, list));
    }
    return out;
  };

  const chart = build(byLayer.chart);
  const divination = build(byLayer.divination);

  // 两层都在同一根轴上表态时，才谈得上「错位」
  const gaps: CrossLayerGap[] = [];
  for (const c of chart) {
    const d = divination.find((x) => x.axis === c.axis);
    if (!d) continue;
    const distance = Math.abs(c.weightedMean - d.weightedMean);
    const opposite = c.weightedMean * d.weightedMean < 0;
    // 阈值 0.5：低于这个量的差异，基本落在各家噪声里，不值得单独点名
    if (distance >= 0.5 || opposite) {
      gaps.push({
        axis: c.axis,
        chartMean: c.weightedMean,
        divinationMean: d.weightedMean,
        distance,
        chartDir: Math.sign(c.weightedMean) as -1 | 0 | 1,
        divinationDir: Math.sign(d.weightedMean) as -1 | 0 | 1,
        chartSize: c.sampleSize,
        divinationSize: d.sampleSize,
      });
    }
  }
  gaps.sort((a, b) => b.distance - a.distance);

  return { chart, divination, all: aggregateConsensus(assertions), crossLayerGaps: gaps };
}

/**
 * 总体共识度：所有轴共识度的平均值，0..1。
 * 给「结果墙」顶部一个总览徽章用。
 */
export function overallAgreement(consensus: Consensus[]): number {
  if (consensus.length === 0) return 0;
  return consensus.reduce((s, c) => s + c.agreement, 0) / consensus.length;
}

/** 把某个轴向值翻译成该方向的词，如 timing 的 -1 → 「宜守」 */
export function axisWord(axis: AxisId, dir: -1 | 0 | 1): string {
  const l = AXIS_LABELS[axis];
  if (dir > 0) return l.positive;
  if (dir < 0) return l.negative;
  return '持平';
}

/**
 * 跨层错位的读法。
 *
 * 命盘层与卜卦层拧巴，最常见也最有用的解释是：
 * **底色是一种倾向，当下是另一种窗口**。这既不是说哪层错了，
 * 也不是说「综合一下取中间」——取中间恰恰是最没信息量的读法。
 */
export function readCrossLayerGap(gap: CrossLayerGap): string {
  const cw = axisWord(gap.axis, gap.chartDir);
  const dw = axisWord(gap.axis, gap.divinationDir);
  if (gap.chartDir * gap.divinationDir < 0) {
    return `底色偏「${cw}」，当下这扇窗却偏「${dw}」——长期倾向与眼前时机相反，通常意味着可以做，但要给自己留退路，别按长期配置去押注短期。`;
  }
  return `两层同向但强度差得多（底色「${cw}」${gap.chartMean.toFixed(1)} vs 当下「${dw}」${gap.divinationMean.toFixed(1)}）：方向不冲突，分歧在力度，按更保守的那一层设安全边界更稳。`;
}
