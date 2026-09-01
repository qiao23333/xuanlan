import { drawTarotSpread } from 'mingyu-core/divination/tarot';
import type { Adapter, Warning } from './base.ts';
import { buildResult, extractRandomTrace, withInterpretation } from './base.ts';
import { interpretTarot } from '../interpretation.ts';

/**
 * 塔罗。
 *
 * 关于可复现，踩过一个必须记住的坑：
 * 底层库的随机参数字段是 `seed` / `random`（`rng` 已废弃），
 * **不存在 `randomSource`**。传错字段名时库不报错，而是静默回退到
 * Math.random()，结果里的 meta.random.mode 会变成 'system'。
 * 因此这里在抽牌后强制校验 mode，一旦不是 seeded 就告警 —— 不能假装可复现。
 *
 * 底层库自己的声明值得原样传达给用户：
 * 「seed 或 replay 只证明过程可重放，不证明预测有效性」。
 */

/** 无外部指定时的默认 seed，保证同配置下结果恒定 */
const DEFAULT_SEED = 20260831;

export const tarotAdapter: Adapter = (ctx) => {
  const seed = ctx.config.tarot?.seed ?? DEFAULT_SEED;
  const cfg = {
    spread: ctx.config.tarot?.spread ?? 'three',
    reversed: ctx.config.tarot?.reversed ?? true,
    seed,
  };

  const result = drawTarotSpread(cfg.spread, { seed });
  const randomTrace = extractRandomTrace(result);

  const warnings: Warning[] = [];
  // 关键校验：可复现不能靠信任，要靠验证
  if (!randomTrace || randomTrace.mode !== 'seeded') {
    warnings.push({
      level: 'error',
      code: 'tarot.notReproducible',
      message:
        `抽牌未能使用种子随机（实际 mode=${randomTrace?.mode ?? 'unknown'}），结果不可复现。` +
        `这通常是底层库参数名变更导致静默回退，必须修复。`,
    });
  }
  if (ctx.config.tarot?.seed === undefined) {
    warnings.push({
      level: 'info',
      code: 'tarot.defaultSeed',
      message:
        `未提供抽牌种子，已使用默认种子 ${DEFAULT_SEED}，同一配置下结果恒定。` +
        `抽牌的可复现只证明过程可重放，不证明预测有效性。`,
    });
  }

  const { assertions, interpretation } = interpretTarot(result, ctx);
  return withInterpretation(buildResult('tarot', ctx, cfg, result, warnings, randomTrace), assertions, interpretation);
};
