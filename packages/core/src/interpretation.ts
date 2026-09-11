/**
 * 玄览 · 解释层
 *
 * 这里把每个体系的「原生盘面」翻译成两层可消费的结构：
 *  1. assertions —— 投影到 6 条决策轴的倾向值，供「共识度仪表盘」聚合。
 *  2. interpretation —— 确定性白话解读（总览 + 指标卡 + 时间轴），前端直接渲染。
 *
 * 重要原则：
 * - 全部确定性计算，不调 AI、不调 Math.random、不调 Date.now。
 * - 五行旺衰/日主强弱/用神方向是按标准干支规则自算的近似（藏干权重 本气3/中气2/余气1，天干5）。
 *   这是「判读层」而非「排盘层」，口径差异已在 UI 声明，不属于 bug。
 * - 决策轴的语义由本平台定义，古籍里没有。映射规则见各函数，UI 会反复说明。
 */

import type { AdapterContext } from './adapters/base.ts';
import type {
  Assertion,
  AxisId,
  InterpretationData,
  InterpretationHighlight,
  Score,
  TopicId,
} from './types.ts';

// ─────────────────────── 五行与干支基础表 ───────────────────────

const GAN_LIST = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const ZHI_LIST = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const GAN_ELEMENT: Record<string, string> = {
  甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土', 己: '土', 庚: '金', 辛: '金', 壬: '水', 癸: '水',
};
/** 地支藏干：[本气, 中气, 余气] */
const ZHI_HIDDEN: Record<string, string[]> = {
  子: ['癸'], 丑: ['己', '癸', '辛'], 寅: ['甲', '丙', '戊'], 卯: ['乙'], 辰: ['戊', '乙', '癸'],
  巳: ['丙', '庚', '戊'], 午: ['丁', '己'], 未: ['己', '丁', '乙'], 申: ['庚', '壬', '戊'], 酉: ['辛'],
  戌: ['戊', '辛', '丁'], 亥: ['壬', '甲'],
};
const ZHI_ELEMENT: Record<string, string> = {
  子: '水', 丑: '土', 寅: '木', 卯: '木', 辰: '土', 巳: '火', 午: '火', 未: '土', 申: '金', 酉: '金', 戌: '土', 亥: '水',
};
const ELEMENTS = ['木', '火', '土', '金', '水'] as const;
interface Five { 木: number; 火: number; 土: number; 金: number; 水: number; }
/** 我生（食伤） */
const SHENG: Record<string, string> = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
/** 我克（财） */
const KE: Record<string, string> = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };

/** 梅花易数·体用关系白话（体=自己，用=所问之事） */
const TIYONG_NOTE: Record<string, string> = {
  体克用: '你能压住这件事，事可成但要自己主动出手，吉。',
  用生体: '事情来生你，得助力，不必强求也会往好的方向走。',
  比和: '双方同气，事情顺，但也要看旺衰——旺则速，衰则慢。',
  体生用: '你在耗自己去生这件事，事成也要付出代价，费力。',
  用克体: '事情克你，阻力大，宜守不宜攻。',
};

/** 体卦旺衰白话 */
const TISEASON_NOTE: Record<string, string> = {
  旺: '——体卦当令，力量足，吉凶都会被放大。',
  相: '——体卦得时令相生，力量不弱。',
  休: '——体卦休囚，力量平平。',
  囚: '——体卦受困，事情推进偏慢。',
  衰: '——体卦失时，即便体用关系好也应期偏晚。',
  死: '——体卦极衰，吉事减力，凶事更需谨慎。',
};

function clamp(n: number): Score {
  const v = Math.max(-2, Math.min(2, n));
  return (Math.round(v * 2) / 2) as Score;
}
function shengWo(el: string, target: string): boolean {
  return SHENG[el] === target;
}
function yearGanZhi(y: number): string {
  return (GAN_LIST[((y - 4) % 10 + 10) % 10] ?? '') + (ZHI_LIST[((y - 4) % 12 + 12) % 12] ?? '');
}

/** 四柱五行近似分数：天干 5，地支本气 3 / 中气 2 / 余气 1 */
function baziElementScores(pillars: any): Five {
  const s: Five = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 };
  const add = (gz: string | undefined, w: number) => {
    if (!gz) return;
    const el = GAN_ELEMENT[gz] ?? ZHI_ELEMENT[gz];
    if (el) s[el as keyof Five] += w;
  };
  for (const key of ['year', 'month', 'day', 'hour'] as const) {
    const p = pillars?.[key];
    if (!p) continue;
    add(p.gan, 5);
    const hidden = p.zhi ? ZHI_HIDDEN[p.zhi] ?? [] : [];
    const ws = [3, 2, 1];
    hidden.forEach((h, i) => add(h, ws[i] ?? 1));
  }
  return s;
}

