/**
 * 轻量元信息层 —— 刻意不依赖内核（@core / mingyu-core / iztro）。
 *
 * 为什么要单独存在：
 * ConsensusDashboard 这类「展示组件」只需要两样东西：
 * 轴的标签常量 AXIS_LABELS，和一个算总体共识度的纯函数 overallAgreement。
 * 这俩都是「纯数据 + 纯函数」，跟 1.6MB 的算法内核毫无关系。
 * 但如果它们躺在内核里，任何组件只要 `import { AXIS_LABELS } from './core'`，
 * 就会把整包算法拖进首屏 —— 哪怕这个页面只是想显示「宜动 ↔ 宜静」几个字。
 *
 * 所以这里放一份前端展示用的副本。内核（packages/core/src/types.ts、
 * consensus.ts）仍是权威源；若内核调整了轴定义，记得同步此处。
 *
 * 注意：本文件只以「类型」形式引用 './core'（import type，编译期抹除，
 * 不产生运行时依赖），因此不会把内核拉进任何静态引用它的模块。
 */
import type { AxisId, Consensus, TopicId } from './core';

export const AXIS_LABELS: Record<AxisId, { positive: string; negative: string }> = {
  action: { positive: '宜动', negative: '宜静' },
  timing: { positive: '宜进', negative: '宜守' },
  social: { positive: '结盟', negative: '独处' },
  risk: { positive: '进取', negative: '避险' },
  change: { positive: '求变', negative: '守常' },
  auspicious: { positive: '吉', negative: '凶' },
};

/**
 * 总体共识度：所有轴共识度的平均值，0..1。
 * 给结果墙顶部一个总览徽章用。纯函数，无副作用。
 */
export function overallAgreement(consensus: Consensus[]): number {
  if (consensus.length === 0) return 0;
  return consensus.reduce((s, c) => s + c.agreement, 0) / consensus.length;
}

export type { AxisId, Consensus, TopicId };
