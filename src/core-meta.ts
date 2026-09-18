/**
 * 轻量元信息层 —— 刻意不依赖内核（@core / mingyu-core / iztro）。
 *
 * 为什么要单独存在：
 * ConsensusDashboard 这类「展示组件」只需要两样东西：
 * 轴的标签常量 AXIS_LABELS，和一个算总体共识度的纯函数 overallAgreement。
 * 这俩都是「纯数据 + 纯函数」，跟 1.6MB 的算法内核毫无关系。
 * 但如果它们躺在内核里，任何组件只要 `import { AXIS_LABELS } from './core'`，
 * 就会把整包算法拖进首屏 —— 哪怕这个页面只是想显示「宜动 ↔ 宜静」几个字。
 *
 * 所以这里放一份前端展示用的副本。内核（packages/core/src/types.ts、
 * consensus.ts）仍是权威源；若内核调整了轴定义，记得同步此处。
 *
 * 注意：本文件只以「类型」形式引用 './core'（import type，编译期抹除，
 * 不产生运行时依赖），因此不会把内核拉进任何静态引用它的模块。
 */
import type { AxisId, Consensus, TopicId } from './core';

export const AXIS_LABELS: Record<AxisId, { positive: string; negative: string }> = {
  action: { positive: '宜动', negative: '宜静' },
  timing: { positive: '宜进', negative: '宜守' },
  social: { positive: '结盟', negative: '独处' },
  risk: { positive: '进取', negative: '避险' },
  change: { positive: '求变', negative: '守常' },
  auspicious: { positive: '吉', negative: '凶' },
};

/**
 * 轴 → 中文「维度名」。与 AXIS_LABELS 的区别很重要：
 * AXIS_LABELS 给的是**两端的词**（宜动/宜静），而这里是**这一条轴叫什么**
 * （行动）。写摘要时要说「在『行动』上偏『宜静』」，两句都需要。
 *
 * 原来这份表只活在 DimensionGauges.tsx 里且是 Record<string,string>，
 * 于是别处要中文名只能写 `AXIS_LABELS[axis]?.name`——那个字段根本不存在，
 * 结果是英文轴 ID 直接漏到用户面前（见 git 历史里 ResultSummary 的修复）。
 */
export const DIM_NAMES: Record<AxisId, string> = {
  action: '行动',
  timing: '时机',
  social: '人际',
  risk: '进取',
  change: '变化',
  auspicious: '吉凶',
};

/** 倾向值 → 一端的词。与内核 consensus.ts 的 axisWord 同义，此处避免依赖内核。 */
export function axisWord(axis: AxisId, mean: number): string {
  const l = AXIS_LABELS[axis];
  if (mean > 0.3) return l.positive;
  if (mean < -0.3) return l.negative;
  return '持平';
}

/* ═══════════════ 裁断层（首屏那口「准话」） ═══════════════ */

/**
 * 用户选的主题 → 这件事到底该看哪条轴。
 *
 * 这一层存在的唯一理由：用户问「我精神方面好不好」，页面原先
 * 从第 1 屏到第 8 屏答的都是**平台自己**（一致度 83%、六条轴的分、
 * 两层方法论、八家辩论）。一致性指标长得像百分数，于是 83% 被读成
 * 「我 83% 好」。其实它是「八家意见 83% 一致」——跟用户的问题无关。
 *
 * 所以每个主题必须钦定一条**主判轴**，其余全是依据。
 */
const TOPIC_AXIS: Record<TopicId, AxisId> = {
  general: 'auspicious',
  /**
   * 事业这里**不能**写 risk（进取）。
   *
   * 实测：risk 轴全平台只有八字一家会表态（n=1），而 n=1 的一致度必然
   * 是 100%。于是页面真的输出过这么一句：
   *   「口径一致：偏「避险」（1 家里 1 家同向，一致度 100%）。」
   * 拿一家之言冒充八家共识 —— 这比不说更糟。
   *
   * 而「我到底该不该迈这一步」问的本来就是「该不该动」，落回 action
   * （行动，n=4：奇门/六壬/梅花/星盘）既更贴题，样本也够。
   */
  career: 'action',
  romance: 'social',
  money: 'auspicious',
  move: 'action',
  study: 'timing',
  health: 'auspicious',
  relationship: 'social',
  timing: 'timing',
};