/** 把四柱拆成「每个字」，分类到比劫/印/财/食伤/官杀并累加权分 */
function baziSideScores(pillars: any, dayEl: string): { bi: number; yin: number; cai: number; shi: number; guan: number } {
  const words: Array<{ el: string; w: number }> = [];
  const push = (gz: string | undefined, w: number) => {
    if (!gz) return;
    const el = GAN_ELEMENT[gz] ?? ZHI_ELEMENT[gz];
    if (el) words.push({ el, w });
  };
  for (const key of ['year', 'month', 'day', 'hour'] as const) {
    const p = pillars?.[key];
    if (!p) continue;
    push(p.gan, 5);
    const hidden = p.zhi ? ZHI_HIDDEN[p.zhi] ?? [] : [];
    const ws = [3, 2, 1];
    hidden.forEach((h, i) => push(h, ws[i] ?? 1));
  }
  const acc = { bi: 0, yin: 0, cai: 0, shi: 0, guan: 0 };
  for (const { el, w } of words) {
    if (el === dayEl) acc.bi += w;
    else if (shengWo(el, dayEl)) acc.yin += w;
    else if (KE[dayEl] === el) acc.cai += w;
    else if (SHENG[dayEl] === el) acc.shi += w;
    else if (KE[el] === dayEl) acc.guan += w;
  }
  return acc;
}

function topicOf(ctx: AdapterContext): TopicId {
  return ctx.question?.topicId ?? 'general';
}
function yearOf(ctx: AdapterContext): number {
  return ctx.question?.askedAt.year ?? ctx.normalized.effectiveTime.year;
}
function pct(n: number): string {
  return (Math.round(n * 10) / 10).toString();
}

// ─────────────────────── 八字 ───────────────────────

