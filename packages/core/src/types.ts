/**
 * 玄览 · 核心协议层
 *
 * 设计原则（不可违反）：
 * 1. 本包是纯函数层：无 IO、无网络、无 Date.now()、无 Math.random()。
 *    时间与随机都必须由调用方以参数注入，否则测试不可复现、快照不可复盘。
 * 2. 排盘结果 100% 由确定性代码计算，AI 永远不参与计算，只在下游做解读。
 * 3. 每个结果必须携带「它是怎么算出来的」——engineVersion / appliedConfig / warnings，
 *    因为流派分歧是本产品的核心卖点，而不是需要藏起来的瑕疵。
 */

// ─────────────────────────────── 输入层 ───────────────────────────────

/** 出生地。经纬度用于真太阳时与星盘；regionId 可由 mingyu-core/location 补全。 */
export interface BirthLocation {
  /** 中国行政区代码，提供后可自动补全名称与坐标 */
  regionId?: string;
  name?: string;
  longitude?: number;
  latitude?: number;
  /** 当地标准时区偏移，中国为 8 */
  timezone?: number;
  /** IANA 历史时区，例如 America/New_York。含历史夏令时规则，优先于 timezone */
  timeZoneId?: string;
}

export type Gender = 'male' | 'female';
export type CalendarType = 'solar' | 'lunar';

/**
 * 跨体系复用的出生档案。
 * 只描述客观出生事实，不含页面状态、报告偏好或用户历史。
 */
export interface BirthProfile {
  id?: string;
  name?: string;
  gender: Gender;
  calendarType: CalendarType;
  year: number;
  month: number;
  day: number;
  /** 精准出生小时，与 minute 成对 */
  hour?: number;
  /** 精准出生分钟，与 hour 成对 */
  minute?: number;
  /** 传统时辰索引 0-12；未启用真太阳时且无精准时分时使用 */
  timeIndex?: number;
  second?: number;
  isLeapMonth?: boolean;
  location?: BirthLocation;
  /**
   * 真太阳时开关。**必须显式由用户决定，禁止默默启用。**
   * 实测：乌鲁木齐 23:30 启用后变为 21:24，日柱时柱全变，与绝大多数平台结果不同。
   */
  useTrueSolarTime?: boolean;
  /** 中国夏令时 1986-1991 修正 */
  applyChinaDst?: boolean;
}

/** 归一化后的排盘时刻，是后续所有体系的唯一时间基准。 */
export interface NormalizedBirth {
  /** 用户输入的钟表时间 */
  clockTime: DateTimeParts;
  /** 实际用于排盘的时间（可能已做真太阳时/夏令时修正） */
  effectiveTime: DateTimeParts;
  /** 传统时辰索引 0-12 */
  timeIndex: number;
  timeInputMode: 'traditional-shichen' | 'precise-clock-time';
  /** 真太阳时修正量（秒），正为加，负为减 */
  trueSolarOffsetSeconds: number;
  resolvedLocation?: ResolvedLocation;
}

export interface DateTimeParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

export interface ResolvedLocation {
  name?: string;
  longitude: number;
  latitude?: number;
  timezone?: number;
  coordinateAccuracy?: string;
}

/** 所问之事。卜卦类体系需要，命盘类体系可选。 */
export interface Question {
  /** 提问分类，决定断言投影到决策轴的口径 */
  topicId: TopicId;
  /** 用户原文。仅用于展示与 AI 解读，不参与任何计算 */
  text?: string;
  /** 问事时刻。卜卦类以此为基准；不传则由调用方显式注入，内核绝不取当前时间 */
  askedAt: DateTimeParts;
}

export type TopicId =
  | 'career'
  | 'romance'
  | 'move'
  | 'money'
  | 'timing'
  | 'health'
  | 'study'
  | 'relationship'
  | 'general';

// ─────────────────────────────── 流派配置 ───────────────────────────────

/**
 * 流派配置。**每一项都真实改变排盘结果**，不是展示偏好。
 *
 * 实测状态（2026-08-31）：
 * - qimen.juMethod：mingyu-core 支持 'chaibu' | 'zhirun'，已验证可用
 * - qimen.method：'zhuanpan' | 'feipan'，已验证可用
 * - ziwei.algorithm：仅 'default' | 'zhongzhou' 两档（委托 iztro）；
 *   四化飞星/自化库不支持，需自研，暂不开放
 * - astro.houses：**mingyu-core 硬编码 Placidus，无切换**。
 *   字段先预留，MVP 阶段不暴露给用户，结果页须标注采用 Placidus
 */
