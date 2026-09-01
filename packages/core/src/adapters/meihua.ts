import { generateMeihua } from 'mingyu-core/divination/meihua';
import type { Adapter, Warning } from './base.ts';
import { buildResult, divinationTime, toLocalDate, withInterpretation } from './base.ts';
import { interpretMeihua } from '../interpretation.ts';

/**
 * 梅花易数。
 *
 * number / random 两种起卦法需要外部数字，当前未提供输入通道，
 * 故 MVP 只开放 time（时间卦）。缺输入时明确降级而不是静默改用时间卦。
 */
export const meihuaAdapter: Adapter = (ctx) => {
  const method = ctx.config.meihua?.method ?? 'time';
  const warnings: Warning[] = [];

  if (method !== 'time') {
    warnings.push({
      level: 'warn',
      code: 'meihua.methodNotAvailable',
      message: `起卦法「${method}」需要外部输入数字，当前未提供输入通道，已降级为时间卦。`,
    });
  }

  const result = generateMeihua(toLocalDate(divinationTime(ctx)), { method: 'time' });
  const { assertions, interpretation } = interpretMeihua(result, ctx);
  return withInterpretation(buildResult('meihua', ctx, { method: 'time' }, result, warnings), assertions, interpretation);
};