export function interpretBazi(data: any, ctx: AdapterContext): { assertions: Assertion[]; interpretation: InterpretationData } {
  const topic = topicOf(ctx);
  const dayEl = data?.dayMaster?.element as string | undefined;
  const dayGan = data?.dayMaster?.gan as string | undefined;
  const pillars = data?.pillars;
  const scores = baziElementScores(pillars);
  const total = ELEMENTS.reduce((s, e) => s + scores[e], 0) || 1;
  const side = dayEl ? baziSideScores(pillars, dayEl) : { bi: 0, yin: 0, cai: 0, shi: 0, guan: 0 };
  const shengFu = side.bi + side.yin;
  const xieHao = side.cai + side.shi + side.guan;
  let strength: '偏强' | '偏弱' | '中和' = '中和';
  if (shengFu > xieHao * 1.05) strength = '偏强';
  else if (shengFu < xieHao * 0.95) strength = '偏弱';
  const yongDir = strength === '偏强' ? '克泄耗（财 / 食伤 / 官杀）' : strength === '偏弱' ? '生扶（印 / 比劫）' : '平衡为要，不宜偏补';

  const y = yearOf(ctx);
  const lyGz = yearGanZhi(y);
  const lyGan = lyGz[0] ?? '';
  const lyEl = GAN_ELEMENT[lyGan] ?? '';
  let rel = '未知';
  if (dayEl && lyEl) {
    if (lyEl === dayEl) rel = '比和（同我）';
    else if (shengWo(lyEl, dayEl)) rel = '生扶日主';
    else if (KE[lyEl] === dayEl) rel = '克泄日主';
    else if (KE[dayEl] === lyEl) rel = '日主所克';
    else if (SHENG[dayEl] === lyEl) rel = '日主所生';
  }

  const schoolId = `bazi.${ctx.config.bazi?.dayBoundary ?? 'zhengZi'}.${ctx.config.bazi?.yongshen ?? 'tiaohou'}`;
  const assertions: Assertion[] = [
    {
      systemId: 'bazi', schoolId, topicId: topic, axis: 'change',
      score: clamp(strength === '偏强' ? 1 : strength === '偏弱' ? -1 : 0),
      confidence: 0.55,
      evidence: [`日主${dayGan ?? '?'}（${dayEl ?? '?'}），生扶分 ${pct(shengFu)} / 克泄耗 ${pct(xieHao)}，判定${strength}`],
    },
    {
      systemId: 'bazi', schoolId, topicId: topic, axis: 'risk',
      score: clamp(strength === '偏强' ? 0.5 : -0.5),
      confidence: 0.5,
      evidence: [`用神喜${yongDir}`],
    },
    {
      systemId: 'bazi', schoolId, topicId: topic, axis: 'auspicious',
      score: clamp(rel === '生扶日主' || rel === '比和（同我）' ? 1 : rel === '克泄日主' ? -1 : 0.5),
      confidence: 0.45,
      evidence: [`${y} 流年 ${lyGz}（${lyEl}），与日主${rel}`],
    },
    {
      systemId: 'bazi', schoolId, topicId: topic, axis: 'timing',
      score: clamp(rel === '生扶日主' || rel === '比和（同我）' ? 1 : rel === '克泄日主' ? -1 : 0),
      confidence: 0.45,
      evidence: [`${y} 流年 ${lyGz}（${lyEl}）与日主${rel}，主当前时机${rel === '生扶日主' || rel === '比和（同我）' ? '得令宜进' : rel === '克泄日主' ? '受泄宜守' : '平顺'}`],
    },
    {
      systemId: 'bazi', schoolId, topicId: topic, axis: 'social',
      score: clamp(((side.bi - side.guan) / (side.bi + side.guan || 1)) * 1.5),
      confidence: 0.45,
      evidence: [`比劫 ${pct(side.bi)} / 官杀 ${pct(side.guan)}，主同辈助力与人际张力之对比`],
    },
  ];

  const hl: InterpretationHighlight[] = [
    { label: '日主', value: `${dayGan ?? '?'}（${dayEl ?? '?'}·${data?.dayMaster?.yinYang ?? ''}）`, term: '日主' },
    { label: '强弱', value: strength, note: `生扶 ${pct(shengFu)} / 克泄耗 ${pct(xieHao)}` },
    {
      label: '五行分布',
      value: `金${pct(scores.金)} 木${pct(scores.木)} 火${pct(scores.火)} 土${pct(scores.土)} 水${pct(scores.水)}`,
      term: '五行',
    },
    { label: '用神方向', value: yongDir },
    { label: '今年流年', value: `${lyGz}（${lyEl}）`, note: `与日主${rel}`, term: '流年' },
  ];

  return {
    assertions,
    interpretation: {
      summary: [
        `日主${dayGan ?? '?'}（${dayEl ?? '?'}·${data?.dayMaster?.yinYang ?? ''}），生于 ${pillars?.month?.ganZhi ?? '?'} 月。`,
        `全局五行近似权重：金${pct(scores.金)} 木${pct(scores.木)} 火${pct(scores.火)} 土${pct(scores.土)} 水${pct(scores.水)}（满分 ${pct(total)}）。`,
        `日主${strength}，用神喜${yongDir}。`,
      ],
      highlights: hl,
      timeline: [
        { label: `${y} 流年`, text: `${lyGz}（${lyEl}），与日主${rel}`, isCurrent: true },
        { label: '起运', text: data?.luckInfo?.handoverInfo ?? data?.luckInfo?.startInfo ?? '—' },
      ],
    },
  };
}

// ─────────────────────── 紫微斗数 ───────────────────────

const SHA_PO_LANG = ['七杀', '破军', '贪狼'];
const JI_YUE_TONG_LIANG = ['天机', '太阴', '天同', '天梁'];
const BRIGHT_MAP: Record<string, number> = { 庙: 2, 旺: 1.5, 得: 1, 利: 0.5, 平: 0, 陷: -1, 闲: -1.5 };