export interface SchoolConfig {
  bazi?: {
    /** 早晚子时换日口径。实测：广州 2000-12-31 23:59 两种口径日柱差一位 */
    dayBoundary?: 'zhengZi' | 'zaoZi';
    yongshen?: 'tiaohou' | 'fuyi' | 'tongguan';
  };
  ziwei?: {
    algorithm?: 'default' | 'zhongzhou';
  };
  qimen?: {
    method?: 'zhuanpan' | 'feipan';
    juMethod?: 'chaibu' | 'zhirun';
    scope?: 'year' | 'month' | 'day' | 'hour';
  };
  meihua?: {
    method?: 'time' | 'number' | 'random';
  };
  astro?: {
    /** 预留：mingyu-core 当前不支持切换，强制 Placidus */
    houses?: 'placidus';
    zodiac?: 'tropical' | 'sidereal';
  };
  tarot?: {
    spread?: 'single' | 'three' | 'love' | 'career' | 'decision';
    /** 是否使用逆位 */
    reversed?: boolean;
    /** 抽牌种子。**注意**：底层库的可复现只保证过程可重放，不证明预测有效性 */
    seed?: number;
  };
}

/**
 * 随机轨迹。
 *
 * 复盘时间轴的地基：存下 samples 就能用 replay 精确重现当时的抽牌，
 * 不依赖随机数发生器的实现细节 —— 将来即使换库也能重放。
 */
export interface RandomTrace {
  mode: 'system' | 'seeded' | 'custom' | 'replay';
  seed?: string | number;
  /** 原始随机样本，重放时用 */
  samples: number[];
}

// ─────────────────────────────── 输出层 ───────────────────────────────

export type WarningLevel = 'info' | 'warn' | 'error';

/**
 * 警告。用途是把「可能与别家平台对不上」的原因提前告诉用户，
 * 而不是等他来投诉。这是本产品信任感的来源。
 */
export interface Warning {
  level: WarningLevel;
  code: string;
  message: string;
}

export type SystemId =
  | 'bazi'
  | 'ziwei'
  | 'qimen'
  | 'liuren'
  | 'xiaoliuren'
  | 'meihua'
  | 'astrolabe'
  | 'tarot';

/**
 * 统一排盘结果协议。**所有 adapter 必须返回这个形状。**
 *
 * engineVersion + configHash 是「快照不可变」的关键：
 * 库会升级、流派配置会改，复盘时必须能回看「当时那套规则说了什么」。
 */
export interface ChartResult<T = unknown> {
  systemId: SystemId;
  /** 含底层库版本，例如 "mingyu-core@0.2.0" */
  engineVersion: string;
  /** hash(normalizedInput + appliedConfig + engineVersion)，用于缓存与快照 */
  configHash: string;
  /** 实际生效的流派参数，原样回显，供 UI 生成说明文案 */
  appliedConfig: Record<string, unknown>;
  /** 直接透传底层库的 warnings + 内核自检补充的 warnings */
  warnings: Warning[];
  /** 各体系原生盘面数据，结构与渲染器一一对应 */
  data: T;
  /**
   * 随机轨迹，仅随机类体系（塔罗、梅花随机卦等）有值。
   * 保存它才能事后精确重放当时的抽牌/起卦。
   */
  randomTrace?: RandomTrace;
  /** 投影到决策轴的断言，阶段 3 填充；MVP 阶段为空数组 */
  assertions: Assertion[];
  /**
   * 确定性解读层（不依赖 AI、永远可用）。
   * 把该体系盘面翻译成人话：总览、关键指标、大运/流年时间轴。
   * 与 assertions 同源，都是算法确定性产出，不是 AI 生成。
   */
  interpretation?: InterpretationData;
}

// ─────────────────────────────── 决策轴与断言 ───────────────────────────────

/**
 * 6 条决策轴。
 *
 * 关键思路：不强行统一「五行 / 行星 / 牌义」这些互不相通的本体，
 * 而是让每个体系用自己的原生语言判断，只对外输出决策轴上的倾向值。
 * 轴的语义由本平台定义，古籍里没有——这一点必须在 UI 上反复说清。
 */
export type AxisId =
  /** 宜动 +2 ↔ 宜静 −2 */
  | 'action'
  /** 宜进 +2 ↔ 宜守 −2 */
  | 'timing'
  /** 结盟 +2 ↔ 独处 −2 */
  | 'social'
  /** 进取 +2 ↔ 避险 −2 */
  | 'risk'
  /** 求变 +2 ↔ 守常 −2 */
  | 'change'
  /** 兜底轴：仅供只给吉凶、不给方向的体系使用。吉 +2 ↔ 凶 −2 */
  | 'auspicious';

export const AXIS_IDS: readonly AxisId[] = [
  'action',
  'timing',
  'social',
  'risk',
  'change',
  'auspicious',
] as const;

