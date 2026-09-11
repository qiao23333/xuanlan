import type { AxisId, CalculateResult, Consensus, SystemId } from './core';
import { SYSTEM_META } from './core';
import { AXIS_LABELS } from './core-meta';
import { ACCENTS, SIGILS, GLYPHS } from './systemIdentity';

export function leanColor(lean: number): string {
  if (lean > 0.3) return 'var(--jade)';
  if (lean < -0.3) return 'var(--red)';
  return 'var(--gold)';
}

export interface AdvisorAssertion {
  axis: AxisId;
  score: number;
  evidence: string[];
}

export interface Advisor {
  systemId: SystemId;
  name: string;
  /** 单字（canvas 导出等场合用） */
  glyph: string;
  /** 0 0 24 24 视图内的 SVG 席纹内部标记 */
  sigil: string;
  /** 该体系专属 accent 色 */
  accent: string;
  lean: number;
  isOutlier: boolean;
  assertions: AdvisorAssertion[];
}

/**
 * 把抽象的「加权均值 ±方向」翻译成人话。
 * 用户原话：「整体中性吉凶」我看不懂——判词要给得出「这意味着什么」。
 */
const AXIS_MEANING: Record<AxisId, { pos: string; neg: string; mid: string }> = {
  action: {
    pos: '倾向主动作为——该出手时就出手，宜推进、开创。',
    neg: '倾向按兵不动——宜守不宜攻，静观其变更稳。',
    mid: '动静之间尚无定论，可攻可守、视机而动。',
  },
  timing: {
    pos: '时机在「进」——适合推进、签约、落地。',
    neg: '时机在「守」——适合沉淀、等待、暂缓决策。',
    mid: '进守相当，节奏由你把握。',
  },
  social: {
    pos: '宜借力结盟——合作、求人、抱团更有利。',
    neg: '宜独处自处——少搅人际、独立判断更清。',
    mid: '人际无强烈倾向，随缘即可。',
  },
  risk: {
    pos: '可适度进取——机会值得搏一把。',
    neg: '宜避险守成——别冒无谓风险。',
    mid: '攻守平衡，量力而行。',
  },
  change: {
    pos: '宜求变——换赛道、破旧局更有生机。',
    neg: '宜守常——维持现状、微调更稳。',
    mid: '变与守皆可，不必强求。',
  },
  auspicious: {
    pos: '整体气象偏吉——顺。',
    neg: '整体气象偏凶——谨慎。',
    mid: '吉凶参半，平常心。',
  },
};

export function humanAxisMeaning(axis: AxisId, score: number): string {
  const m = AXIS_MEANING[axis];
  if (score > 0.3) return m.pos;
  if (score < -0.3) return m.neg;
  return m.mid;
}

/** 顾问整体倾向的人话表述（替代「整体偏吉 / 动」这类黑话）。 */
export function humanLean(lean: number): string {
  if (lean > 0.3) return '整体倾向积极 · 偏吉、宜行动';
  if (lean < -0.3) return '整体倾向保守 · 偏凶、宜静守';
  return '整体倾向中性 · 动静相参';
}

/**
 * 把内核结果投影为「八位顾问」的可视化数据。
 * 顾问整体倾向 = 各断言按置信度加权的均值；分歧徽章来自共识层的 outliers。
 * AdvisoryCouncil 与 DissentView 共用，避免两处映射分叉。
 */
export function buildAdvisors(result: CalculateResult, consensus: Consensus[]): Advisor[] {
  const outliers = new Set<string>();
  for (const c of consensus) for (const o of c.outliers) outliers.add(o.systemId);
  return result.charts.map((c) => {
    const a = c.assertions ?? [];
    const w = a.reduce((s, x) => s + x.confidence, 0) || 1;
    const lean = a.reduce((s, x) => s + x.score * x.confidence, 0) / w;
    const id = c.systemId as SystemId;
    const meta = SYSTEM_META[id];
    return {
      systemId: id,
      name: meta?.name ?? id,
      glyph: GLYPHS[id] ?? '?',
      sigil: SIGILS[id] ?? '',
      accent: ACCENTS[id] ?? 'var(--gold)',
      lean,
      isOutlier: outliers.has(c.systemId),
      assertions: a.map((x) => ({ axis: x.axis, score: x.score, evidence: x.evidence })),
    };
  });
}
