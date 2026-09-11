import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReflectionPanel } from './ReflectionPanel';
import type { SavedReading } from './history';
import type { StoredOutcome } from './reflection';

const iso = (daysAgo: number) => new Date(Date.now() - daysAgo * 86400000).toISOString();

function reading(over: Partial<SavedReading> = {}): SavedReading {
  return {
    id: `r-${Math.random().toString(36).slice(2)}`,
    savedAt: iso(20),
    profile: { gender: 'male', calendarType: 'solar', year: 1990, month: 6, day: 15, location: { name: '北京', longitude: 116.4, latitude: 39.9, timezone: 8 } },
    schools: {},
    question: { topicId: 'career', text: '该不该跳槽' } as any,
    seed: 1,
    result: { charts: [] } as any,
    topicLabel: '事业',
    ...over,
  };
}

const outcome = (verdict: StoredOutcome['verdict'], note?: string): StoredOutcome => ({
  verdict,
  actualNote: note,
  resolvedAt: new Date().toISOString(),
  dominant: { axis: 'timing', dir: -1, mean: -1.2, agreement: 0.62, sampleSize: 6 },
  daysAfter: 14,
});

describe('ReflectionPanel', () => {
  it('没有历史时不渲染（避免空占版面）', () => {
    const { container } = render(<ReflectionPanel history={[]} onRestore={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it('展开后展示四档计数与「当时怎么说 ↔ 后来怎么样」对照', () => {
    render(
      <ReflectionPanel
        history={[reading({ outcome: outcome('hit', '果然拖到年底才有动静') }), reading({ outcome: outcome('miss') })]}
        onRestore={() => {}}
      />
    );
    fireEvent.click(screen.getByText(/复盘回路/));

    expect(screen.getByText('应验了')).toBeTruthy();
    expect(screen.getByText('没应验')).toBeTruthy();
    expect(screen.getByText(/当时怎么说 ↔ 后来怎么样/)).toBeTruthy();
    // 主导判断被固化下来，而不是事后重算
    expect(screen.getAllByText(/宜守 · 6 家参与 · 一致度 62%/).length).toBe(2);
    expect(screen.getByText('果然拖到年底才有动静')).toBeTruthy();
  });

  it('必须声明「不上传、不聚合、不宣称命中率」—— 这是产品的诚实底线', () => {
    render(<ReflectionPanel history={[reading({ outcome: outcome('hit') })]} onRestore={() => {}} />);
    fireEvent.click(screen.getByText(/复盘回路/));
    expect(screen.getByText(/平台不上传、不聚合/)).toBeTruthy();
  });

  it('样本不足 10 条时明确提示不构成统计意义，且不出现任何百分比结论', () => {
    const { container } = render(
      <ReflectionPanel history={[reading({ outcome: outcome('hit') }), reading({ outcome: outcome('hit') })]} onRestore={() => {}} />
    );
    fireEvent.click(screen.getByText(/复盘回路/));
    expect(screen.getByText(/不构成统计意义/)).toBeTruthy();
    // 「准确率」这三个字一个都不许出现
    expect(container.textContent).not.toMatch(/准确率/);
  });

  it('一条都没复盘时给引导，而不是显示一堆 0', () => {
    render(<ReflectionPanel history={[reading()]} onRestore={() => {}} />);
    fireEvent.click(screen.getByText(/复盘回路/));
    expect(screen.getByText(/还没有复盘记录/)).toBeTruthy();
    expect(screen.queryByText(/当时怎么说/)).toBeNull();
  });

  it('7 天以上未标定的记录会被提醒回来复盘', () => {
    render(<ReflectionPanel history={[reading({ savedAt: iso(9) })]} onRestore={() => {}} />);
    fireEvent.click(screen.getByText(/复盘回路/));
    expect(screen.getByText(/已经过去 7 天以上/)).toBeTruthy();
  });
});
