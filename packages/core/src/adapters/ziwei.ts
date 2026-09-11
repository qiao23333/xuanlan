import { buildAstrolabeFromInput, buildZiweiChartInput } from 'mingyu-core/ziwei/iztro';
import type { Adapter, Warning } from './base.ts';
import { buildResult, withInterpretation } from './base.ts';
import { interpretZiwei } from '../interpretation.ts';

/**
 * 紫微斗数（委托 iztro）。
 *
 * ── 为什么不用 calculateZiweiChart ──
 * 该函数默认会为 7 个运限范围（本命 / 大限 / 流年 / 流月 / 流日 / 流时 / 年龄）
 * 各构建一份分析 payload，实测单样本约 30 秒、产出 1.6 MB 数据。
 * 而本平台当前的解读层与渲染器只消费**本命盘**（`astrolabe.palaces`），
 * 那 7 份 payload 连同 horoscope、decadalTimeline 一个都没有消费方。
 *
 * 改为只调 buildAstrolabeFromInput（实测 ~40 ms、约 100 KB），
 * 排盘结果逐字段一致，只是不再为没人读的数据买单。
 * 若将来要做流年运势视图，再按需单独构建对应 scope——那时才需要为它付费。
 *
 * ── 快照可复现 ──
 * 本命盘完全由出生信息决定，不依赖任何「当前时间」，
 * 因此这里不存在 calculateZiweiChart 那种「不显式传 horoscopeContext
 * 就默认取当前时间」的快照漂移风险——从根上消除了该隐患。
 *
 * ── 流派口径 ──
 * 排盘层只有 default / zhongzhou 两档安星口径；四化飞星与自化
 * 底层库不支持，需自研，当前不开放开关。
 */
export const ziweiAdapter: Adapter = async (ctx) => {
  const algorithm = ctx.config.ziwei?.algorithm ?? 'default';

  // 已由 normalizeBirth 完成真太阳时修正，此处不再二次修正
  const input = buildZiweiChartInput({
    name: ctx.profile.name ?? '',
    gender: ctx.profile.gender === 'male' ? 'male' : 'female',
    dateType: ctx.profile.calendarType === 'lunar' ? 'lunar' : 'solar',
    year: ctx.profile.year,
    month: ctx.profile.month,
    day: ctx.profile.day,
    timeIndex: ctx.normalized.timeIndex,
    isLeapMonth: ctx.profile.isLeapMonth ?? false,
    birthHour: ctx.normalized.effectiveTime.hour,
    birthMinute: ctx.normalized.effectiveTime.minute,
    birthLongitude: ctx.normalized.resolvedLocation?.longitude,
    timezone: ctx.profile.location?.timezone,
    timeZoneId: ctx.profile.location?.timeZoneId,
    applyChinaDst: ctx.profile.applyChinaDst,
    algorithm,
  });

  const warnings: Warning[] = [];
  if (algorithm === 'zhongzhou') {
    warnings.push({
      level: 'info',
      code: 'ziwei.zhongzhou',
      message: '已切换中州派安星口径，星曜落宫可能与采用传统通行口径的平台不同。',
    });
  }

  const astrolabe = await buildAstrolabeFromInput(input);

  // 拿不到十二宫说明盘面残缺，必须显式告警而不是渲染出一张空表
  if (!astrolabe?.palaces?.length) {
    warnings.push({
      level: 'error',
      code: 'ziwei.emptyPalaces',
      message: '未取得十二宫数据，盘面可能不完整，请勿据此下判断。',
    });
  }

  // 顶层保留 astrolabe，让既有解读层与渲染器零改动
  const data = { astrolabe };

  const { assertions, interpretation } = interpretZiwei(data, ctx);
  return withInterpretation(buildResult('ziwei', ctx, { algorithm }, data, warnings), assertions, interpretation);
};
