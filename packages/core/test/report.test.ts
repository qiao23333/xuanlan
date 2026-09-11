import assert from 'node:assert/strict';
import test from 'node:test';
import { synthesizeReport } from '../src/index.ts';
import type { Consensus } from '../src/types.ts';
import type { CalculateResult } from '../src/adapters/index.ts';
import type { SynthesisReport } from '../src/index.ts';

// 最小可驱动 synthesizeReport 的 result 形态（只读 charts[].interpretation.highlights）
const result = {
  charts: [
    {
      systemId: 'bazi' as const,
      interpretation: {
        summary: ['日主庚金，身强'],
        highlights: [{ label: '日主', value: '庚金（阳）', term: '日主' }],
        timeline: [],
      },
    },
  ],
} as unknown as CalculateResult;

const consensus: Consensus[] = [
  { axis: 'action', weightedMean: 1.0, agreement: 1, outliers: [], sampleSize: 3 },
  {
    axis: 'risk',
    weightedMean: -1.5,
    agreement: 0.5,
    outliers: [
      { systemId: 'tarot', schoolId: 'default', topicId: 'general', axis: 'risk', score: 2, confidence: 1, evidence: [] },
    ],
    sampleSize: 2,
  },
];

// 注意：第三参是 { topic, question } 对象，不是裸字符串。
// 早期版本曾写成 synthesizeReport(result, consensus, 'career')，
// 那会让 opts.topic 静默变成 undefined —— 测试看似通过，实则从未覆盖 topic。
test('synthesizeReport 高共识给出「高度一致」头条', () => {
  const r: SynthesisReport = synthesizeReport(result, consensus, { topic: 'career' });
  assert.equal(r.topic, 'career', 'topic 必须透传到报告上');
  assert.ok(r.headline.includes('高度一致'), 'overall=0.75 应命中高共识分支');
  assert.equal(r.byAxis.length, 2);
  const firstAxis = r.byAxis[0];
  const secondAxis = r.byAxis[1];
  assert.ok(firstAxis);
  assert.ok(secondAxis);
  assert.equal(firstAxis.direction, 'positive');
  assert.equal(secondAxis.direction, 'negative');
  assert.equal(secondAxis.outliers[0], 'tarot');
});

test('synthesizeReport 回填用户原文问题', () => {
  const r: SynthesisReport = synthesizeReport(result, consensus, {
    topic: 'career',
    question: '  今年该不该换工作  ',
  });
  assert.equal(r.question, '今年该不该换工作', '问题文本应去空白后回填');
  assert.ok(r.sensitivityNote?.includes('已注入'), '填写问题时应说明问题已注入卜卦类体系');
});

test('synthesizeReport 未填问题时给出降级说明', () => {
  const r: SynthesisReport = synthesizeReport(result, consensus, { topic: 'career' });
  assert.equal(r.question, undefined);
  assert.ok(r.sensitivityNote?.includes('未填写具体问题'), '未填问题时应说明卜卦类按当前时刻起局');
});

test('synthesizeReport 抽取各体系要点并保留诚实边界', () => {
  const r: SynthesisReport = synthesizeReport(result, consensus);
  assert.equal(r.perSystem.length, 1);
  const first = r.perSystem[0];
  assert.ok(first);
  assert.equal(first.systemId, 'bazi');
  const firstPoint = first.points[0];
  assert.ok(firstPoint);
  assert.ok(firstPoint.startsWith('日主'));
  assert.equal(r.caveats.length, 3);
});

test('synthesizeReport 空输入不崩', () => {
  const r: SynthesisReport = synthesizeReport({ charts: [] } as unknown as CalculateResult, []);
  assert.equal(r.overall, 0);
  assert.equal(r.byAxis.length, 0);
  assert.equal(r.perSystem.length, 0);
});
