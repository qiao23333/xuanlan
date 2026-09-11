import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LayerView } from './LayerView';
import type { Assertion, CalculateResult, SystemId } from './core';

function a(systemId: SystemId, axis: Assertion['axis'], score: number): Assertion {
  return { systemId, schoolId: 'default', topicId: 'general', axis, score, confidence: 1, evidence: ['测试'] } as Assertion;
}

const result = (assertions: Assertion[]): CalculateResult =>
  ({ charts: [{ systemId: 'bazi', assertions }], failed: [], warnings: [] } as any);

describe('LayerView 分层共识', () => {
  it('两层各算各的：命盘偏守、卜卦偏进时，两个方向都要显示出来', () => {
    render(
      <LayerView
        result={result([
          a('bazi', 'timing', -2),
          a('ziwei', 'timing', -1),
          a('tarot', 'timing', 2),
          a('meihua', 'timing', 1),
        ])}
      />
    );
    expect(screen.getByText(/两层分开看/)).toBeTruthy();
    // 混算的均值约 -0.2，会被读成「持平」；分层后两层各自的真实方向才看得见
    expect(screen.getByText('宜守')).toBeTruthy();
    expect(screen.getByText('宜进')).toBeTruthy();
  });

  it('跨层反向时点名张力，并给出「可以做但要留退路」的读法', () => {
    render(<LayerView result={result([a('bazi', 'timing', -2), a('tarot', 'timing', 2)])} />);
    expect(screen.getByText(/跨层张力/)).toBeTruthy();
    expect(screen.getByText(/底色偏/)).toBeTruthy();
    expect(screen.getByText(/留退路/)).toBeTruthy();
  });

  it('刻意不给出两层的平均数，并说明为什么', () => {
    const { container } = render(<LayerView result={result([a('bazi', 'timing', -2), a('tarot', 'timing', 2)])} />);
    expect(screen.getByText(/不合并成一个数/)).toBeTruthy();
    expect(screen.getByText(/取中间值是最没信息量的读法/)).toBeTruthy();
    // 页面上不能出现「综合」「平均」这类把两层压成一个数的措辞
    expect(container.textContent).not.toMatch(/综合平均|两层平均/);
  });

  it('某层未表态时如实写「该层未表态」，而不是补一个 0', () => {
    render(<LayerView result={result([a('bazi', 'timing', -2)])} />);
    expect(screen.getByText('该层未表态')).toBeTruthy();
    // 只有单层时谈不上跨层张力
    expect(screen.queryByText(/跨层张力/)).toBeNull();
  });

  it('两层同向且差异小时不制造张力', () => {
    render(<LayerView result={result([a('bazi', 'timing', -1), a('tarot', 'timing', -0.8)])} />);
    expect(screen.queryByText(/跨层张力/)).toBeNull();
  });

  it('没有任何断言时不渲染', () => {
    const { container } = render(<LayerView result={result([])} />);
    expect(container.firstChild).toBeNull();
  });
});