export function interpretZiwei(data: any, ctx: AdapterContext): { assertions: Assertion[]; interpretation: InterpretationData } {
  const topic = topicOf(ctx);
  const astro = data?.astrolabe;
  const mg = astro?.palace?.('命宫');
  const mingStars: Array<{ name: string; brightness: string }> =
    mg?.majorStars?.map((s: any) => ({ name: s.name, brightness: s.brightness })) ?? [];
  const names = mingStars.map((s) => s.name);
  const shaPoLang = names.some((n) => SHA_PO_LANG.includes(n));
  const jiYueTongLiang = names.some((n) => JI_YUE_TONG_LIANG.includes(n));
  const pattern = shaPoLang ? '杀破狼（开创变动型）' : jiYueTongLiang ? '机月同梁（稳健保守型）' : `${names[0] ?? '空'} 坐命`;
  const brightAvg = mingStars.length
    ? mingStars.reduce((s, st) => s + (BRIGHT_MAP[st.brightness] ?? 0), 0) / mingStars.length
    : 0;
  const brightLabel = brightAvg > 0.5 ? '偏旺' : brightAvg < 0 ? '偏弱' : '中和';

  const birthYear = ctx.profile.year;
  const age = yearOf(ctx) - birthYear;
  let curDa: any = null;
  for (const p of astro?.palaces ?? []) {
    const r = p?.decadal?.range;
    if (r && age >= r[0] && age <= r[1]) curDa = p;
  }
  const curStars = curDa?.majorStars ?? [];
  const curBright = curStars.length
    ? curStars.reduce((s: number, st: any) => s + (BRIGHT_MAP[st.brightness] ?? 0), 0) / curStars.length
    : brightAvg;
  const sibPalace = astro?.palace?.('兄弟宫');
  const sibStars = sibPalace?.majorStars ?? [];
  const sibBright = sibStars.length
    ? sibStars.reduce((s: number, st: any) => s + (BRIGHT_MAP[st.brightness] ?? 0), 0) / sibStars.length
    : 0;

  const schoolId = `ziwei.${ctx.config.ziwei?.algorithm ?? 'default'}`;
  const assertions: Assertion[] = [
    {
      systemId: 'ziwei', schoolId, topicId: topic, axis: 'change',
      score: clamp(shaPoLang ? 1.5 : jiYueTongLiang ? -1 : 0.5),
      confidence: 0.5,
      evidence: [`命宫主星 ${names.join('、') || '无'}，格局 ${pattern}`],
    },
    {
      systemId: 'ziwei', schoolId, topicId: topic, axis: 'auspicious',
      score: clamp(brightAvg),
      confidence: 0.5,
      evidence: [`命宫主星亮度 ${mingStars.map((s) => `${s.name}(${s.brightness})`).join('、') || '—'}`],
    },
    {
      systemId: 'ziwei', schoolId, topicId: topic, axis: 'timing',
      score: clamp(curBright),
      confidence: 0.45,
      evidence: [curDa ? `当前大限「${curDa.name}」宫主星亮度 ${pct(curBright)}（${curDa.heavenlyStem}${curDa.earthlyBranch}）` : `命宫主星亮度 ${pct(brightAvg)}`],
    },
    ...(sibStars.length
      ? [{
          systemId: 'ziwei' as const, schoolId, topicId: topic, axis: 'social' as const,
          score: clamp(sibBright),
          confidence: 0.4,
          evidence: [`兄弟宫主星 ${sibStars.map((s: any) => s.name).join('、') || '—'} 亮度 ${pct(sibBright)}`],
        }]
      : []),
  ];

  const summary = [
    `命宫主星 ${names.join('、') || '无'}，当前格局 ${pattern}。`,
    `主星亮度${brightLabel}（均值 ${pct(brightAvg)}）。`,
  ];
  if (curDa) summary.push(`当前 ${age} 岁，正行「${curDa.name}」大限（${curDa.heavenlyStem}${curDa.earthlyBranch}）。`);

  return {
    assertions,
    interpretation: {
      summary,
      highlights: [
        { label: '命宫主星', value: names.join('、') || '—', term: '紫微主星' },
        { label: '格局', value: pattern },
        { label: '命宫亮度', value: `${mg?.majorStars?.[0]?.brightness ?? '—'}（${brightLabel}）` },
      ],
      timeline: curDa
        ? [{ label: `当前大限（${age} 岁）`, text: `${curDa.name}宫 · ${curDa.heavenlyStem}${curDa.earthlyBranch}`, isCurrent: true }]
        : undefined,
    },
  };
}

// ─────────────────────── 奇门遁甲 ───────────────────────

const JI_MEN = ['开门', '休门', '生门'];
const XIONG_MEN = ['死门', '惊门', '伤门'];

