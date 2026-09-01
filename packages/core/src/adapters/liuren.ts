import { generateLiuren } from 'mingyu-core/divination/liuren';
import type { Adapter } from './base.ts';
import { buildResult, divinationTime, toLocalDate, withInterpretation } from './base.ts';
import { interpretLiuren } from '../interpretation.ts';

/**
 * 大六壬。
 *
 * 已与 liuren-ts-lib（完全独立实现）对拍 7 组样本，
 * 三传 + 天将 + 课体 + 月将 全部一致（7/7）。是本平台可信度最高的体系之一。
 */
export const liurenAdapter: Adapter = (ctx) => {
  const result = generateLiuren(toLocalDate(divinationTime(ctx)));
  const { assertions, interpretation } = interpretLiuren(result, ctx);
  return withInterpretation(buildResult('liuren', ctx, {}, result), assertions, interpretation);
};
