import type { SystemId, SystemMeta } from './types.ts';

/**
 * 体系顺序。**刻意在此内联，不 import adapters**。
 *
 * 原因：adapters 会连带 iztro、mingyu-core 等体积近 2MB 的算法库。
 * 若本文件 import 它，那么任何只想显示「八字」「塔罗」这类中文名的组件
 * 都会把整个内核拖进首屏 —— 用户还没点开始推演，就先下载了全部算法。
 * 这里保持零依赖，前端才能安全地静态 import SYSTEM_META。
 *
 * 唯一代价：新增体系时要记得同步这份列表。adapters 那份是运行时权威源，
 * 由 assertions.test 中的「两份体系顺序必须一致」用例兜底。
 */
export const ALL_SYSTEMS: readonly SystemId[] = [
  'bazi',
  'ziwei',
  'qimen',
  'liuren',
  'xiaoliuren',
  'meihua',
  'astrolabe',
  'tarot',
] as const;

/**
 * 体系元数据注册表。
 *
 * 这份数据的用途不止是「显示名字」：
 * - schools      → 驱动 UI 自动生成流派开关，不硬编码在页面里
 * - knownDivergences → 「流派 diff 视图」的素材
 * - limitations  → 科普层的诚实边界，写死在代码里而非运营文案里
 *
 * 所有 switchable: false 的档位都是实测确认底层库不支持的，
 * 不是「还没做」。UI 必须置灰并说明，不能假装能切。
 */
