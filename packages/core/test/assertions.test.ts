import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateAll } from '../src/index.ts';
import { aggregateConsensus, overallAgreement } from '../src/index.ts';
import { AXIS_IDS, type Assertion } from '../src/types.ts';

const profile = {
  name: '测试', gender: 'male' as const, calendarType: 'solar' as const,
  year: 1990, month: 5, day: 15, hour: 14, minute: 30,
  location: { name: '北京', longitude: 116.41, latitude: 39.9, timezone: 8 },
};
const opt = { question: { topicId: 'general' as const, askedAt: { year: 2026, month: 8, day: 31, hour: 12, minute: 0, second: 0 } } };

test('8 体系全部产出非空断言与解读', async () => {
  const r = await calculateAll(profile, opt);
  assert.equal(r.charts.length, 8, '应有 8 个体系');
  for (const c of r.charts) {
    assert.ok(c.assertions.length > 0, `${c.systemId} 断言为空`);
    assert.ok(c.interpretation, `${c.systemId} 缺解读层`);
    assert.ok(c.interpretation!.summary.length > 0, `${c.systemId} 解读无总览`);
    assert.ok(c.interpretation!.highlights.length > 0, `${c.systemId} 解读无指标卡`);
  }
});

test('断言 score 合法且落在 [-2,2] 半步网格', async () => {
  const r = await calculateAll(profile, opt);
  const all = r.charts.flatMap((c) => c.assertions);
  assert.ok(all.length >= 12, `断言总数应≥12，实得 ${all.length}`);
  for (const a of all) {
    assert.ok(a.score >= -2 && a.score <= 2, `score 越界 ${a.systemId} ${a.score}`);
    assert.ok(Math.abs((a.score * 2) % 1) < 1e-9, `score 非半步网格 ${a.systemId} ${a.score}`);
    assert.ok((AXIS_IDS as readonly string[]).includes(a.axis), `非法轴 ${a.axis}`);
    assert.ok(a.evidence.length > 0, `${a.systemId} 断言无依据`);
  }
});

test('共识聚合：同向加权均值与共识度计算正确', () => {
  const a: Assertion[] = [
    { systemId: 'bazi', schoolId: 'b', topicId: 'general', axis: 'change', score: 1, confidence: 0.5, evidence: ['x'] },
    { systemId: 'ziwei', schoolId: 'z', topicId: 'general', axis: 'change', score: 1.5, confidence: 0.5, evidence: ['y'] },
    { systemId: 'qimen', schoolId: 'q', topicId: 'general', axis: 'change', score: -1, confidence: 1, evidence: ['z'] },
  ];
  const out = aggregateConsensus(a);
  const change = out.find((c) => c.axis === 'change')!;
  // 加权均值 = (1*0.5+1.5*0.5-1*1)/(0.5+0.5+1) = (0.5+0.75-1)/2 = 0.125（保留精度，不取整）
  assert.ok(Math.abs(change.weightedMean - 0.125) < 1e-9, `加权均值应为 0.125，实得 ${change.weightedMean}`);
  assert.equal(change.sampleSize, 3);
  // 同向（>=0）比例 = 2/3
  assert.ok(Math.abs(change.agreement - 2 / 3) < 1e-9, `共识度应为 2/3`);
  // 偏离 >1.0 的离群：末传 qimen(-1) 偏离 0.5+1=1.5>1 → 是离群
  assert.ok(change.outliers.some((o) => o.systemId === 'qimen'), 'qimen 应被标为分歧');
});

test('共识聚合：无断言的轴不出现', () => {
  const a: Assertion[] = [
    { systemId: 'bazi', schoolId: 'b', topicId: 'general', axis: 'auspicious', score: 1, confidence: 1, evidence: ['x'] },
  ];
  const out = aggregateConsensus(a);
  assert.equal(out.length, 1);
  assert.equal(out[0]!.axis, 'auspicious');
});

test('共识聚合：完全一致时共识度=1 且无离群', () => {
  const a: Assertion[] = [
    { systemId: 'bazi', schoolId: 'b', topicId: 'general', axis: 'risk', score: -1, confidence: 1, evidence: ['x'] },
    { systemId: 'ziwei', schoolId: 'z', topicId: 'general', axis: 'risk', score: -1.5, confidence: 1, evidence: ['y'] },
  ];
  const out = aggregateConsensus(a);
  const risk = out.find((c) => c.axis === 'risk')!;
  assert.equal(risk.agreement, 1);
  assert.equal(risk.outliers.length, 0);
});

test('overallAgreement 取各轴均值', () => {
  const c = aggregateConsensus([
    { systemId: 'bazi', schoolId: 'b', topicId: 'general', axis: 'auspicious', score: 1, confidence: 1, evidence: ['x'] },
    { systemId: 'ziwei', schoolId: 'z', topicId: 'general', axis: 'auspicious', score: 1, confidence: 1, evidence: ['y'] },
    { systemId: 'qimen', schoolId: 'q', topicId: 'general', axis: 'action', score: 2, confidence: 1, evidence: ['z'] },
  ]);
  // auspicious 一致(1.0) + action 单一样本(1.0) → 均值 1.0
  assert.equal(overallAgreement(c), 1);
});