export function interpretQimen(data: any, ctx: AdapterContext): { assertions: Assertion[]; interpretation: InterpretationData } {
  const topic = topicOf(ctx);
  const insights: any[] = data?.palaceInsights ?? data?.paletteInsights ?? [];
  const good = insights.filter((i) => i.level === '吉').length;
  const risk = insights.filter((i) => i.level === '风险').length;
  const patterns: any[] = data?.classicPatterns ?? [];
  const goodP = patterns.filter((p) => p.type === 'good').length;
  const badP = patterns.filter((p) => p.type === 'bad').length;
  const doors: string[] = (data?.jiuGongGe ?? []).map((g: any) => g?.renPan?.door).filter(Boolean);
  const jiMen = doors.filter((d) => JI_MEN.includes(d)).length;
  const xiongMen = doors.filter((d) => XIONG_MEN.includes(d)).length;

  const schoolId = `qimen.${ctx.config.qimen?.method ?? 'zhuanpan'}.${ctx.config.qimen?.juMethod ?? 'chaibu'}`;
  const assertions: Assertion[] = [
    {
      systemId: 'qimen', schoolId, topicId: topic, axis: 'auspicious',
      score: clamp(good + goodP * 0.5 - risk - badP * 0.5),
      confidence: 0.55,
      evidence: [`吉门 ${jiMen} / 凶门 ${xiongMen}；吉格 ${goodP} / 凶格 ${badP}；吉宫 ${good} / 风险宫 ${risk}`],
    },
    {
      systemId: 'qimen', schoolId, topicId: topic, axis: 'action',
      score: clamp(goodP - badP),
      confidence: 0.5,
      evidence: [`三奇得使等吉格 ${goodP} 项`],
    },
    {
      systemId: 'qimen', schoolId, topicId: topic, axis: 'timing',
      score: clamp((jiMen - xiongMen) * 0.5),
      confidence: 0.5,
      evidence: [`吉门 ${jiMen} / 凶门 ${xiongMen}，门为时空之户，主宜进宜守`],
    },
  ];

  return {
    assertions,
    interpretation: {
      summary: [
        `奇门局式：${data?.juShu ?? '?'} 局（${data?.isYangDun ? '阳遁' : '阴遁'}），定局法 ${ctx.config.qimen?.juMethod ?? 'chaibu'}。`,
        `吉门 ${jiMen} 个（开/休/生）、凶门 ${xiongMen} 个（死/惊/伤）；吉格 ${goodP} 项、凶格 ${badP} 项。`,
      ],
      highlights: [
        { label: '吉门', value: `${jiMen} 个`, note: JI_MEN.join('、'), term: '奇门吉门' },
        { label: '凶门', value: `${xiongMen} 个`, note: XIONG_MEN.join('、') },
        { label: '吉格', value: `${goodP} 项`, note: patterns.filter((p) => p.type === 'good').map((p) => p.name).join('、') },
        { label: '凶格', value: `${badP} 项`, note: patterns.filter((p) => p.type === 'bad').map((p) => p.name).join('、') },
      ],
    },
  };
}

// ─────────────────────── 大六壬 ───────────────────────

export function interpretLiuren(data: any, ctx: AdapterContext): { assertions: Assertion[]; interpretation: InterpretationData } {
  const topic = topicOf(ctx);
  const tt: any[] = data?.threeTransmissions ?? [];
  const chu = tt.find((t) => t.stage === '初传');
  const mo = tt.find((t) => t.stage === '末传');
  const pattern = data?.transmissionPattern as string | undefined;
  const lesson = data?.lessonSummary as string | undefined;

  let actionScore = 0;
  if (chu?.wuxing && mo?.wuxing) {
    if (SHENG[mo.wuxing] === chu.wuxing) actionScore = 1;
    else if (KE[mo.wuxing] === chu.wuxing) actionScore = -1;
  }
  // 课体吉凶（保守：命中明显凶字才给负）
  const badWord = /(凶|忌|破|败|空|陷)/.test(`${pattern ?? ''}${lesson ?? ''}`);
  const goodWord = /(吉|成|利|顺|泰|和)/.test(`${pattern ?? ''}${lesson ?? ''}`);
  const ax = badWord ? -1 : goodWord ? 1 : 0;
  const lrMid = tt.find((t) => t.stage === '中传');
  const lrGods = [chu?.god, lrMid?.god, mo?.god].filter(Boolean) as string[];
  const LR_GOOD = ['六合', '青龙', '太阴'];
  const LR_BAD = ['勾陈', '朱雀', '玄武'];
  const lrGood = lrGods.filter((g) => LR_GOOD.includes(g)).length;
  const lrBad = lrGods.filter((g) => LR_BAD.includes(g)).length;

  const assertions: Assertion[] = [
    {
      systemId: 'liuren', schoolId: 'liuren.default', topicId: topic, axis: 'action',
      score: clamp(actionScore),
      confidence: 0.5,
      evidence: [`初传 ${chu?.branch ?? '?'}（${chu?.god ?? '?'}）→ 末传 ${mo?.branch ?? '?'}（${mo?.god ?? '?'}），${actionScore > 0 ? '末生初、顺势递进' : actionScore < 0 ? '末克初、阻滞反复' : '传无生克'}`],
    },
    {
      systemId: 'liuren', schoolId: 'liuren.default', topicId: topic, axis: 'auspicious',
      score: clamp(ax),
      confidence: 0.45,
      evidence: [`课体 ${pattern ?? '?'}；${lesson ?? ''}`.slice(0, 80)],
    },
    {
      systemId: 'liuren', schoolId: 'liuren.default', topicId: topic, axis: 'social',
      score: clamp(lrGood - lrBad),
      confidence: 0.4,
      evidence: [`三传天将 ${lrGods.join('、') || '?'}（六合/青龙/太阴主和合，勾陈/朱雀/玄武主争斗）`],
    },
  ];

  return {
    assertions,
    interpretation: {
      summary: [
        `课体：${pattern ?? '?'};${lesson ?? ''}`.slice(0, 90),
        `三传：初 ${chu?.branch ?? '?'}（${chu?.god ?? '?'}）→ 中 ${tt.find((t) => t.stage === '中传')?.branch ?? '?'} → 末 ${mo?.branch ?? '?'}（${mo?.god ?? '?'}）。`,
      ],
      highlights: [
        { label: '课体', value: pattern ?? '?', term: '六壬课体' },
        { label: '初传', value: `${chu?.branch ?? '?'}${chu?.god ? '·' + chu.god : ''}`, note: chu?.relation },
        { label: '末传', value: `${mo?.branch ?? '?'}${mo?.god ? '·' + mo.god : ''}`, note: mo?.relation },
      ],
    },
  };
}

