import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ConsensusDashboard } from './ConsensusDashboard';
import type { Consensus } from './core';

const mockConsensus: Consensus[] = [
  { axis: 'action', weightedMean: 0.8, agreement: 0.75, outliers: [{ systemId: 'tarot' }], sampleSize: 8 },
  { axis: 'timing', weightedMean: -0.3, agreement: 0.6, outliers: [{ systemId: 'bazi' }], sampleSize: 8 },
  { axis: 'social', weightedMean: 1.2, agreement: 0.9, outliers: [], sampleSize: 8 },
  { axis: 'risk', weightedMean: -0.5, agreement: 0.55, outliers: [{ systemId: 'qimen' }, { systemId: 'liuren' }], sampleSize: 8 },
  { axis: 'change', weightedMean: 0.2, agreement: 0.7, outliers: [], sampleSize: 8 },
  { axis: 'auspicious', weightedMean: 0.6, agreement: 0.8, outliers: [{ systemId: 'astrolabe' }], sampleSize: 8 },
];

describe('ConsensusDashboard', () => {
  it('renders overall agreement percentage', () => {
    render(<ConsensusDashboard consensus={mockConsensus} topic="general" />);
    expect(screen.getByText(/总体共识 \d+%/)).toBeInTheDocument();
  });

  it('renders all 6 axes', () => {
    const { container } = render(<ConsensusDashboard consensus={mockConsensus} topic="general" />);
    // 直接数渲染出的轴卡片数，比脆弱的文本匹配更贴合「6 轴齐全」的意图
    expect(container.querySelectorAll('.cons-axis').length).toBe(6);
  });

  it('highlights topic-related axes for romance', () => {
    const { container } = render(<ConsensusDashboard consensus={mockConsensus} topic="romance" />);
    const relatedCards = container.querySelectorAll('.cons-axis.cons-related');
    expect(relatedCards.length).toBe(2);
  });

  it('returns null when consensus is empty', () => {
    const { container } = render(<ConsensusDashboard consensus={[]} topic="general" />);
    expect(container.firstChild).toBeNull();
  });
});