/**
 * 主判轴的最小参与体系数。
 *
 * 为什么需要：`agreement` 的分母就是 `sampleSize`，所以 n=1 时一致度
 * 必然是 100%、n=2 时必然是 50% 或 100% —— 这不是结论，是算术。
 *
 * 门槛取 3 的依据（实测 9 主题 × 6 轴 = 54 条轴）：
 *   全部轴 n 分布 { min:1, p25:2, median:4, p75:5, max:8 }，n<3 的占 33%；
 *   主判轴 n 分布 { min:1, p25:3, median:5, p75:8, max:8 }，n<3 的只有 1/9。
 * 取 2 会让「变化」轴（n=2、恒 100%）漏进来；取 4 会砍掉「人际」（n=3）
 * 这条好好的主判轴。3 正好只拦下真正该拦的那一条。
 *
 * 注意这是**兜底防线**：主判轴映射（TOPIC_AXIS）已经改到全部 ≥3，
 * 正常不会触发。但轴→体系的结构是内核定的，将来内核增删体系就可能变，
 * 那时这里要能兜住，而不是又输出一次「1 家里 1 家」。
 */
const MIN_SAMPLE = 3;

/** 该主题的「主判轴」——就是那个问题的答案所在的那条轴。 */
export function primaryAxisOf(topic: TopicId): AxisId {
  return TOPIC_AXIS[topic];
}

/** 用户心里那句话 + 三种方向下的「所以呢」 + 该主题的边界。文案一律人话、给后果。 */
interface TopicCopy {
  ask: string;
  dir: { positive: string; negative: string; neutral: string };
  boundary: string;
}

