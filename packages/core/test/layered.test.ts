import assert from 'node:assert';
import { test } from 'node:test';
import { aggregateConsensus, aggregateConsensusByLayer, readCrossLayerGap, axisWord } from '../src/consensus.ts';
import { calculateAll } from '../src/index.ts';
import { createSeededRandom } from 'mingyu-core/random';
import type { Assertion, SystemId } from '../src/types.ts';

function a(systemId: SystemId, axis: Assertion['axis'], score: number, confidence = 1): Assertion {
  return { systemId, schoolId: 'default', topicId: 'general', axis, score, confidence, evidence: ['测试'] } as Assertion;
}

describe_compat();

function describe_compat() {
  test('分层：命盘层与卜卦层各算各的，不再一锅炖', () => {
    const input = [
      // 命盘层：八字 / 紫微 / 占星 —— 全部偏「宜守」
      a('bazi', 'timing', -2),
      a('ziwei', 'timing', -1),
      a('astrolabe', 'timing', -1),
      // 卜卦层：塔罗 / 梅花 —— 全部偏「宜进」
      a('tarot', 'timing', 2),
      a('meihua', 'timing', 1),
    ];
    const L = aggregateConsensusByLayer(input);

    const chart = L.chart.find((c) => c.axis === 'timing');
    const div = L.divination.find((c) => c.axis === 'timing');
    const mixed = L.all.find((c) => c.axis === 'timing');

    assert.ok(chart && div && mixed);
    // 分层后两层各自内部是「高度一致」的
    assert.strictEqual(chart.agreement, 1);
    assert.strictEqual(div.agreement, 1);
    // 混算则是一个抹平一切的假平均数（约 -0.2），看不出任何一层的真实倾向
    assert.ok(Math.abs(mixed.weightedMean) < Math.abs(chart.weightedMean));
    assert.ok(Math.abs(mixed.weightedMean) < Math.abs(div.weightedMean));
    // 这正是必须分层的理由：混算把两层的方向都吃掉了
    assert.ok(chart.weightedMean < -1);
    assert.ok(div.weightedMean > 1);
  });

  test('跨层错位：方向相反的点名出来，按距离降序', () => {
    const input = [
      a('bazi', 'timing', -2),
      a('tarot', 'timing', 2),
      a('bazi', 'risk', -1),
      a('tarot', 'risk', 0.5),
    ];
    const L = aggregateConsensusByLayer(input);
    assert.strictEqual(L.crossLayerGaps.length, 2);
    const g1 = L.crossLayerGaps[0]!;
    const g2 = L.crossLayerGaps[1]!;
    assert.strictEqual(g1.axis, 'timing'); // 距离 4，最大
    assert.strictEqual(g2.axis, 'risk'); // 距离 1.5
    assert.strictEqual(g1.chartDir, -1);
    assert.strictEqual(g1.divinationDir, 1);
    assert.ok(g1.distance > g2.distance);
  });

  test('两层同向且差异很小时不点名（避免噪声刷屏）', () => {
    const input = [a('bazi', 'timing', -1), a('tarot', 'timing', -0.8)];
    const L = aggregateConsensusByLayer(input);
    assert.strictEqual(L.crossLayerGaps.length, 0);
  });

  test('只有单层表态时不产生错位', () => {
    const L = aggregateConsensusByLayer([a('bazi', 'timing', -2), a('ziwei', 'timing', -1)]);
    assert.strictEqual(L.divination.length, 0);
    assert.strictEqual(L.crossLayerGaps.length, 0);
    assert.strictEqual(L.chart.length, 1);
  });

  test('readCrossLayerGap：反向与同向给出不同读法，且不出现「综合取中间」', () => {
    const L = aggregateConsensusByLayer([a('bazi', 'timing', -2), a('tarot', 'timing', 2)]);
    const text = readCrossLayerGap(L.crossLayerGaps[0]!);
    assert.ok(text.includes('底色偏'));
    assert.ok(text.includes('留退路'));
    assert.ok(!text.includes('取中间'));

    const L2 = aggregateConsensusByLayer([a('bazi', 'risk', -0.2), a('tarot', 'risk', -1.5)]);
    const t2 = readCrossLayerGap(L2.crossLayerGaps[0]!);
    assert.ok(t2.includes('力度'));
  });

  test('axisWord 按方向取词，0 取「持平」', () => {
    assert.strictEqual(axisWord('timing', -1), '宜守');
    assert.strictEqual(axisWord('timing', 1), '宜进');
    assert.strictEqual(axisWord('timing', 0), '持平');
  });

  test('真实排盘：分层结果与混算不同，且老函数 aggregateConsensus 行为未变', async () => {
    const profile = {
      gender: 'male' as const,
      calendarType: 'solar' as const,
      year: 1990,
      month: 5,
      day: 15,
      hour: 14,
      minute: 30,
      location: { name: '北京', longitude: 116.4, latitude: 39.9, timezone: 8 },
    };
    const result = await calculateAll(profile, {
      question: {
        text: '今年适合换工作吗',
        topicId: 'career',
        askedAt: { year: 2026, month: 9, day: 11, hour: 15, minute: 0, second: 0 },
      },
      random: createSeededRandom(12345),
    });
    const assertions = result.charts.flatMap((c) => c.assertions);
    const L = aggregateConsensusByLayer(assertions);

    // 两层都必须有内容，否则说明分类映射写错了
    assert.ok(L.chart.length > 0, '命盘层不应为空');
    assert.ok(L.divination.length > 0, '卜卦层不应为空');
    // 老函数不受影响
    assert.deepStrictEqual(L.all, aggregateConsensus(assertions));
    // 两层样本数之和 = 全层样本数（同轴上）
    for (const c of L.chart) {
      const d = L.divination.find((x) => x.axis === c.axis);
      const m = L.all.find((x) => x.axis === c.axis);
      assert.ok(m);
      assert.strictEqual(c.sampleSize + (d?.sampleSize ?? 0), m.sampleSize);
    }
  });
}
