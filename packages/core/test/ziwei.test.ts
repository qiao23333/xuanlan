/**
 * 紫微回归护栏。
 *
 * 两组断言，缺一不可：
 * 1. **正确性** —— 本命盘黄金用例，锁死命宫地支 / 主星 / 大限起运。
 *    在降载之前这些字段没有任何回归保护：盘面算错了测试也不会红。
 * 2. **性能与体积** —— 防止有人把 calculateZiweiChart 的 7 个运限 scope
 *    加回来而不自知。那会让单次排盘从 ~50ms 退回 ~24s、数据从 ~9KB 涨到 ~1.6MB。
 *    阈值刻意留了 20 倍以上余量，宁可漏报也不误报。
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateAll } from '../src/index.ts';
import { ZIWEI_GOLDEN } from './fixtures.ts';
import type { CalculateResult } from '../src/adapters/index.ts';

interface ZiweiData {
  astrolabe?: {
    palaces?: Array<{
      name?: string;
      earthlyBranch?: string;
      decadal?: { range?: [number, number] };
      majorStars?: Array<{ name?: string; brightness?: string }>;
    }>;
    palace?: (name: string) => {
      earthlyBranch?: string;
      decadal?: { range?: [number, number] };
      majorStars?: Array<{ name?: string; brightness?: string }>;
    };
  };
}

const QUESTION = {
  topicId: 'general' as const,
  askedAt: { year: 2026, month: 9, day: 3, hour: 14, minute: 0, second: 0 },
};

function ziweiData(r: CalculateResult): ZiweiData {
  const chart = r.charts.find((c) => c.systemId === 'ziwei');
  assert.ok(chart, '紫微体系必须产出结果');
  return chart.data as ZiweiData;
}

test('紫微本命盘黄金用例：命宫地支 / 主星 / 大限起运', async () => {
  for (const c of ZIWEI_GOLDEN) {
    const r = await calculateAll(c.profile, {
      systems: ['ziwei'],
      config: { ziwei: { algorithm: c.algorithm ?? 'default' } },
      question: QUESTION,
    });
    assert.equal(r.failed.length, 0, `${c.tag} 不应失败：${r.failed.map((f) => f.message).join('; ')}`);

    const data = ziweiData(r);
    const ming = data.astrolabe?.palace?.('命宫');
    assert.ok(ming, `${c.tag} 取不到命宫`);

    assert.equal(ming.earthlyBranch, c.expectedMingBranch, `${c.tag} 命宫地支不符`);

    const stars = (ming.majorStars ?? []).map((s) => `${s.name}(${s.brightness})`);
    assert.deepEqual(stars, c.expectedMingStars, `${c.tag} 命宫主星不符`);

    assert.deepEqual(
      ming.decadal?.range ?? null,
      c.expectedMingDecadal,
      `${c.tag} 命宫大限起运不符`
    );
  }
});

test('紫微必须给出完整十二宫', async () => {
  const r = await calculateAll(ZIWEI_GOLDEN[0]!.profile, { systems: ['ziwei'], question: QUESTION });
  const palaces = ziweiData(r).astrolabe?.palaces ?? [];
  assert.equal(palaces.length, 12, '紫微必须有 12 个宫位');
  assert.ok(
    palaces.some((p) => p.name === '命宫'),
    '十二宫中必须含命宫'
  );
});

test('紫微空宫样本不得被当成失败（早子时命宫无主星）', async () => {
  const emptyCase = ZIWEI_GOLDEN.find((c) => c.expectedMingStars.length === 0);
  assert.ok(emptyCase, 'fixtures 中必须保留一个空宫样本');
  const r = await calculateAll(emptyCase.profile, { systems: ['ziwei'], question: QUESTION });
  const ming = ziweiData(r).astrolabe?.palace?.('命宫');
  assert.ok(ming, '空宫样本也必须能取到命宫');
  assert.equal((ming.majorStars ?? []).length, 0, '该样本命宫应无主星');
});

test('【性能护栏】紫微单次排盘耗时上限', async () => {
  // 预热，排除首次 import / JIT 成本
  await calculateAll(ZIWEI_GOLDEN[0]!.profile, { systems: ['ziwei'], question: QUESTION });

  const s = performance.now();
  await calculateAll(ZIWEI_GOLDEN[0]!.profile, { systems: ['ziwei'], question: QUESTION });
  const ms = performance.now() - s;

  console.log(`  紫微单次 ${ms.toFixed(0)} ms`);
  // 当前实测 ~50ms；若误用 calculateZiweiChart 全量会回到 20000ms+。阈值取 2000ms。
  assert.ok(
    ms < 2000,
    `紫微单次耗时 ${ms.toFixed(0)}ms 超过 2000ms 上限。` +
      `极可能是不小心改回了 calculateZiweiChart 的 7 scope 全量计算。`
  );
});

test('【体积护栏】紫微不得携带无人消费的运限 payload', async () => {
  const r = await calculateAll(ZIWEI_GOLDEN[0]!.profile, { systems: ['ziwei'], question: QUESTION });
  const chart = r.charts.find((c) => c.systemId === 'ziwei')!;

  // 这三个字段没有任何消费方，出现即说明又在全量算
  for (const ghost of ['payloadByScope', 'decadalTimeline', 'horoscope']) {
    assert.ok(
      !(ghost in (chart.data as Record<string, unknown>)),
      `紫微 data 不应包含 ${ghost}：本平台只消费本命盘，它没有任何消费方`
    );
  }

  const bytes = Buffer.byteLength(JSON.stringify(chart.data), 'utf8');
  console.log(`  紫微 data 体积 ${(bytes / 1024).toFixed(0)} KB`);
  // 当前实测 ~9KB；全量计算时约 1600KB。阈值取 200KB。
  assert.ok(bytes < 200 * 1024, `紫微 data 体积 ${(bytes / 1024).toFixed(0)}KB 超过 200KB 上限`);
});

test('【性能护栏】八体系全量排盘耗时上限', async () => {
  await calculateAll(ZIWEI_GOLDEN[0]!.profile, { question: QUESTION }); // 预热

  const s = performance.now();
  const r = await calculateAll(ZIWEI_GOLDEN[0]!.profile, { question: QUESTION });
  const ms = performance.now() - s;

  console.log(`  八体系全量 ${ms.toFixed(0)} ms`);
  assert.equal(r.charts.length, 8, '八体系都应出结果');
  // 当前实测 ~150ms（紫微降载前为 ~30000ms）。阈值取 3000ms。
  assert.ok(ms < 3000, `八体系全量耗时 ${ms.toFixed(0)}ms 超过 3000ms 上限`);
});
