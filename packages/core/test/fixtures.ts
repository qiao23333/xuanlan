/**
 * 黄金用例数据。
 *
 * 每一条都来自 2026-08-31 的实测输出，不是推算值。
 * 用途：
 * 1. 回归锁定 —— 库升级后跑一遍，任何变化都会暴露
 * 2. 对拍基准 —— 与独立实现比对，交叉验证正确性
 * 3. 分歧存档 —— knownDivergence 标记的是**真实流派分歧**，不是 bug，
 *    这类用例的价值在于提醒我们：这不是唯一答案
 */
import type { BirthProfile, ChartResult, DateTimeParts } from '../src/types.ts';

/**
 * 安全读取八字四柱。
 * tsconfig 开了 noUncheckedIndexedAccess，索引访问一律可能 undefined，
 * 这里集中处理，避免在测试里散落一堆非空断言。
 */
export function fourPillars(chart: ChartResult): [string, string, string, string] {
  const p = (chart.data as { pillars: Record<string, { ganZhi: string } | undefined> }).pillars;
  const g = (k: string) => p[k]?.ganZhi ?? '';
  return [g('year'), g('month'), g('day'), g('hour')];
}

/** 四柱期望值。全部为关闭真太阳时、公历输入下的实测结果 */
export interface BaziCase {
  tag: string;
  profile: BirthProfile;
  /** 期望四柱，顺序 [年, 月, 日, 时] */
  expected: [string, string, string, string];
  /** 与 lunar-typescript 不一致时，记录对方结果与原因 */
  knownDivergence?: { lunarTypescript: [string, string, string, string]; reason: string };
}

export const BAZI_GOLDEN: BaziCase[] = [
  {
    tag: '北京 1990-05-15 14:30',
    profile: mk(1990, 5, 15, 14, 30, 116.41, 39.9),
    expected: ['庚午', '辛巳', '庚辰', '癸未'],
  },
  {
    tag: '上海 1985-02-04 06:00（立春交界日）',
    profile: mk(1985, 2, 4, 6, 0, 121.47, 31.23),
    expected: ['乙丑', '戊寅', '甲戌', '丁卯'],
  },
  {
    tag: '广州 2000-12-31 23:59（早晚子时分歧）',
    profile: mk(2000, 12, 31, 23, 59, 113.26, 23.13),
    expected: ['庚辰', '戊子', '甲子', '甲子'],
    knownDivergence: {
      lunarTypescript: ['庚辰', '戊子', '癸亥', '甲子'],
      reason:
        '早晚子时换日口径不同：本平台按 23:00 起算次日（日柱甲子），' +
        'lunar-typescript 按 00:00 起算次日（日柱癸亥）。时柱两者相同，日柱相差一位。' +
        '这是真实流派分歧，UI 上应做成可切换开关并展示差异。',
    },
  },
  {
    tag: '新疆 1978-08-08 08:08',
    profile: mk(1978, 8, 8, 8, 8, 87.62, 43.82),
    expected: ['戊午', '庚申', '壬寅', '甲辰'],
  },
  {
    tag: '1995-01-30 10:00（农历乙亥年腊月三十）',
    profile: mk(1995, 1, 30, 10, 0, 116.41, 39.9),
    expected: ['甲戌', '丁丑', '辛酉', '癸巳'],
  },
  {
    tag: '2008-05-12 14:28（汶川）',
    profile: mk(2008, 5, 12, 14, 28, 103.0, 31.0),
    expected: ['戊子', '丁巳', '壬子', '丁未'],
  },
];

/** 大六壬三传期望值。已与 liuren-ts-lib 独立实现交叉验证，7/7 一致 */
export interface LiurenCase {
  tag: string;
  at: DateTimeParts;
  /** 期望三传，格式 "地支+天将" */
  expected: [string, string, string];
  /** 期望课体 */
  expectedRule: string;
  /** 期望月将 */
  expectedMonthLeader: string;
}

export const LIUREN_GOLDEN: LiurenCase[] = [
  {
    tag: '2026-08-31 12:00',
    at: at(2026, 8, 31, 12, 0),
    expected: ['子螣蛇', '亥贵人', '戌天后'],
    expectedRule: '重审法',
    expectedMonthLeader: '巳',
  },
  {
    tag: '1990-05-15 14:30',
    at: at(1990, 5, 15, 14, 30),
    expected: ['申白虎', '戌玄武', '子天后'],
    expectedRule: '涉害法',
    expectedMonthLeader: '酉',
  },
  {
    tag: '2000-01-01 00:10',
    at: at(2000, 1, 1, 0, 10),
    expected: ['寅青龙', '午螣蛇', '午螣蛇'],
    expectedRule: '别责法',
    expectedMonthLeader: '丑',
  },
  {
    tag: '1985-06-20 20:45',
    at: at(1985, 6, 20, 20, 45),
    expected: ['午螣蛇', '辰六合', '寅青龙'],
    expectedRule: '涉害法',
    expectedMonthLeader: '申',
  },
  {
    tag: '2024-02-04 16:30（立春日）',
    at: at(2024, 2, 4, 16, 30),
    expected: ['寅天后', '午白虎', '戌六合'],
    expectedRule: '元首法',
    expectedMonthLeader: '子',
  },
  {
    tag: '2010-11-11 11:11',
    at: at(2010, 11, 11, 11, 11),
    expected: ['丑螣蛇', '戌太阴', '未白虎'],
    expectedRule: '重审法',
    expectedMonthLeader: '卯',
  },
  {
    tag: '1978-03-08 22:15',
    at: at(1978, 3, 8, 22, 15),
    expected: ['巳六合', '申贵人', '寅天空'],
    expectedRule: '伏吟法',
    expectedMonthLeader: '亥',
  },
];

