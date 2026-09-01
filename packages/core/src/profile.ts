import { normalizeBirthProfile } from 'mingyu-core/profile';
import type { BirthProfile, NormalizedBirth, Warning, DateTimeParts } from './types.ts';

/**
 * 出生档案无效时抛出。
 *
 * 与「单体系计算失败」区分开：档案无效意味着所有体系都算不了，
 * 不该走 fail-soft 让其他体系硬算，而应明确拒绝并转成 API 400。
 */
export class InvalidBirthProfileError extends Error {
  override readonly name = 'InvalidBirthProfileError';
  /** 缺失的字段，便于前端精确定位表单项 */
  readonly fields: string[];

  constructor(message: string, fields: string[] = []) {
    super(message);
    this.fields = fields;
  }
}

/**
 * 出生档案归一化。
 *
 * 这是所有体系的唯一时间基准：真太阳时、夏令时、跨日、时辰索引
 * 都在这里一次性处理完，下游 adapter 不再各自换算，避免同一份档案
 * 在不同体系算出不同时间。
 *
 * 除底层库返回的警告外，内核还会补充自检警告。理由：
 * 「真太阳时导致结果与别家平台不同」是本产品最容易收到投诉的点，
 * 必须提前说明，而不是等用户来质疑。
 */

/** Placidus 分宫制在极圈内数学上失效的纬度阈值 */
export const PLACIDUS_LATITUDE_LIMIT = 66.5;

export interface NormalizeResult {
  normalized: NormalizedBirth;
  warnings: Warning[];
}

export function normalizeBirth(profile: BirthProfile): NormalizeResult {
  const warnings: Warning[] = [];
  let n;
  try {
    n = normalizeBirthProfile(profile);
  } catch (e) {
    // 底层库对无效档案抛的错误是产品级文案，直接透传并补上结构化类型
    throw new InvalidBirthProfileError(
      e instanceof Error ? e.message : String(e),
      guessMissingFields(profile)
    );
  }

  const clockTime = toParts(n.solarClockTime);
  const effectiveTime = toParts(n.effectiveTime);

  const normalized: NormalizedBirth = {
    clockTime,
    effectiveTime,
    timeIndex: n.timeIndex,
    timeInputMode: n.timeInputMode,
    trueSolarOffsetSeconds: diffSeconds(effectiveTime, clockTime),
    resolvedLocation: n.resolvedLocation
      ? {
          name: n.resolvedLocation.name,
          longitude: n.resolvedLocation.longitude,
          latitude: n.resolvedLocation.latitude,
          timezone: n.resolvedLocation.timezone,
          coordinateAccuracy: n.resolvedLocation.coordinateAccuracy,
        }
      : undefined,
  };

  // ── 底层库的警告，原样提升 ──
  for (const d of n.diagnostics ?? []) {
    warnings.push({
      level: 'warn',
      code: `profile.${d.code}`,
      message: d.message,
    });
  }

  // ── 内核自检 ──

  // 真太阳时：最需要提前说清的一条
  if (profile.useTrueSolarTime) {
    const off = normalized.trueSolarOffsetSeconds;
    const sign = off >= 0 ? '+' : '−';
    warnings.push({
      level: 'info',
      code: 'profile.trueSolarEnabled',
      message:
        `已启用真太阳时，排盘时刻由 ${fmt(clockTime)} 修正为 ${fmt(effectiveTime)}（${sign}${fmtDuration(Math.abs(off))}）。` +
        `多数在线排盘平台不启用真太阳时，若结果与其不同，通常源于此处而非算错。`,
    });
    // 跨日是最容易造成「日柱不对」的情况
    if (effectiveTime.day !== clockTime.day) {
      warnings.push({
        level: 'warn',
        code: 'profile.trueSolarDateShift',
        message:
          `真太阳时修正导致日期跨日（${clockTime.month}月${clockTime.day}日 → ${effectiveTime.month}月${effectiveTime.day}日），` +
          `日柱与时柱都会随之改变。`,
      });
    }
  }

  // 子时换日：实测广州 2000-12-31 23:59 在两种口径下日柱差一位
  const h = effectiveTime.hour;
  if (h === 23 || h === 0) {
    warnings.push({
      level: 'warn',
      code: 'profile.ziShiBoundary',
      message:
        `出生时刻落在子时（23:00–01:00），存在「早子时 / 晚子时」两种换日口径，` +
        `不同平台日柱可能相差一位。本平台采用 ${profile.location ? '底层库默认口径' : '底层库默认口径'}，` +
        `可在流派设置中切换后对比。`,
    });
  }

  // 夏令时
  if (profile.applyChinaDst) {
    warnings.push({
      level: 'warn',
      code: 'profile.chinaDst',
      message:
        '已启用中国夏令时校正（1986–1991）。该时段钟表时间比北京标准时间快 1 小时，时辰可能需前移。',
    });
  }

  // 极区：Placidus 失效
  const lat = normalized.resolvedLocation?.latitude ?? profile.location?.latitude;
  if (typeof lat === 'number' && Math.abs(lat) > PLACIDUS_LATITUDE_LIMIT) {
    warnings.push({
      level: 'error',
      code: 'profile.placidusPolarFailure',
      message:
        `出生地纬度 ${lat.toFixed(2)}° 超出极圈（±${PLACIDUS_LATITUDE_LIMIT}°），` +
        `Placidus 分宫制在此数学上失效。星盘宫位结果不可靠，应改用整宫制（Whole Sign）。`,
    });
  }

  // 缺少精准出生时间
  if (normalized.timeInputMode === 'traditional-shichen') {
    warnings.push({
      level: 'info',
      code: 'profile.shichenOnly',
      message:
        '仅提供传统时辰（未提供精准时分），时柱按时辰推算。同一时辰内出生的所有人在本平台结果相同。',
    });
  }

  // 缺少出生地
  if (!profile.location && !profile.useTrueSolarTime) {
    warnings.push({
      level: 'info',
      code: 'profile.noLocation',
      message: '未提供出生地，真太阳时与星盘宫位无法计算，按标准时间处理。',
    });
  }

  return { normalized, warnings };
}

// ───────────────────────────── 工具 ─────────────────────────────

/** 从档案里猜缺失字段，用于前端表单定位 */
function guessMissingFields(profile: BirthProfile): string[] {
  const missing: string[] = [];
  if (!profile.gender) missing.push('gender');
  if (!profile.year || !profile.month || !profile.day) missing.push('year|month|day');
  const hasPrecise = typeof profile.hour === 'number' && typeof profile.minute === 'number';
  const hasShichen = typeof profile.timeIndex === 'number';
  if (!hasPrecise && !hasShichen) missing.push('hour|minute|timeIndex');
  return missing;
}

function toParts(v: {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second?: number;
}): DateTimeParts {
  return {
    year: v.year,
    month: v.month,
    day: v.day,
    hour: v.hour,
    minute: v.minute,
    second: v.second ?? 0,
  };
}

/** 用 UTC 毫秒差计算秒偏移，避开时区与夏令时干扰 */
function diffSeconds(a: DateTimeParts, b: DateTimeParts): number {
  const ms =
    (Date.UTC(a.year, a.month - 1, a.day, a.hour, a.minute, a.second) -
      Date.UTC(b.year, b.month - 1, b.day, b.hour, b.minute, b.second)) /
    1000;
  return Math.round(ms);
}

function fmt(t: DateTimeParts): string {
  return `${t.year}-${pad(t.month)}-${pad(t.day)} ${pad(t.hour)}:${pad(t.minute)}`;
}

function fmtDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}分${s}秒` : `${s}秒`;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}
