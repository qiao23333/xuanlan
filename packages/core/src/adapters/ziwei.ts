import { buildZiweiChartInput, calculateZiweiChart } from 'mingyu-core/ziwei/runtime';
import type { Adapter, Warning } from './base.ts';
import { buildResult, withInterpretation } from './base.ts';
import { interpretZiwei } from '../interpretation.ts';

/**
 * 紫微斗数（委托 iztro）。
 *
 * 两个必须注意的点：
 * 1. 运限时刻必须显式传入 horoscopeContext，否则底层库默认取「当前时间」，
 *    同一份出生盘在不同日期会算出不同快照 —— 直接违反快照不可变原则。
 * 2. 排盘层只有 default / zhongzhou 两档安星口径；四化飞星与自化
 *    底层库不支持，需自研，当前不开放开关。
 */
export const ziweiAdapter: Adapter = async (ctx) => {
  const algorithm = ctx.config.ziwei?.algorithm ?? 'default';
  const t = ctx.question?.askedAt ?? ctx.normalized.effectiveTime;

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

  const result = await calculateZiweiChart(input, {
    horoscopeContext: {
      dateStr: `${t.year}-${String(t.month).padStart(2, '0')}-${String(t.day).padStart(2, '0')}`,
      hourIndex: ctx.normalized.timeIndex,
    },
  });

  const { assertions, interpretation } = interpretZiwei(result, ctx);
  return withInterpretation(buildResult('ziwei', ctx, { algorithm }, result, warnings), assertions, interpretation);
};
