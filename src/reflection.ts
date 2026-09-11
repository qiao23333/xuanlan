/**
 * 复盘回路（Reflection）—— 玄览的最后一屏。
 *
 * 为什么做这个：
 * 一个只出断言、永不被检验的系统，本质上是占卜玩具。玄览的立身之本是
 * 「内核严肃」，而严肃的最低要求就是**允许被证伪**。所以必须给用户一个
 * 回来说「你上次说错了」的地方，并且把这句话留下来。
 *
 * 为什么叫「复盘」不叫「准确率」：
 * 平台**不聚合、不上传、不宣称命中率**。这里统计的一切只对本人可见，
 * 样本通常是各位数，任何比例都不具备统计意义。UI 上必须原样说清这一点，
 * 而不是把 3/5 包装成「60% 准确率」。
 *
 * 设计取舍：
 * - 不做事后重算。断言是当时算出来的，复盘时只做「对照」，绝不用今天的
 *   算法去重新解释昨天的盘 —— 否则就变成了自我证成的循环。
 * - 不机械推导「某根轴准不准」。用户的应验判断是针对整件事的，把它拆到
 *   单轴上会制造虚假精度。所以只做「当时最强调什么 ↔ 后来你标了什么」
 *   的并列呈现，把结论留给人。
 */

// 刻意从 core-meta 取值：core-meta 不依赖 1.6MB 的内核，
// 若这里写 `import { AXIS_LABELS } from './core'` 会把算法拖进首屏。
import { AXIS_LABELS, type AxisId, type Consensus } from './core-meta';
import type { SavedReading } from './history';

/** 与内核 `Outcome.verdict` 同构，前端扩展了 dominant 字段 */
export type Verdict = 'hit' | 'miss' | 'partial' | 'unknown';

/** 复盘当时被最强调的那条判断，快照下来供日后回看 */
export interface DominantJudgement {
  axis: AxisId;
  /** +1 正方向 / −1 负方向 */
  dir: 1 | -1;
  /** 加权均值，范围 [-2, 2] */
  mean: number;
  /** 一致度 0..1 */
  agreement: number;
  /** 参与该轴的体系数 */
  sampleSize: number;
}

/** 存在 SavedReading 上的复盘记录 */
export interface StoredOutcome {
  verdict: Verdict;
  actualNote?: string;
  resolvedAt?: string;
  dominant?: DominantJudgement;
  /** 打标时距问事多少天，用于判断"事后来得及看" */
  daysAfter?: number;
}

export const VERDICT_META: Record<Verdict, { label: string; icon: string; hint: string; tone: string }> = {
  hit: { label: '应验了', icon: '✓', hint: '走向和当时的判断基本吻合', tone: 'ok' },
  partial: { label: '部分应验', icon: '◐', hint: '有一部分说中，有一部分偏了', tone: 'mid' },
  miss: { label: '没应验', icon: '✕', hint: '实际走向与当时判断相反或明显不符', tone: 'bad' },
  unknown: { label: '说不清', icon: '?', hint: '还没定论，或无法判断', tone: 'none' },
};

export const VERDICT_ORDER: Verdict[] = ['hit', 'partial', 'miss', 'unknown'];

/** 从共识里挑出「当时最强调的一条」：偏离 0 最远且有至少两家参与。 */
export function pickDominant(consensus: Consensus[]): DominantJudgement | null {
  const usable = consensus.filter((c) => c.sampleSize >= 2 && Math.abs(c.weightedMean) > 0.01);
  if (!usable.length) return null;
  let best = usable[0];
  for (const c of usable) {
    const better =
      Math.abs(c.weightedMean) > Math.abs(best.weightedMean) ||
      (Math.abs(c.weightedMean) === Math.abs(best.weightedMean) && c.agreement > best.agreement);
    if (better) best = c;
  }
  return {
    axis: best.axis,
    dir: best.weightedMean > 0 ? 1 : -1,
    mean: best.weightedMean,
    agreement: best.agreement,
    sampleSize: best.sampleSize,
  };
}

/** 把主导判断翻译成人话，如「宜守 · 6 家参与 · 一致度 62%」 */
export function dominantText(d?: DominantJudgement | null): string {
  if (!d) return '';
  const labels = AXIS_LABELS[d.axis];
  const word = d.dir > 0 ? labels.positive : labels.negative;
  return `${word} · ${d.sampleSize} 家参与 · 一致度 ${Math.round(d.agreement * 100)}%`;
}

export interface ReflectionStats {
  total: number;
  judged: number;
  counts: Record<Verdict, number>;
  /** 按主题的应验分布，按样本数降序 */
  byTopic: Array<{ topic: string; label: string; total: number; counts: Record<Verdict, number> }>;
  /** 已标定且带主导判断的对照条目，按复盘时间倒序 */
  pairs: Array<{ reading: SavedReading; outcome: StoredOutcome }>;
  /** 满 7 天仍未标定的记录，提醒用户回来看 */
  pending: SavedReading[];
}

const EMPTY_COUNTS = (): Record<Verdict, number> => ({ hit: 0, partial: 0, miss: 0, unknown: 0 });

/** 距今天数（不足 1 天算 0） */
export function daysSince(iso: string, now = Date.now()): number {
  const t = new Date(iso).getTime();
  if (isNaN(t)) return 0;
  return Math.floor((now - t) / 86400000);
}

/**
 * 汇总复盘数据。纯函数，不触碰 localStorage。
 * 样本量小是常态，因此这里刻意**不产出任何百分比结论**，只给原始计数。
 */
export function summarizeReflection(history: SavedReading[]): ReflectionStats {
  const counts = EMPTY_COUNTS();
  const topicMap = new Map<string, { total: number; counts: Record<Verdict, number> }>();
  const pairs: ReflectionStats['pairs'] = [];
  const pending: SavedReading[] = [];

  for (const r of history) {
    const o = r.outcome as StoredOutcome | undefined;
    if (!o?.verdict) {
      if (daysSince(r.savedAt) >= 7) pending.push(r);
      continue;
    }
    counts[o.verdict] += 1;
    const topic = r.question?.topicId ?? 'general';
    const key = topic;
    const slot = topicMap.get(key) ?? { total: 0, counts: EMPTY_COUNTS() };
    slot.total += 1;
    slot.counts[o.verdict] += 1;
    topicMap.set(key, slot);
    pairs.push({ reading: r, outcome: o });
  }

  pairs.sort((a, b) => (b.outcome.resolvedAt ?? '').localeCompare(a.outcome.resolvedAt ?? ''));

  const byTopic = Array.from(topicMap.entries()).map(([topic, v]) => ({
    topic,
    label: r2Label(topic),
    total: v.total,
    counts: v.counts,
  }));
  byTopic.sort((a, b) => b.total - a.total);

  return { total: history.length, judged: pairs.length, counts, byTopic, pairs, pending };
}

function r2Label(topic: string): string {
  const map: Record<string, string> = {
    general: '综合',
    career: '事业',
    romance: '感情',
    money: '财运',
    move: '出行/搬迁',
    study: '学业',
    health: '健康',
    relationship: '人际',
  };
  return map[topic] ?? topic;
}