const TOPIC_COPY: Record<TopicId, TopicCopy> = {
  general: {
    ask: '我现在整体是个什么状态？',
    dir: {
      positive: '总体是顺的——该借的力借得上，也没到必须收手的时候。可以把手上的事往前推半步，但别加杠杆。',
      negative: '整体偏耗。不是要出事，是「投入和产出算不平账」。现在最该做的不是加倍努力，是把不产出的事砍掉一件。',
      neutral: '不吉不凶——这种局面下结果主要看你怎么做，努力是有用的。',
    },
    boundary: '这是文化体验式的参照，不是预测，也不构成任何建议。',
  },
  career: {
    ask: '这一步我到底该不该迈？',
    dir: {
      positive: '可以迈，但要用「小步试错」的迈法——先做能退回来的那一步，别一次把身位全压上去。',
      negative: '现在不是迈的时候。八家说的是「先守」，不是「你不行」。把现有的盘子做扎实，等信号变了再说。',
      neutral: '可迈可不迈，取决于你手上有没有「输得起」的余量。有余量就试，没有就先不动。',
    },
    boundary: '事业决策涉及合同、竞业、股权时，请以持证专业人士的意见为准。',
  },
  romance: {
    ask: '这段关系还有没有戏？',
    dir: {
      positive: '有往前走的空间。八家偏向「结盟」——关系里投入是划算的。',
      negative: '八家偏向「独处」。不是让你必须分开，是说现在这段关系里，「在一起」比「各自待着」更消耗你。',
      neutral: '关系本身没有明确信号，走到哪一步取决于谁先动。',
    },
    boundary: '感情里真正要紧的事（安全、边界、尊重），不该由任何盘面替你判断。',
  },
  money: {
    ask: '这段时间财上顺不顺？',
    dir: {
      positive: '偏顺——有得赚。但「顺」不等于「可以赌」，八家给的是机会，不是保证。',
      negative: '偏破耗。现在适合守成：不加仓、不借钱、不碰自己看不懂的东西。',
      neutral: '财上没信号，属于「结果主要看你自己怎么操作」的时段。',
    },
    boundary: '涉及投资、借贷、担保的决定，请咨询持证专业人士；本平台不构成财务建议。',
  },
  move: {
    ask: '该不该动？',
    dir: {
      positive: '宜动。换个环境、换个位置，现在对你是有利的。',
      negative: '宜静。现在动不如不动——把眼下的局面吃透，比换地方划算。',
      neutral: '动或不动都行。别为了「换个地方会好」而动。',
    },
    boundary: '出行与搬迁请结合现实条件（工作、家庭、成本）判断，盘面只作参照。',
  },
  study: {
    ask: '现在该冲还是该稳？',
    dir: {
      positive: '宜进。往前压一段是划算的，重点是把节奏拉起来，不是把时长堆上去。',
      negative: '宜守。先稳住现有的进度，别急着开新战线。',
      neutral: '节奏上没信号，按你自己能扛的负荷安排就行。',
    },
    boundary: '学业安排请以实际时间与精力为准，盘面不替你决定考什么、报哪里。',
  },
  health: {
    ask: '我精神（身体）到底好不好？',
    dir: {
      positive: '偏顺——八家没有看到「要出事」的信号。但请记住：这只是传统模型的说法，不等于体检结论。',
      negative: '偏耗。八家一致的地方是「在透支」——不是病，是在用以后的换现在。',
      neutral: '八家没给方向——这一类问题本身就不在这个模型擅长的范围里。',
    },
    boundary: '健康这一项，八家的意见只能当「提醒你注意」，绝不能当诊断。身体或情绪有持续不适，请去医院。',
  },
  relationship: {
    ask: '这段人际该怎么处？',
    dir: {
      positive: '偏向「结盟」——该走动、该合作，主动开口现在是有利的。',
      negative: '偏向「独处」——现在把精力收回到自己身上，比维护关系划算。',
      neutral: '没明确信号，按你的舒适度来就行。',
    },
    boundary: '人际里的权责与利益分配，请以书面约定为准。',
  },
  timing: {
    ask: '现在这个时机对不对？',
    dir: {
      positive: '宜进。现在是往前推的窗口，拖下去反而会变差。',
      negative: '宜守。现在推不动，硬推只会消耗自己，等一等。',
      neutral: '时机上没有明确信号，成不成主要看准备得够不够。',
    },
    boundary: '时机判断有很强的事后归因倾向，请结合现实条件自行判断。',
  },
};

/** 裁断档位：口径一致 / 有主调 / 没谈拢 */
export type VerdictStance = 'clear' | 'leaning' | 'split';

export interface VerdictSide {
  axis: AxisId;
  dimName: string;
  /** 该轴的倾向词，如「宜静」 */
  lean: string;
  agreement: number;
  sampleSize: number;
  /** 与均值的同向家数（由 agreement × sampleSize 还原） */
  agreeCount: number;
  text: string;
}

export interface TopicVerdict {
  axis: AxisId;
  dimName: string;
  lean: string;
  mean: number;
  agreement: number;
  sampleSize: number;
  agreeCount: number;
  stance: VerdictStance;
  /**
   * 这一条轴到底有没有方向。
   *
   * 必须与 stance 分开：`agreement` 只回答「八家有没有想到一块去」，
   * 而方向由 weightedMean 决定。两者会脱钩 —— 实测健康那次就是
   * 一致度 63%（看着像「有主调」），可真值是**中位**：多数体系都判了 0。
   * 于是「有主调」+「方向是中位」拼在一起，写出了「偏「持平」」这种句子。
   * 「大家一致认为没有方向」和「大家吵起来了」是两件完全不同的事。
   */
  hasDirection: boolean;
  /**
   * 主判轴的参与体系数是否低于门槛（MIN_SAMPLE）。
   *
   * 与 stance 也是分开的：`agreement` 在 n 很小时会「看起来很好」
   * （n=1 必 100%、n=2 必 100% 或 50%），那是算术不是结论。
   * 真实踩点：事业题输出过「口径一致：偏「避险」（1 家里 1 家同向，
   * 一致度 100%）」—— 这一档必须单独说。
   */
  underSampled: boolean;
  /** 用户心里那句话 */
  ask: string;
  /** 大结论：直接回答「可以 / 不可以 / 我答不了」 */
  call: string;
  /** 「所以呢」——落到行为。无方向或打平时，改为交付「能确定的那部分」 */
  so: string;
  boundary: string;
  /** 除主判轴外最一致的一条（有没有值得当依据的共识） */
  consensusItem: VerdictSide | null;
  /** 除主判轴外最散的一条（哪里别当结论用） */
  dissentItem: VerdictSide | null;
}