/**
 * 紫微本命盘黄金用例。
 *
 * 2026-09-04 实测（降载后）：本平台只消费本命盘（astrolabe.palaces），
 * 故只锁定「有人消费」的三个字段：
 * - 命宫地支：决定整盘排布的锚点，最具区分度
 * - 命宫主星（含亮度）：解读层判断格局与吉凶的输入
 * - 命宫大限起运：解读层定位「当前大限」的输入
 *
 * 「早子时」样本命宫无主星 —— 这是紫微的**空宫**现象（须借对宫安星），
 * 不是 bug，保留它正是为了让这条边界永远有回归保护。
 */
export interface ZiweiCase {
  tag: string;
  profile: BirthProfile;
  algorithm?: 'default' | 'zhongzhou';
  /** 命宫地支 */
  expectedMingBranch: string;
  /** 命宫主星，含亮度，如 '紫微(得)'。空数组 = 空宫 */
  expectedMingStars: string[];
  /** 命宫大限起运年龄段 */
  expectedMingDecadal: [number, number];
}

export const ZIWEI_GOLDEN: ZiweiCase[] = [
  {
    tag: '北京 1990-05-15 14:30',
    profile: mk(1990, 5, 15, 14, 30, 116.41, 39.9),
    expectedMingBranch: '戌',
    expectedMingStars: ['紫微(得)', '天相(得)'],
    expectedMingDecadal: [5, 14],
  },
  {
    tag: '上海 1988-02-04 03:20（女）',
    profile: { ...mk(1988, 2, 4, 3, 20, 121.47, 31.23), gender: 'female' },
    expectedMingBranch: '亥',
    expectedMingStars: ['武曲(平)', '破军(平)'],
    expectedMingDecadal: [4, 13],
  },
  {
    tag: '广州 2000-12-31 23:59（早子时·空宫）',
    profile: mk(2000, 12, 31, 23, 59, 113.26, 23.13),
    expectedMingBranch: '丑',
    expectedMingStars: [],
    expectedMingDecadal: [6, 15],
  },
  {
    tag: '1995-闰八月-初十 午时（农历闰月·女）',
    profile: {
      ...mk(1995, 8, 10, 12, 0, 116.41, 39.9),
      gender: 'female',
      calendarType: 'lunar',
      isLeapMonth: true,
    },
    expectedMingBranch: '卯',
    expectedMingStars: ['紫微(旺)', '贪狼(利)'],
    expectedMingDecadal: [5, 14],
  },
  {
    tag: '乌鲁木齐 1985-06-20 22:10（西部经度）',
    profile: mk(1985, 6, 20, 22, 10, 87.6, 43.8),
    expectedMingBranch: '未',
    expectedMingStars: ['天梁(旺)'],
    expectedMingDecadal: [3, 12],
  },
  {
    tag: '1972-11-08 09:45（中州派·女）',
    profile: { ...mk(1972, 11, 8, 9, 45, 116.41, 39.9), gender: 'female' },
    algorithm: 'zhongzhou',
    expectedMingBranch: '午',
    expectedMingStars: ['廉贞(平)', '天相(庙)'],
    expectedMingDecadal: [2, 11],
  },
];

/** 真太阳时边界：乌鲁木齐 23:30 应回退到 21:24:14 */
export const TRUE_SOLAR_CASE = {
  profile: mk(1990, 5, 15, 23, 30, 87.62, 43.82, true),
  expectedEffective: { year: 1990, month: 5, day: 15, hour: 21, minute: 24, second: 14 },
  expectedOffsetSeconds: -(2 * 3600 + 5 * 60 + 46),
};

/** 中国夏令时：1988-04-17 00:30 该时段钟表时间不存在 */
export const CHINA_DST_CASE = {
  profile: { ...mk(1988, 4, 17, 0, 30, 116.41, 39.9), applyChinaDst: true },
};

/** 极区：Placidus 在纬度 78.2° 失效 */
export const POLAR_CASE = {
  profile: { ...mk(1990, 5, 15, 14, 30, 15.0, 78.2, false, 1) },
};

// ───────────────────────────── 构造辅助 ─────────────────────────────

function mk(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  longitude: number,
  latitude: number,
  useTrueSolarTime = false,
  timezone = 8
): BirthProfile {
  return {
    name: 'golden',
    gender: 'male',
    calendarType: 'solar',
    year,
    month,
    day,
    hour,
    minute,
    useTrueSolarTime,
    location: { name: 'golden', longitude, latitude, timezone },
  };
}

function at(year: number, month: number, day: number, hour: number, minute: number): DateTimeParts {
  return { year, month, day, hour, minute, second: 0 };
}
