import type {
  BirthProfile,
  NormalizedBirth,
  Question,
  RandomSource,
  SchoolConfig,
  ChartResult,
  SystemId,
  Warning,
  DateTimeParts,
  RandomTrace,
  Assertion,
  InterpretationData,
} from '../types.ts';
import { hashObject } from '../hash.ts';

/**
 * adapter 上下文：一切输入都在这里，没有任何隐式状态。
 *
 * 时间来自 profile/question，随机来自 random 参数。
 * adapter 内部禁止调用 Date.now() 或 Math.random()。
 */
export interface AdapterContext {
  profile: BirthProfile;
  normalized: NormalizedBirth;
  config: SchoolConfig;
  question?: Question;
  random?: RandomSource;
}

/**
 * 紫微（委托 iztro）是异步的，故统一允许返回 Promise，
 * 由 calculateAll 用 Promise.all 并发处理。
 */
export type Adapter<T = unknown> = (ctx: AdapterContext) => ChartResult<T> | Promise<ChartResult<T>>;

/** 底层库版本，写入每个结果的 engineVersion，是快照可溯源的关键 */
export const ENGINE_VERSION = 'mingyu-core@0.2.0+iztro@2.x';

/** 便于各 adapter 直接 `import type { Adapter, Warning } from './base.ts'` */
export type { Warning };

/**
 * 把断言与解读挂到结果上。
 * adapter 先 buildResult 拿到基础结果，再调本函数补充「解释层」。
 * 这样不破坏 buildResult 的既有签名。
 */
export function withInterpretation<T>(
  result: ChartResult<T>,
  assertions: Assertion[],
  interpretation?: InterpretationData
): ChartResult<T> {
  return {
    ...result,
    assertions,
    ...(interpretation ? { interpretation } : {}),
  };
}

/** 卜卦类体系的基准时刻：有问事时刻用问事时刻，否则用出生有效时刻 */
export function divinationTime(ctx: AdapterContext): DateTimeParts {
  return ctx.question?.askedAt ?? ctx.normalized.effectiveTime;
}

/**
 * 由 DateTimeParts 构造本地时区 Date。
 * 底层库按本地时区解读 Date，故此处必须一致，不能改用 Date.UTC。
 */
export function toLocalDate(t: DateTimeParts): Date {
  return new Date(t.year, t.month - 1, t.day, t.hour, t.minute, t.second ?? 0);
}

/** 把底层库返回的警告对象规整成统一 Warning 形状 */
export function normalizeWarnings(raw: unknown): Warning[] {
  if (!Array.isArray(raw)) return [];
  const out: Warning[] = [];
  for (const w of raw) {
    if (typeof w === 'string') {
      out.push({ level: 'warn', code: 'engine.warning', message: w });
    } else if (w && typeof w === 'object') {
      const o = w as Record<string, unknown>;
      out.push({
        level: (o.level as Warning['level']) ?? 'warn',
        code: String(o.code ?? o.type ?? 'engine.warning'),
        message: String(o.message ?? o.text ?? o.title ?? ''),
      });
    }
  }
  return out.filter((w) => w.message.length > 0);
}

/** 构造统一的 ChartResult，自动处理 engineVersion / configHash */
export function buildResult<T>(
  systemId: SystemId,
  ctx: AdapterContext,
  appliedConfig: Record<string, unknown>,
  data: T,
  extraWarnings: Warning[] = [],
  randomTrace?: RandomTrace
): ChartResult<T> {
  return {
    systemId,
    engineVersion: ENGINE_VERSION,
    configHash: hashObject({
      systemId,
      engineVersion: ENGINE_VERSION,
      normalized: ctx.normalized,
      topicId: ctx.question?.topicId ?? null,
      askedAt: ctx.question?.askedAt ?? null,
      config: appliedConfig,
    }),
    appliedConfig,
    warnings: [...extraWarnings],
    data,
    ...(randomTrace ? { randomTrace } : {}),
    // assertions 在阶段 3 由投影层填充，MVP 阶段为空数组
    assertions: [],
  };
}

/**
 * 从底层库结果中提取随机轨迹。
 *
 * 这是「可复现」的验证点：如果底层库返回 mode: 'system'，说明我们传的
 * 随机参数根本没生效（静默回退到 Math.random），必须立刻告警而不是假装可复现。
 */
export function extractRandomTrace(data: unknown): RandomTrace | undefined {
  const meta = (data as { meta?: { random?: { mode?: string; seed?: string | number; samples?: number[] } } })
    ?.meta?.random;
  if (!meta?.mode) return undefined;
  return {
    mode: meta.mode as RandomTrace['mode'],
    ...(meta.seed !== undefined ? { seed: meta.seed } : {}),
    samples: meta.samples ?? [],
  };
}
