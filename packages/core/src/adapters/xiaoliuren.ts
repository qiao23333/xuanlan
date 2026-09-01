import { generateXiaoliuren } from 'mingyu-core/divination/xiaoliuren';
import type { Adapter } from './base.ts';
import { buildResult, divinationTime, toLocalDate, withInterpretation } from './base.ts';
import { interpretXiaoliuren } from '../interpretation.ts';

/**
 * 小六壬（诸葛马前课）。
 *
 * 注意底层库自己的口径声明：
 * 「作者及李淳风署名暂无可靠版本学证据」「闰月沿用同名月序；农历日按东八区
 * 民用日零点换日」——这类边界必须在科普层如实呈现，不能包装成千年传承。
 */
export const xiaoliurenAdapter: Adapter = (ctx) => {
  const result = generateXiaoliuren({ method: 'time', customDate: toLocalDate(divinationTime(ctx)) });
  const { assertions, interpretation } = interpretXiaoliuren(result, ctx);
  return withInterpretation(buildResult('xiaoliuren', ctx, { method: 'time' }, result), assertions, interpretation);
};