// ─────────────────────── 小六壬 ───────────────────────

const XL_JI = ['大安', '速喜', '小吉'];
const XL_XIONG = ['留连', '赤口', '空亡'];

export function interpretXiaoliuren(data: any, ctx: AdapterContext): { assertions: Assertion[]; interpretation: InterpretationData } {
  const topic = topicOf(ctx);
  const primary = data?.primary as { name: string; verse?: string } | undefined;
  const name = primary?.name ?? '?';
  const ax = XL_JI.includes(name) ? 1 : XL_XIONG.includes(name) ? -1 : 0;

  const assertions: Assertion[] = [
    {
      systemId: 'xiaoliuren', schoolId: 'xiaoliuren.time', topicId: topic, axis: 'auspicious',
      score: clamp(ax),
      confidence: 0.6,
      evidence: [`落宫六神「${name}」`],
    },
    {
      systemId: 'xiaoliuren', schoolId: 'xiaoliuren.time', topicId: topic, axis: 'timing',
      score: clamp(XL_JI.includes(name) ? 1 : XL_XIONG.includes(name) ? -1 : 0),
      confidence: 0.55,
      evidence: [`落宫六神「${name}」，${XL_JI.includes(name) ? '宜进' : XL_XIONG.includes(name) ? '宜守' : '平'}`],
    },
  ];

  return {
    assertions,
    interpretation: {
      summary: [`小六壬时间起课，落宫得「${name}」。`, primary?.verse ? `断语：${primary.verse.slice(0, 40)}…` : ''].filter(Boolean),
      highlights: [
        { label: '六神', value: name, term: '小六壬六神' },
        { label: '断语', value: (primary?.verse ?? '—').slice(0, 36) + '…' },
      ],
    },
  };
}

// ─────────────────────── 梅花易数 ───────────────────────

