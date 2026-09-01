import { calculateBaziFromBirthProfile } from 'mingyu-core/profile';
import type { Adapter } from './base.ts';
import { buildResult, normalizeWarnings, withInterpretation } from './base.ts';
import { interpretBazi } from '../interpretation.ts';

/**
 * 四柱八字。
 *
 * 已与 lunar-typescript（6tail 独立实现）对拍 6 组，5 组一致。
 * 唯一差异：广州 2000-12-31 23:59，日柱 甲子 vs 癸亥 —— 早晚子时换日口径分歧，
 * 不是 bug，已固化为黄金用例并在 UI 上做成显式开关。
 */
export const baziAdapter: Adapter = (ctx) => {
  const cfg = {
    dayBoundary: ctx.config.bazi?.dayBoundary ?? 'zhengZi',
    yongshen: ctx.config.bazi?.yongshen ?? 'tiaohou',
  };

  const result = calculateBaziFromBirthProfile(ctx.profile);
  const warnings = normalizeWarnings((result as { warnings?: unknown }).warnings);

  // 早晚子时口径当前底层库不支持切换，显式告知，避免用户误以为已生效
  if (ctx.config.bazi?.dayBoundary) {
    warnings.push({
      level: 'warn',
      code: 'bazi.dayBoundaryNotSwitchable',
      message:
        '早晚子时换日口径底层库当前不支持切换，仍采用默认口径。' +
        '若在 23:00–01:00 出生，日柱可能与其他平台相差一位。',
    });
  }
  // 用神取法属于判读层，排盘不改变
  if (ctx.config.bazi?.yongshen) {
    warnings.push({
      level: 'info',
      code: 'bazi.yongshenIsInterpretation',
      message: '用神取法（调候/扶抑/通关）属于判读层，不影响四柱排盘结果。',
    });
  }

  const { assertions, interpretation } = interpretBazi(result, ctx);
  return withInterpretation(buildResult('bazi', ctx, cfg, result, warnings), assertions, interpretation);
};
