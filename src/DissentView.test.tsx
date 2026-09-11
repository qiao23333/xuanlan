import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DissentView } from './DissentView';
import type { CalculateResult, Consensus } from './core';

function chart(systemId: string, assertions: any[]) {
  return { systemId, assertions } as any;
}

// 场景 A：timing 轴明显分歧（2 主张宜进 vs 2 主张宜守）
const consentedResultA: CalculateResult = {
  charts: [
    chart('ziwei', [{ axis: 'timing', score: 1, confidence: 1, evidence: ['紫微：大限吉'] }]),
    chart('xiaoliuren', [{ axis: 'timing', score: 1, confidence: 1, evidence: ['小六壬：大吉'] }]),
    chart('bazi', [{ axis: 'timing', score: -1, confidence: 1, evidence: ['八字：官杀攻身'] }]),
    chart('meihua', [{ axis: 'timing', score: -1, confidence: 1, evidence: ['梅花：体克用'] }]),
    chart('qimen', [{ axis: 'action', score: 0.5, confidence: 1, evidence: ['奇门：利动'] }]),
  ],
} as any;

const consensusA: Consensus[] = [
  { axis: 'timing', weightedMean: 0, agreement: 0.5, outliers: [], sampleSize: 4 },
  { axis: 'action', weightedMean: 0.5, agreement: 1, outliers: [], sampleSize: 1 },
] as any;

// 场景 B：六轴全部高度一致
const consensusB: Consensus[] = [
  { axis: 'timing', weightedMean: 1, agreement: 1, outliers: [], sampleSize: 4 },
  { axis: 'action', weightedMean: 1, agreement: 1, outliers: [], sampleSize: 4 },
] as any;

describe('DissentView', () => {
  it('有显著分歧时，展示最大分歧轴与两派', () => {
    render(<DissentView result={consentedResultA} consensus={consensusA} topic="career" />);
    expect(screen.getByText(/最大分歧/)).toBeTruthy();
    expect(screen.getByText(/宜进 ↔ 宜守/)).toBeTruthy();
    // 两派标题都应出现
    expect(screen.getByText(/主张 宜进/)).toBeTruthy();
    expect(screen.getByText(/主张 宜守/)).toBeTruthy();
  });

  it('无显著分歧时，展示「高度一致」提示而非辩论', () => {
    render(<DissentView result={consentedResultA} consensus={consensusB} topic="career" />);
    expect(screen.getByText(/高度同向|高度一致/)).toBeTruthy();
    expect(screen.queryByText(/主张 宜进/)).toBeNull();
  });
});