export function interpretMeihua(data: any, ctx: AdapterContext): { assertions: Assertion[]; interpretation: InterpretationData } {
  const topic = topicOf(ctx);
  const ti = data?.tiGua?.element as string | undefined;
  const yong = data?.yongGua?.element as string | undefined;
  let rel: string;
  if (!ti || !yong) rel = '未知';
  else if (ti === yong) rel = '比和';
  else if (KE[ti] === yong) rel = '体克用';
  else if (KE[yong] === ti) rel = '用克体';
  else if (SHENG[ti] === yong) rel = '体生用';
  else if (SHENG[yong] === ti) rel = '用生体';
  else rel = '未知';

  /* 盘面里其实还有大量可用信息（三卦、动爻、旺衰、应期、卦辞），以前只用到体用一条，太浪费 */
  const an = data?.analysis ?? {};
  const moving = data?.movingYao ?? {};
  const mainG = data?.mainHexagram;
  const interG = data?.interHexagram;
  const changedG = data?.changedHexagram;
  const tiState = an.tiSeasonState as string | undefined;
  const yongState = an.yongSeasonState as string | undefined;
  const yingQi: string[] = Array.isArray(an.yingQi) ? an.yingQi : [];

  const axMap: Record<string, number> = { '体克用': 1, '用生体': 1, '比和': 0, '体生用': -0.5, '用克体': -1.5 };
  const acMap: Record<string, number> = { '体克用': 1, '用生体': 0.5, '比和': 0, '体生用': -0.5, '用克体': -1.5 };

  const assertions: Assertion[] = [
    {
      systemId: 'meihua', schoolId: 'meihua.time', topicId: topic, axis: 'auspicious',
      score: clamp(axMap[rel] ?? 0),
      confidence: 0.55,
      evidence: [`本卦 ${data?.mainHexagram?.name ?? '?'}；体卦${ti} / 用卦${yong}，体用${rel}`],
    },
    {
      systemId: 'meihua', schoolId: 'meihua.time', topicId: topic, axis: 'action',
      score: clamp(acMap[rel] ?? 0),
      confidence: 0.5,
      evidence: [`体用${rel}`],
    },
    {
      systemId: 'meihua', schoolId: 'meihua.time', topicId: topic, axis: 'timing',
      score: clamp(tiState === '旺' ? 1 : tiState === '相' ? 0.5 : tiState === '休' ? 0 : tiState === '囚' ? -0.5 : tiState === '衰' || tiState === '死' ? -1.2 : 0),
      confidence: 0.45,
      evidence: [`体卦${tiState ?? '?'}（时令${an.season ?? ''}），旺则速成、衰则应期晚`],
    },
    {
      systemId: 'meihua', schoolId: 'meihua.time', topicId: topic, axis: 'social',
      score: clamp(rel === '用生体' ? 1 : rel === '比和' ? 0.5 : rel === '体克用' ? 0.5 : rel === '体生用' ? -0.5 : rel === '用克体' ? -1.5 : 0),
      confidence: 0.45,
      evidence: [`体用${rel}（体为问者、用为所问之事/他人）`],
    },
  ];

  const summary: string[] = [
    `起卦得「${mainG?.name ?? '?'}」为体，动在${moving?.description ?? '?'}，变出「${changedG?.name ?? '?'}」；过程看互卦「${interG?.name ?? '?'}」。`,
    `体卦属${ti ?? '?'}、用卦属${yong ?? '?'}，体用关系「${rel}」——${TIYONG_NOTE[rel] ?? '关系不明，暂不给方向。'}`,
  ];
  if (tiState) summary.push(`时令${an.season ?? ''}（月${an.monthBranch ?? '?'}·${an.monthElement ?? '?'}），体卦${tiState}、用卦${yongState ?? '?'}${TISEASON_NOTE[tiState] ?? ''}`);
  if (mainG?.movingYaoCi) summary.push(`动爻辞：「${mainG.movingYaoCi}」。`);
  if (yingQi.length) summary.push(`应期参考：${yingQi.slice(0, 2).join('；')}。`);

  return {
    assertions,
    interpretation: {
      summary,
      highlights: [
        { label: '本卦', value: `${mainG?.name ?? '?'}（${mainG?.symbol ?? ''}）`, note: mainG?.description, term: '八卦' },
        { label: '互卦（过程）', value: `${interG?.name ?? '?'}（${interG?.symbol ?? ''}）`, note: interG?.description, term: '八卦' },
        { label: '变卦（结局）', value: `${changedG?.name ?? '?'}（${changedG?.symbol ?? ''}）`, note: changedG?.description, term: '八卦' },
        { label: '体卦', value: `${data?.tiGua?.name ?? '?'}（${ti ?? '?'}·${data?.tiGua?.nature ?? ''}）`, term: '八卦' },
        { label: '用卦', value: `${data?.yongGua?.name ?? '?'}（${yong ?? '?'}·${data?.yongGua?.nature ?? ''}）`, term: '八卦' },
        { label: '体用生克', value: rel, note: TIYONG_NOTE[rel] },
        { label: '动爻', value: `${moving?.description ?? '?'}${moving?.yaoName ? `（${moving.yaoName}）` : ''}`, note: mainG?.movingYaoCi },
        ...(tiState ? [{ label: '体卦旺衰', value: `${tiState}（时令${an.season ?? '?'}）`, note: `用卦${yongState ?? '?'}` }] : []),
        ...(yingQi.length ? [{ label: '应期', value: yingQi[0] ?? '', note: yingQi.slice(1).join('；') }] : []),
      ],
      timeline: [
        { label: '现状 · 本卦', text: `${mainG?.name ?? '?'}｜${mainG?.description ?? '—'}`, isCurrent: true },
        { label: '过程 · 互卦', text: `${interG?.name ?? '?'}｜${interG?.description ?? '—'}` },
        { label: '结局 · 变卦', text: `${changedG?.name ?? '?'}｜${changedG?.description ?? '—'}` },
      ],
    },
  };
}