export const SYSTEM_META: Record<SystemId, SystemMeta> = {
  bazi: {
    id: 'bazi',
    name: '四柱八字',
    category: 'chart',
    requiresBirthProfile: true,
    requiresRandom: false,
    schools: [
      {
        key: 'bazi.dayBoundary',
        label: '子时换日口径',
        default: 'zhengZi',
        switchable: false,
        options: [
          { value: 'zhengZi', label: '正子时', note: '23:00 起算次日' },
          { value: 'zaoZi', label: '早子时', note: '00:00 起算次日' },
        ],
      },
      {
        key: 'bazi.yongshen',
        label: '用神取法',
        default: 'tiaohou',
        switchable: false,
        options: [
          { value: 'tiaohou', label: '调候', note: '《穷通宝鉴》寒暖燥湿' },
          { value: 'fuyi', label: '扶抑', note: '《子平真诠》旺衰平衡' },
          { value: 'tongguan', label: '通关', note: '两神对峙取中介' },
        ],
      },
    ],
    summary: '以出生年、月、日、时的干支共八个字，推排十神、大运与流年，观察五行生克制化的结构。',
    knownDivergences: [
      '早晚子时换日：23:00–01:00 出生，日柱可能相差一位（已实测：2000-12-31 23:59 广州）',
      '真太阳时是否启用：东西部可差 2 小时以上，直接改变日柱时柱',
      '用神取法：调候、扶抑、通关三派常给出不同喜忌',
      '格局派 vs 旺衰派 vs 盲派：判读路径不同，排盘相同',
    ],
    limitations: [
      '早晚子时与用神取法底层库不支持切换，仅记录用户选择',
      '神煞口径各书不一，本平台采用底层库默认表',
    ],
  },

  ziwei: {
    id: 'ziwei',
    name: '紫微斗数',
    category: 'chart',
    requiresBirthProfile: true,
    requiresRandom: false,
    schools: [
      {
        key: 'ziwei.algorithm',
        label: '安星口径',
        default: 'default',
        switchable: true,
        options: [
          { value: 'default', label: '传统通行', note: '通用安星法' },
          { value: 'zhongzhou', label: '中州派', note: '安星次序与四化有别' },
        ],
      },
    ],
    summary: '以命宫为主、身宫为辅，将百余颗星曜布于十二宫位，用四化（禄权科忌）观察变化线索。',
    knownDivergences: [
      '中州派 vs 传统通行的安星次序',
      '三合派 vs 四化派 vs 飞星派：判读体系差异远大于排盘差异',
      '闰月出生的排法',
      '流年斗君起法',
    ],
    limitations: [
      '四化飞星与自化需自研，底层库不支持，当前不开放',
      '排盘层仅提供 2 档安星口径',
    ],
  },

  qimen: {
    id: 'qimen',
    name: '奇门遁甲',
    category: 'divination',
    requiresBirthProfile: false,
    requiresRandom: false,
    schools: [
      {
        key: 'qimen.method',
        label: '排法',
        default: 'zhuanpan',
        switchable: true,
        options: [
          { value: 'zhuanpan', label: '转盘', note: '星门神随局旋转' },
          { value: 'feipan', label: '飞盘', note: '按九宫飞布' },
        ],
      },
      {
        key: 'qimen.juMethod',
        label: '定局法',
        default: 'chaibu',
        switchable: true,
        options: [
          { value: 'chaibu', label: '拆补法', note: '符头拆补定局' },
          { value: 'zhirun', label: '置闰法', note: '超神接气置闰' },
        ],
      },
      {
        key: 'qimen.scope',
        label: '起局层级',
        default: 'hour',
        switchable: true,
        options: [
          { value: 'year', label: '年家奇门' },
          { value: 'month', label: '月家奇门' },
          { value: 'day', label: '日家奇门' },
          { value: 'hour', label: '时家奇门', note: '最常用' },
        ],
      },
    ],
    summary: '以太乙九宫为盘，布天盘（九星）、地盘（九宫）、人盘（八门）、神盘（八神），按时家或年月日家起局判断方位与时机的宜忌。',
    knownDivergences: [
      '置闰法 vs 拆补法：大雪、冬至前后定局可能不同（本平台已实测支持切换）',
      '转盘 vs 飞盘：星门神落宫规则根本不同',
      '中宫寄二宫 vs 寄八宫',
      '茅山道人定局法：本平台未实现',
    ],
    limitations: ['未实现茅山道人定局法', '中宫寄宫规则采用底层库默认值'],
  },

  liuren: {
    id: 'liuren',
    name: '大六壬',
    category: 'divination',
    requiresBirthProfile: false,
    requiresRandom: false,
    schools: [],
    summary: '以月将加占时立天地盘，经四课取三传，配合天将与课体判断事态的来龙去脉。三式之一，以推演严密著称。',
    knownDivergences: [
      '月将过宫：节气换将 vs 中气换将',
      '贵人起法与昼夜贵人分界时刻',
      '九宗门取传的优先级顺序',
    ],
    limitations: [
      '已与 liuren-ts-lib 独立实现交叉对拍 7 组样本，三传、天将、课体、月将全部一致',
      '断课依赖大量口诀与师传经验，本平台只给结构化事实（课体、三传、旺衰、旬空），不给结论性断语',
    ],
  },

  xiaoliuren: {
    id: 'xiaoliuren',
    name: '小六壬',
    category: 'divination',
    requiresBirthProfile: false,
    requiresRandom: false,
    schools: [],
    summary: '六个宫位（大安、留连、速喜、赤口、小吉、空亡）按农历月、日、时逐宫顺数，以时宫为占。',
    knownDivergences: ['掌诀顺行方向', '六神名称在各地流传中略有差异'],
    limitations: [
      '底层库明确声明：作者及「李淳风」署名暂无可靠版本学证据',
      '闰月沿用同名月序；农历日按东八区民用日零点换日 —— 此为有分歧的历法边界，非唯一传统口径',
    ],
  },

  meihua: {
    id: 'meihua',
    name: '梅花易数',
    category: 'divination',
    requiresBirthProfile: false,
    requiresRandom: true,
    schools: [
      {
        key: 'meihua.method',
        label: '起卦法',
        default: 'time',
        switchable: false,
        options: [
          { value: 'time', label: '时间卦', note: '以年月日时数起卦' },
          { value: 'number', label: '数字卦', note: '需提供两个数字' },
          { value: 'random', label: '随机卦', note: '需注入随机源' },
        ],
      },
    ],
    summary: '以数起卦，得本卦、互卦、变卦，以体卦为问卦者、用卦为所问之事，观五行生克与卦象比和。',
    knownDivergences: ['先天八卦数 vs 后天八卦数取数', '体用的取法在不同传本中不一致', '是否参看爻辞'],
    limitations: [
      'MVP 仅开放时间卦；数字卦与随机卦需要外部输入通道，未提供时明确降级而非静默改用时间卦',
      '解卦高度依赖「触机外应」，这是算法无法复现的部分',
    ],
  },

  astrolabe: {
    id: 'astrolabe',
    name: '西洋本命占星',
    category: 'chart',
    requiresBirthProfile: true,
    requiresRandom: false,
    schools: [
      {
        key: 'astro.houses',
        label: '分宫制',
        default: 'placidus',
        switchable: false,
        options: [
          { value: 'placidus', label: 'Placidus', note: '当前唯一可用' },
          { value: 'whole', label: 'Whole Sign 整宫制', note: '二期提供' },
          { value: 'koch', label: 'Koch', note: '二期提供' },
        ],
      },
      {
        key: 'astro.zodiac',
        label: '黄道基准',
        default: 'tropical',
        switchable: false,
        options: [
          { value: 'tropical', label: '回归黄道', note: '以春分点为 0° 白羊' },
          { value: 'sidereal', label: '恒星黄道', note: '吠陀占星采用，需岁差修正' },
        ],
      },
    ],
    summary: '以出生时刻与地点计算十大行星、四轴与十二宫位，用相位（合冲刑拱等）观察各行星之间的张力与呼应。',
    knownDivergences: [
      '分宫制：Placidus / Whole Sign / Koch / Regiomontanus 等二十余种，行星落宫可完全不同',
      '回归黄道 vs 恒星黄道：岁差导致约 24° 偏移，几乎人人太阳星座可能不同',
      '相位容许度：各派从 ±3° 到 ±10° 不等',
    ],
    limitations: [
      '底层库硬编码 Placidus 分宫制，无切换参数（实测确认，非未完成）',
      '恒星黄道与吠陀占星（Ayanamsa 修正）需二期引入星历库后实现',
      '极圈（纬度 > 66.5°）内 Placidus 数学上失效，底层库既不报错也不降级，由内核补警告',
    ],
  },

  tarot: {
    id: 'tarot',
    name: '塔罗',
    category: 'divination',
    requiresBirthProfile: false,
    requiresRandom: true,
    schools: [
      {
        key: 'tarot.spread',
        label: '牌阵',
        default: 'three',
        switchable: true,
        options: [
          { value: 'single', label: '单牌指引' },
          { value: 'three', label: '时间流', note: '过去 / 现在 / 未来' },
          { value: 'love', label: '爱情牌阵' },
          { value: 'career', label: '事业牌阵' },
          { value: 'decision', label: '选择牌阵' },
        ],
      },
      {
        key: 'tarot.reversed',
        label: '使用逆位',
        default: 'true',
        switchable: true,
        options: [
          { value: 'true', label: '使用逆位' },
          { value: 'false', label: '仅正位' },
        ],
      },
    ],
    summary: '78 张牌中按牌阵抽牌，以牌义与牌位组合提供思考框架。韦特体系为当前主流。',
    knownDivergences: ['韦特 / 马赛 / 透特三大体系的牌义差异', '是否使用逆位', '牌阵位置的定义'],
    limitations: [
      '抽牌是随机过程，本平台仅保证同 seed 可复现；底层库原话：seed 或 replay 只证明过程可重放，不证明预测有效性',
      '牌义库采用韦特体系，与马赛、透特体系的牌义并不通用',
    ],
  },
};

export function getSystemMeta(id: SystemId): SystemMeta | undefined {
  return SYSTEM_META[id];
}

export function listSystemMeta(): SystemMeta[] {
  return ALL_SYSTEMS.map((id) => SYSTEM_META[id]).filter(Boolean);
}
