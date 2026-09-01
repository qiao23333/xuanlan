import type { BirthProfile, ChartResult, Question, RandomSource, SchoolConfig, SystemId, Warning } from '../types.ts';
import { normalizeBirth } from '../profile.ts';
import type { NormalizedBirth } from '../types.ts';
import type { Adapter, AdapterContext } from './base.ts';
import { baziAdapter } from './bazi.ts';
import { ziweiAdapter } from './ziwei.ts';
import { qimenAdapter } from './qimen.ts';
import { liurenAdapter } from './liuren.ts';
import { xiaoliurenAdapter } from './xiaoliuren.ts';
import { meihuaAdapter } from './meihua.ts';
import { astrolabeAdapter } from './astrolabe.ts';
import { tarotAdapter } from './tarot.ts';

export const ADAPTERS: Record<SystemId, Adapter> = {
  bazi: baziAdapter,
  ziwei: ziweiAdapter,
  qimen: qimenAdapter,
  liuren: liurenAdapter,
  xiaoliuren: xiaoliurenAdapter,
  meihua: meihuaAdapter,
  astrolabe: astrolabeAdapter,
  tarot: tarotAdapter,
};

export const ALL_SYSTEMS: readonly SystemId[] = [
  'bazi',
  'ziwei',
  'qimen',
  'liuren',
  'xiaoliuren',
  'meihua',
  'astrolabe',
  'tarot',
] as const;

export interface CalculateOptions {
  /** 要算的体系，默认全部 */
  systems?: SystemId[];
  config?: SchoolConfig;
  question?: Question;
  random?: RandomSource;
}

export interface CalculateResult {
  normalized: NormalizedBirth;
  /** 输入归一化阶段的全局警告（真太阳时、子时、夏令时、极区…） */
  warnings: Warning[];
  charts: ChartResult[];
  /** 单体系失败不拖垮整体，失败原因如实回传 */
  failed: Array<{ systemId: SystemId; message: string }>;
}

/**
 * 一次输入，多体系并排 —— 本产品的核心入口。
 *
 * 设计要点：
 * 1. 时间归一化只做一次，所有体系共用同一个基准；
 * 2. 并发执行，单体系抛错只进 failed，不影响其他体系出结果；
 * 3. 顺序按 ALL_SYSTEMS 固定，保证输出可预测（不因并发完成顺序而变）。
 */
export async function calculateAll(
  profile: BirthProfile,
  options: CalculateOptions = {}
): Promise<CalculateResult> {
  const { normalized, warnings } = normalizeBirth(profile);
  const requested = options.systems ?? ALL_SYSTEMS;

  const ctx: AdapterContext = {
    profile,
    normalized,
    config: options.config ?? {},
    question: options.question,
    random: options.random,
  };

  const entries = await Promise.all(
    requested.map(async (id) => {
      const adapter = ADAPTERS[id];
      if (!adapter) return { id, ok: false as const, message: `未知体系: ${id}` };
      try {
        return { id, ok: true as const, chart: await adapter(ctx) };
      } catch (e) {
        return { id, ok: false as const, message: e instanceof Error ? e.message : String(e) };
      }
    })
  );

  const charts: ChartResult[] = [];
  const failed: CalculateResult['failed'] = [];
  // 按 ALL_SYSTEMS 顺序重排，保证输出顺序稳定
  for (const id of requested) {
    const r = entries.find((e) => e.id === id);
    if (!r) continue;
    if (r.ok) charts.push(r.chart);
    else failed.push({ systemId: id, message: r.message });
  }

  return { normalized, warnings, charts, failed };
}

export { baziAdapter, ziweiAdapter, qimenAdapter, liurenAdapter, xiaoliurenAdapter, meihuaAdapter, astrolabeAdapter, tarotAdapter };
export type { Adapter, AdapterContext };
export { ENGINE_VERSION } from './base.ts';