// ─────────────────────── 西方本命占星 ───────────────────────

const ASPECT_GOOD = ['合相', '拱相', '六合'];
const ASPECT_BAD = ['冲相', '刑相'];

export function interpretAstrolabe(data: any, ctx: AdapterContext): { assertions: Assertion[]; interpretation: InterpretationData } {
  const topic = topicOf(ctx);
  const asc = data?.angles?.find((a: any) => a.name === 'Ascendant');
  const sun = data?.planets?.find((p: any) => p.name === 'Sun');
  const moon = data?.planets?.find((p: any) => p.name === 'Moon');
  const aspects: any[] = data?.aspects ?? [];
  const goodA = aspects.filter((a) => ASPECT_GOOD.includes(a.type)).length;
  const badA = aspects.filter((a) => ASPECT_BAD.includes(a.type)).length;
  const elements = data?.summary?.elements as Record<string, any[]> | undefined;
  const fireWind = (elements?.火?.length ?? 0) + (elements?.风?.length ?? 0);
  const earthWater = (elements?.土?.length ?? 0) + (elements?.水?.length ?? 0);

  const schoolId = `astrolabe.${ctx.config.astro?.zodiac ?? 'tropical'}`;
  const assertions: Assertion[] = [
    {
      systemId: 'astrolabe', schoolId, topicId: topic, axis: 'auspicious',
      score: clamp(goodA - badA * 0.8),
      confidence: 0.45,
      evidence: [`主要相位：吉相 ${goodA} / 凶相 ${badA}`],
    },
    {
      systemId: 'astrolabe', schoolId, topicId: topic, axis: 'action',
      score: clamp(fireWind > earthWater ? 1 : fireWind < earthWater ? -1 : 0),
      confidence: 0.4,
      evidence: [`元素分布 火风 ${fireWind} vs 土水 ${earthWater}`],
    },
  ];

  return {
    assertions,
    interpretation: {
      summary: [
        `上升 ${asc?.sign ?? '?'}、太阳 ${sun?.sign ?? '?'}、月亮 ${moon?.sign ?? '?'}（采用 Placidus 分宫制）。`,
        `主要相位：吉相 ${goodA} / 凶相 ${badA}；元素 火风 ${fireWind} vs 土水 ${earthWater}。`,
      ],
      highlights: [
        { label: '上升', value: asc?.sign ?? '—', term: '星座' },
        { label: '太阳', value: sun?.sign ?? '—', term: '星座' },
        { label: '月亮', value: moon?.sign ?? '—', term: '星座' },
        { label: '主要相位', value: `吉 ${goodA} / 凶 ${badA}` },
      ],
    },
  };
}

// ─────────────────────── 塔罗 ───────────────────────

export function interpretTarot(data: any, ctx: AdapterContext): { assertions: Assertion[]; interpretation: InterpretationData } {
  const topic = topicOf(ctx);
  const cards: any[] = data?.cards ?? [];
  let sum = 0;
  const items: InterpretationHighlight[] = cards.map((c) => {
    const rev = !!c.reversed;
    sum += rev ? -0.5 : 0.5;
    return {
      label: `${c.position ?? ''}·${c.name ?? '?'}`,
      value: rev ? '逆位' : '正位',
      note: (c.keywords ?? []).join('、'),
    };
  });
  const ax = cards.length ? clamp((sum / cards.length) * 2) : 0;

  const assertions: Assertion[] = [
    {
      systemId: 'tarot', schoolId: `tarot.${ctx.config.tarot?.spread ?? 'three'}`,
      topicId: topic, axis: 'auspicious',
      score: clamp(ax),
      confidence: 0.4,
      evidence: [`牌阵 ${data?.spreadName ?? '?'} 共 ${cards.length} 张，正位占比 ${cards.filter((c) => !c.reversed).length}/${cards.length}`],
    },
  ];

  return {
    assertions,
    interpretation: {
      summary: [
        `牌阵：${data?.spreadName ?? '?'}（${cards.length} 张）。`,
        `正位多显顺势，逆位提示阻滞或需内省；牌义仅供参考，非命运判定。`,
      ],
      highlights: items,
    },
  };
}
