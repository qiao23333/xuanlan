import { birthProfileToAstrolabeInput } from 'mingyu-core/profile';
import { generateAstrolabe } from 'mingyu-core/divination/astrolabe';
import type { Adapter, Warning } from './base.ts';
import { buildResult, withInterpretation } from './base.ts';
import { interpretAstrolabe } from '../interpretation.ts';

/**
 * 西方本命占星。
 *
 * 已知限制（实测确认，非推测）：
 * 底层库硬编码 Placidus 分宫制，源码中 houseSystem 为常量，无切换参数。
 * 而分宫制恰恰是占星最核心的流派分歧点（Placidus / Whole Sign / Koch）。
 * 因此 MVP 阶段不提供切换，但必须显著标注，避免用户以为这就是唯一算法。
 *
 * 另有：极圈（纬度 > 66.5°）内 Placidus 数学上失效，底层库不报错也不降级，
 * 由内核在 normalizeBirth 阶段补 warning（profile.placidusPolarFailure）。
 */
export const astrolabeAdapter: Adapter = (ctx) => {
  const cfg = {
    houses: 'placidus',
    zodiac: ctx.config.astro?.zodiac ?? 'tropical',
  };

  // 已由 normalizeBirth 完成真太阳时修正，此处关闭底层二次修正
  const input = birthProfileToAstrolabeInput({ ...ctx.profile, useTrueSolarTime: false });
  const result = generateAstrolabe(input);

  const warnings: Warning[] = [];
  if (ctx.config.astro?.houses && ctx.config.astro.houses !== 'placidus') {
    warnings.push({
      level: 'warn',
      code: 'astrolabe.houseSystemNotSwitchable',
      message: '分宫制当前底层库不支持切换，仍采用 Placidus。整宫制（Whole Sign）等档位将在二期提供。',
    });
  }
  warnings.push({
    level: 'info',
    code: 'astrolabe.placidus',
    message: '本平台采用 Placidus 分宫制。采用其他分宫制的平台，行星落宫可能与此处不同。',
  });

  const { assertions, interpretation } = interpretAstrolabe(result, ctx);
  return withInterpretation(buildResult('astrolabe', ctx, cfg, result, warnings), assertions, interpretation);
};