const sideOf = (c: Consensus): VerdictSide => {
  const word = axisWord(c.axis, c.weightedMean);
  const pct = Math.round(c.agreement * 100);
  // 「倾向「持平」」和「偏「持平」」是同一种病句：持平不是一端，不能"倾向"它。
  // 中位就照实说「多数判在中位」。（真实踩点：事业题首屏的「说得齐」
  // 那条输出过「时机上 80% 一致，倾向「持平」」。）
  const text =
    word === '持平'
      ? `${DIM_NAMES[c.axis]}上多数判在中位（${pct}% 一致）`
      : `${DIM_NAMES[c.axis]}上 ${pct}% 一致，倾向「${word}」`;
  return {
    axis: c.axis,
    dimName: DIM_NAMES[c.axis],
    lean: word,
    agreement: c.agreement,
    sampleSize: c.sampleSize,
    agreeCount: Math.round(c.agreement * c.sampleSize),
    text,
  };
};

/**
 * 从共识数据里裁出「用户那句问题的答案」。
 *
 * 一条硬规则：**主判轴没谈到，就换一条最有话说的轴**，而不是给一句
 * 「暂无数据」——用户已经在结果页了，必须给点什么。
 * 纯函数，不依赖内核，可单测。
 */
export function deriveVerdict(consensus: Consensus[], topic: TopicId): TopicVerdict | null {
  if (consensus.length === 0) return null;

  const wanted = TOPIC_AXIS[topic];
  const primary =
    consensus.find((c) => c.axis === wanted) ??
    [...consensus].sort((a, b) => Math.abs(b.weightedMean) - Math.abs(a.weightedMean))[0];
  if (!primary) return null;

  const copy = TOPIC_COPY[topic];
  const dimName = DIM_NAMES[primary.axis];
  const lean = axisWord(primary.axis, primary.weightedMean);
  const agreeCount = Math.round(primary.agreement * primary.sampleSize);
  const disagreeCount = primary.sampleSize - agreeCount;
  const pct = Math.round(primary.agreement * 100);

  /**
   * 档位阈值。注意这里是 `> 0.5` 而不是 `>= 0.5`：
   * agreement 是「同向家数 / 表态家数」，8 家里 4 家同向正好是 0.5 ——
   * 那正是**打平**（4:4），不是「有个主调」。写成 >= 会把最需要诚实的那一档
   * 说成有结论，而这恰恰是用户最容易当真的一档。
   */
  const stance: VerdictStance =
    primary.agreement >= 0.75 ? 'clear' : primary.agreement > 0.5 ? 'leaning' : 'split';

  const dirKey: 'positive' | 'negative' | 'neutral' =
    primary.weightedMean > 0.3 ? 'positive' : primary.weightedMean < -0.3 ? 'negative' : 'neutral';
  const hasDirection = dirKey !== 'neutral';

  /** 参与表态的体系太少 —— 这时候 agreement 是算术，不是共识 */
  const underSampled = primary.sampleSize < MIN_SAMPLE;

  // 除主判轴外还有话说的轴：参与体系 ≥3 才有资格被单独点名
  const others = consensus.filter((c) => c.axis !== primary.axis && c.sampleSize >= 3);
  const best = [...others].sort((a, b) => b.agreement - a.agreement)[0];
  const worst = [...others].sort((a, b) => a.agreement - b.agreement)[0];
  const consensusItem = best && best.agreement >= 0.6 ? sideOf(best) : null;
  const dissentItem = worst && worst.agreement < 0.6 ? sideOf(worst) : null;

  let call: string;
  if (underSampled) {
    // 最需要诚实的一档：n=1 的一致度必然是 100%、n=2 必然是 50% 或 100%。
    // 说「口径一致」等于拿一家之言冒充八家共识。
    call = `这一项八家里只有 ${primary.sampleSize} 家会表态（其余体系不谈这条轴），样本太少——这个结论我不给你。`;
  } else if (!hasDirection) {
    // 关键分支：「方向是中位」不等于「八家吵起来了」。这里说的是
    // 「大家（多数）都判了中位」，属于一致地"看不出方向"。
    call =
      stance === 'clear'
        ? `八家口径一致：这一项没有明确方向（${primary.sampleSize} 家里 ${agreeCount} 家都判在中位）。`
        : stance === 'leaning'
        ? `多数判在中位（${primary.sampleSize} 家里 ${agreeCount} 家），没有形成明确方向。`
        : `${primary.sampleSize} 家里只有 ${agreeCount} 家同向，方向本身也贴着中位——这一项给不了准话。`;
  } else if (stance === 'split') {
    call = `${primary.sampleSize} 家里 ${agreeCount} 家偏「${lean}」、${disagreeCount} 家不认同（一致度只有 ${pct}%）——这个比例的结论我不给你，给了就是拿噪声当判断。`;
  } else if (stance === 'clear') {
    call = `口径一致：偏「${lean}」（${primary.sampleSize} 家里 ${agreeCount} 家同向，一致度 ${pct}%）。`;
  } else {
    call = `有个主调：偏「${lean}」（${primary.sampleSize} 家里 ${agreeCount} 家同向，一致度 ${pct}%）——是倾向，不是定论。`;
  }

  /**
   * 「所以呢」怎么给：
   *   有方向且没打平 → 给方向对应的行动建议；
   *   其余（打平 / 中位 / 方向不明）→ 主判轴本身没结论，**改为交付能确定的那部分**，
   *   否则这一屏就只剩「我不知道」四个字，等于把用户打发走。
   */
  const yieldToConsensus = stance === 'split' || !hasDirection || underSampled;
  let so: string;
  if (!yieldToConsensus) {
    so = copy.dir[dirKey];
  } else if (consensusItem) {
    const lead = !hasDirection ? copy.dir.neutral : underSampled ? '这一项先搁下——' : '';
    so = `${lead}但有一件八家说得比较齐：${consensusItem.text}——这一条你可以放心拿去用。`;
  } else if (underSampled) {
    so = '这条轴本来就只有少数体系会表态，建议只看下面「六大维度」里一致度高的那几条。';
  } else if (!hasDirection) {
    so = copy.dir.neutral;
  } else {
    so = '八家在这道题上确实各说各话。建议只看下面「六大维度」里一致度高的那几条，其余当参考。';
  }

  return {
    axis: primary.axis,
    dimName,
    lean,
    mean: primary.weightedMean,
    agreement: primary.agreement,
    sampleSize: primary.sampleSize,
    agreeCount,
    stance,
    hasDirection,
    underSampled,
    ask: copy.ask,
    call,
    so,
    boundary: copy.boundary,
    consensusItem,
    dissentItem,
  };
}

/**
 * 总体共识度：所有轴共识度的平均值，0..1。
 * 给结果墙顶部一个总览徽章用。纯函数，无副作用。
 */
export function overallAgreement(consensus: Consensus[]): number {
  if (consensus.length === 0) return 0;
  return consensus.reduce((s, c) => s + c.agreement, 0) / consensus.length;
}

export type { AxisId, Consensus, TopicId };
