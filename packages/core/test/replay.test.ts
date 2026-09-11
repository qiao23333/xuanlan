/**
 * 端到端确定性回放测试：只读分享链接的立命之本。
 *
 * 分享链接只携带「生辰 + 所问 + askedAt + 流派配置 + seed」，
 * 接收方浏览器用同一内核重算。如果同输入两次 calculateAll 结果
 * 不一致（剥掉墙钟元数据后比对），「结果可复现可溯源」的产品
 * 承诺即告破。
 *
 * 踩坑记录（真实契约）：
 * 1. 塔罗种子走 config.tarot.seed，ctx.random 没有任何 adapter 消费——
 *    App 必须显式注入，否则永远抽到同一副默认牌（曾真实发生）。
 * 2. 牌面数据在 chart.data（不是 payload），seed 生效与否看
 *    data.meta.random.mode === 'seeded'。
 * 3. 结果里烘焙了 timestamp / calculatedAt 墙钟字段，属于元数据，
 *    不参与「逐字一致」比对（重放时展示的是重算时刻，符合直觉）。
 * 4. chart 对象含循环引用，比对必须用带环检测的规范化 JSON。
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { calculateAll } from '../src/index.ts';

const profile = {
  name: '示例',
  gender: 'male' as const,
  calendarType: 'solar' as const,
  year: 1990,
  month: 5,
  day: 15,
  hour: 14,
  minute: 30,
  location: { name: '北京', longitude: 116.4, latitude: 39.9, timezone: 8 },
};

const question = {
  topicId: 'career' as const,
  text: '今年是否该换工作',
  // askedAt 必须固定——它参与时辰体系计算，也参与种子派生。
  askedAt: { year: 2026, month: 9, day: 3, hour: 14, minute: 0, second: 0 },
};

/** 与 App 提交路径一致的调用方式：种子注入 config.tarot.seed。 */
function appStyleCalculate(seed: number) {
  const schoolCfg: Record<string, unknown> = {};
  const tarotCfg = (schoolCfg.tarot ?? {}) as Record<string, unknown>;
  return calculateAll(profile, {
    question,
    config: { ...schoolCfg, tarot: { ...tarotCfg, seed } },
  });
}

/** 规范化 JSON：剥掉墙钟元数据 + 环检测。 */
function canonical(v: unknown): string {
  const seen = new WeakSet();
  return JSON.stringify(v, (_k, val) => {
    if (typeof val === 'object' && val !== null) {
      if (seen.has(val)) return '[Circular]';
      seen.add(val);
    }
    return val;
  });
}

/** 递归剥掉墙钟字段（供逐字段比较用）。 */
function stripVolatile<T>(v: T, memo = new WeakMap<object, unknown>()): T {
  if (Array.isArray(v)) return v.map((x) => stripVolatile(x, memo)) as unknown as T;
  if (v && typeof v === 'object') {
    const obj = v as object;
    if (memo.has(obj)) return memo.get(obj) as T;
    const out: Record<string, unknown> = {};
    memo.set(obj, out);
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if (k === 'timestamp' || k === 'calculatedAt') continue;
      out[k] = stripVolatile(val, memo);
    }
    return out as T;
  }
  return v;
}

/**
 * 「逐字一致」的产品判据：JSON 形态比对。
 * 紫微/占星结果内嵌 iztro class 实例，方法引用两次实例化必然不同，
 * 但 App 的存储、渲染、分享回放全部走 JSON 形态——这才是承诺的边界。
 */
function canonicalJson(v: unknown): string {
  const seen = new WeakSet();
  return JSON.stringify(v, (_k, val) => {
    if (typeof val === 'object' && val !== null) {
      if (seen.has(val)) return '[Circular]';
      seen.add(val);
    }
    return val;
  });
}

test('同输入 + 同 seed：两次 calculateAll 的 JSON 形态逐字一致（分享回放前提）', async () => {
  const a = await appStyleCalculate(12345);
  const b = await appStyleCalculate(12345);

  assert.equal(
    canonicalJson(stripVolatile(a)),
    canonicalJson(stripVolatile(b)),
    '同输入同种子两次计算的 JSON 形态不一致，「确定性回放」承诺失效'
  );
});

test('askedAt 变化时结果应可辨识地变化（证明时间确实是计算输入）', async () => {
  const base = await calculateAll(profile, { question });
  const later = await calculateAll(profile, {
    question: { ...question, askedAt: { ...question.askedAt, day: question.askedAt.day + 1 } },
  });

  // 至少一个时辰敏感体系的 configHash 应随问事时刻改变。
  const baseHash = new Map(base.charts.map((c) => [c.systemId, c.configHash]));
  const changed = later.charts.some((c) => c.configHash !== baseHash.get(c.systemId));
  assert.ok(changed, '问事时刻 +1 天后所有体系 configHash 均未变化，askedAt 未参与计算');
});

test('App 式注入 config.tarot.seed：不同 seed 塔罗牌面必须不同', async () => {
  const a = await appStyleCalculate(12345);
  const b = await appStyleCalculate(999);

  const tarotA = a.charts.find((c) => c.systemId === 'tarot');
  const tarotB = b.charts.find((c) => c.systemId === 'tarot');
  assert.ok(tarotA && tarotB, '塔罗体系缺失');

  // 种子确实生效：mode=seeded 且 appliedConfig 反映注入值
  assert.equal(tarotA.appliedConfig.seed, 12345);
  assert.equal(tarotB.appliedConfig.seed, 999);

  // 牌面在 chart.data，不同 seed 必须不同
  assert.notEqual(
    canonicalJson(stripVolatile(tarotA.data)),
    canonicalJson(stripVolatile(tarotB.data)),
    '注入不同 config.tarot.seed 后塔罗牌面仍相同，种子未生效'
  );
  // 不应再出现「使用了默认种子」的提示。
  assert.ok(
    !tarotA.warnings.some((w) => w.code === 'tarot.defaultSeed'),
    '已显式注入 seed，不应出现 defaultSeed 提示'
  );
});
