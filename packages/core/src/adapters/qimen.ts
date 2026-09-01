import { generateQimen } from 'mingyu-core/divination/qimen';
import type { Adapter, Warning } from './base.ts';
import { buildResult, divinationTime, toLocalDate, withInterpretation } from './base.ts';
import { interpretQimen } from '../interpretation.ts';

/**
 * 奇门遁甲。
 *
 * 实测确认底层库同时支持：
 * - method:   转盘 'zhuanpan' / 飞盘 'feipan'
 * - juMethod: 拆补 'chaibu' / 置闰 'zhirun'
 *
 * 定局法是奇门最大的流派分歧点（还有未实现的茅山道人法），
 * 因此这里的四档组合正是「流派 diff 视图」的最佳演示素材。
 */
export const qimenAdapter: Adapter = (ctx) => {
  const cfg = {
    method: ctx.config.qimen?.method ?? 'zhuanpan',
    juMethod: ctx.config.qimen?.juMethod ?? 'chaibu',
    scope: ctx.config.qimen?.scope ?? 'hour',
  };

  const result = generateQimen(toLocalDate(divinationTime(ctx)), cfg.method, cfg.scope, cfg.juMethod);

  const warnings: Warning[] = [];
  if (cfg.juMethod === 'zhirun') {
    warnings.push({
      level: 'info',
      code: 'qimen.zhirun',
      message: '已采用置闰法定局，与采用拆补法的平台在大雪/冬至前后可能定局不同。',
    });
  }
  if (cfg.method === 'feipan') {
    warnings.push({
      level: 'info',
      code: 'qimen.feipan',
      message: '已采用飞盘排法，与更常见的转盘排法星门神落宫不同。',
    });
  }

  const { assertions, interpretation } = interpretQimen(result, ctx);
  return withInterpretation(buildResult('qimen', ctx, cfg, result, warnings), assertions, interpretation);
};
