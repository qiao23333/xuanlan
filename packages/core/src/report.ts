/**
 * 玄览 · 综合解读报告（确定性，不依赖 AI）
 *
 * 这是「给出结果之后加解释」的聚合层：
 * - 共识度仪表盘负责「各维度一致不一致」
 * - 每张卡的解读负责「这一体系自己说什么」
 * - 本报告负责「把八家的话翻译成人能一口气读完的叙事」
 *
 * 全部由结构化数据模板化生成，零随机、零网络、零 AI——可复现、可快照、可测试。
 * 文案刻意保持诚实边界：只说「体系们倾向什么」，不替用户下人生决定。
 */

import type { AxisId, Consensus, SystemId, TopicId } from './types.ts';
import { AXIS_LABELS } from './types.ts';
import { SYSTEM_META } from './registry.ts';
import type { CalculateResult } from './adapters/index.ts';

export interface SynthesisByAxis {
  axis: AxisId;
  direction: 'positive' | 'negative' | 'neutral';
  agreement: number;
  sampleSize: number;
  text: string;
  outliers: SystemId[];
}

export interface SynthesisPerSystem {
  systemId: SystemId;
  name: string;
  points: string[];
}

export interface SynthesisReport {
  headline: string;
  overall: number;
  byAxis: SynthesisByAxis[];
  perSystem: SynthesisPerSystem[];
  caveats: string[];
  topic?: TopicId;
  /** 用户实际问出的问题文本（若有），前端会作为引文展示 */
  question?: string;
  /** 哪些体系随「此问/此刻」变化、哪些是固定的——消除「怎么没变」的困惑 */
  sensitivityNote?: string;
}

type Dir = 'positive' | 'negative' | 'neutral';

const dirOf = (m: number): Dir => (m > 0.3 ? 'positive' : m < -0.3 ? 'negative' : 'neutral');

const DIR_PHRASE: Record<Dir, string> = {
  positive: '整体偏积极',
  negative: '整体偏谨慎',
  neutral: '态度中性',
};

const sysName = (id: SystemId): string => SYSTEM_META[id]?.name ?? id;

/**
 * 生成综合解读报告。
 * @param result 全套排盘结果（含各体系 interpretation）
 * @param consensus aggregateConsensus 的输出
 * @param opts.topic 问事主题（前端展示「关于 X 的综合解读」）
 * @param opts.question 用户实际问出的问题文本（卜卦类体系会据此起局）
 */
export function synthesizeReport(
  result: CalculateResult,
  consensus: Consensus[],
  opts?: { topic?: TopicId; question?: string }
): SynthesisReport {
  const topic = opts?.topic;
  const question = opts?.question?.trim();
  const overall = consensus.length
    ? consensus.reduce((s, c) => s + c.agreement, 0) / consensus.length
    : 0;
  const pct = Math.round(overall * 100);

  const headline =
    overall >= 0.75
      ? `八大体系在 ${consensus.length} 个维度上高度一致（总体共识 ${pct}%）。结论有一定参考价值，但请记住：这只是文化体验，不是预测。`
      : overall >= 0.5
      ? `体系间总体共识 ${pct}%。多数维度有主调，但仍存在分歧，建议结合自身判断阅读，勿照单全收。`
      : `体系间分歧明显（总体共识 ${pct}%）。不同体系给出相反信号，请勿据此做任何重大决定。`;

  // 时间与问题敏感度说明：卜卦类体系随「此问/此刻」变化，命盘类固定
  const sensitivityNote = question
    ? '你的问题与起卦时刻已注入卜卦类体系（梅花易数、奇门、六壬、小六壬、塔罗）的起局——同一个人在不同时刻、问不同事，这些卦象会自然不同。而八字、紫微、西洋占星属于「命盘类」，由出生信息决定，不随你此刻的问题改变，这是刻意的设计：命盘看长期趋势，卜卦看当下信号。'
    : '本次未填写具体问题，卜卦类体系（梅花、奇门、六壬、小六壬、塔罗）按当前时刻起局；填写问题后，同一时刻不同问题也会得到不同卦象。八字、紫微、西洋占星为命盘类，由出生信息固定，不随问题变化。';

  const byAxis: SynthesisByAxis[] = consensus.map((c) => {
    const lab = AXIS_LABELS[c.axis];
    const d = dirOf(c.weightedMean);
    const outlierNames = c.outliers.map((o) => sysName(o.systemId));
    const outlierText = outlierNames.length ? `（分歧：${outlierNames.join('、')} 持相反看法）` : '';
    const text =
      `「${lab.positive} ↔ ${lab.negative}」：${c.sampleSize} 个体系表态，` +
      `${Math.round(c.agreement * 100)}% 一致，${DIR_PHRASE[d]}${outlierText}。`;
    return {
      axis: c.axis,
      direction: d,
      agreement: c.agreement,
      sampleSize: c.sampleSize,
      text,
      outliers: c.outliers.map((o) => o.systemId),
    };
  });

  const perSystem: SynthesisPerSystem[] = result.charts
    .filter((c) => c.interpretation && c.interpretation.highlights.length > 0)
    .map((c) => ({
      systemId: c.systemId,
      name: sysName(c.systemId),
      points: c.interpretation!.highlights.slice(0, 3).map((h) => `${h.label}：${h.value}`),
    }));

  const caveats: string[] = [
    '以上为各体系按古籍规则的确定性计算结果，不是概率预测，其有效性在科学上尚无共识。',
    '命盘类（八字、紫微、西洋占星）反映长期趋势；卜卦类（六壬、奇门、梅花、小六壬、塔罗）针对你此问的当下信号——两者性质不同，勿混为一谈。',
    '涉及人生、医疗、法律、财务的决定，请咨询持证专业人士。',
  ];

  return { headline, overall, byAxis, perSystem, caveats, topic, question, sensitivityNote };
}