export const AXIS_LABELS: Record<AxisId, { positive: string; negative: string }> = {
  action: { positive: '宜动', negative: '宜静' },
  timing: { positive: '宜进', negative: '宜守' },
  social: { positive: '结盟', negative: '独处' },
  risk: { positive: '进取', negative: '避险' },
  change: { positive: '求变', negative: '守常' },
  auspicious: { positive: '吉', negative: '凶' },
};

/** 倾向值，步进 0.5，范围 [-2, 2] */
export type Score = -2 | -1.5 | -1 | -0.5 | 0 | 0.5 | 1 | 1.5 | 2;

export interface Assertion {
  systemId: SystemId;
  /** 产出此断言的流派配置标识，用于把分歧归因到具体流派 */
  schoolId: string;
  topicId: TopicId;
  axis: AxisId;
  score: Score;
  /** 该体系的自评确信度 0..1，非统计置信度 */
  confidence: number;
  /** 人话依据，须可回溯到 data 中的具体字段 */
  evidence: string[];
}

/** 共识度。注意：这是本平台定义的一致性指标，不代表预测概率。 */
export interface Consensus {
  axis: AxisId;
  /** 加权均值，范围 [-2, 2] */
  weightedMean: number;
  /** 共识度 0..1，1 表示完全一致 */
  agreement: number;
  /** 与均值偏离超过 1.0 的断言，按偏离绝对值降序 */
  outliers: Assertion[];
  /** 参与计算的体系数 */
  sampleSize: number;
}

// ─────────────────────────────── 复盘 ───────────────────────────────

export type Verdict = 'hit' | 'miss' | 'partial' | 'unknown';

/**
 * 复盘结果。**命中率仅用户本人可见**，平台不聚合、不展示、不宣称准确率。
 */
export interface Outcome {
  verdict: Verdict;
  actualNote?: string;
  resolvedAt?: string;
}

/** 问事快照。固化断言数组而绝不事后重算。 */
export interface QuestionSnapshot {
  questionId: string;
  topicId: TopicId;
  askedAt: DateTimeParts;
  /** 当时全套规则算出的断言，不可变 */
  assertions: Assertion[];
  /** 关联的各体系 result 的 configHash，用于溯源 */
  chartRefs: string[];
  engineVersions: string[];
  createdAt: string;
  outcome?: Outcome;
}

// ─────────────────────────────── 随机源 ───────────────────────────────

/**
 * 可复现随机源。抽牌/起卦必须注入，禁止内核内部调用 Math.random()。
 * 实测：mingyu-core 的 createSeededRandom 同 seed 两次调用结果完全一致。
 */
export interface RandomSource {
  (): number;
}

// ─────────────────────────────── 能力注册表 ───────────────────────────────

export interface SystemMeta {
  id: SystemId;
  name: string;
  category: 'chart' | 'divination';
  /** 是否需要出生档案（否则只需问事时刻） */
  requiresBirthProfile: boolean;
  /** 是否需要随机源 */
  requiresRandom: boolean;
  /** 可切换的流派参数，驱动 UI 自动生成开关，不硬编码 */
  schools: SchoolFieldMeta[];
  /** 一句话说明这套体系在算什么，给科普层用 */
  summary: string;
  /** 已知的流派分歧点，给「流派 diff」视图用 */
  knownDivergences: string[];
  /** 诚实边界：做不到或做得很浅的地方 */
  limitations: string[];
}

export interface SchoolFieldMeta {
  key: string;
  label: string;
  options: Array<{ value: string; label: string; note?: string }>;
  default: string;
  /** false 表示底层库尚不支持切换，UI 应置灰并说明 */
  switchable: boolean;
}

/**
 * 解读层的结构化数据，前端统一渲染，不依赖各体系内部差异。
 */
export interface InterpretationHighlight {
  /** 指标名，如「日主」「命宫主星」 */
  label: string;
  /** 指标值，如「庚金（阳）」 */
  value: string;
  /** 补充说明 */
  note?: string;
  /** 关联术语词典的 key，前端点击可弹白话解释 */
  term?: string;
}

export interface InterpretationTimelineItem {
  /** 如「2026 流年」「当前大限」 */
  label: string;
  /** 描述文本 */
  text: string;
  /** 是否高亮为「当前」 */
  isCurrent?: boolean;
}

export interface InterpretationData {
  /** 白话总览，2–4 句 */
  summary: string[];
  /** 关键指标卡 */
  highlights: InterpretationHighlight[];
  /** 大运/流年/大限时间轴（命盘类有） */
  timeline?: InterpretationTimelineItem[];
}
