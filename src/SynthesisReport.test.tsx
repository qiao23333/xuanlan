import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SynthesisReport } from './SynthesisReport';

const mockReport = {
  headline: '整体倾向偏保守，体系间存在明显分歧',
  byAxis: [
    { axis: 'action', text: '行动：宜静', direction: 'negative' },
    { axis: 'timing', text: '时机：宜守', direction: 'negative' },
  ],
  perSystem: [
    { systemId: 'bazi', name: '八字', points: ['日主偏强'] },
    { systemId: 'tarot', name: '塔罗', points: ['正位'] },
  ],
  caveats: ['测试提示'],
};

describe('SynthesisReport', () => {
  it('renders headline', () => {
    render(<SynthesisReport report={mockReport as any} topic="general" />);
    expect(screen.getByText(mockReport.headline)).toBeInTheDocument();
  });

  it('renders system breakdown', () => {
    render(<SynthesisReport report={mockReport as any} topic="general" />);
    expect(screen.getByText('八字')).toBeInTheDocument();
    expect(screen.getByText('塔罗')).toBeInTheDocument();
  });

  it('renders caveats', () => {
    render(<SynthesisReport report={mockReport as any} topic="general" />);
    // 组件渲染为「⚠ 测试提示」，⚠ 与前缀拆分了文本节点，用正则匹配
    expect(screen.getByText(/测试提示/)).toBeInTheDocument();
  });
});
