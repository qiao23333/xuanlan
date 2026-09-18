import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// 复盘编辑器会懒加载内核来算「当时的主导判断」，这里用假内核挡掉 1.6MB 依赖，
// 只验证交互链路本身：点「复盘」→ 选档 → 记下 → 回调带出什么数据。
vi.mock('./loadCore', () => ({
  loadCore: () =>
    Promise.resolve({
      aggregateConsensus: () => [
        { axis: 'timing', weightedMean: -1.4, agreement: 0.62, outliers: [], sampleSize: 6 },
        { axis: 'action', weightedMean: 0.3, agreement: 0.5, outliers: [], sampleSize: 6 },
      ],
      // 导出 Markdown 也要用，这里给最小可用形状即可
      synthesizeReport: () => ({
        headline: '八家之中，六家主张守。',
        byAxis: [{ text: 'timing: 偏守' }],
        perSystem: [{ name: '八字', points: ['日主偏强'] }],
        caveats: ['本平台不宣称准确率'],
      }),
    }),
}));

import { HistoryPanel } from './HistoryPanel';
import type { SavedReading } from './history';
import type { StoredOutcome } from './reflection';

const iso = (daysAgo: number) => new Date(Date.now() - daysAgo * 86400000).toISOString();

function reading(over: Partial<SavedReading> = {}): SavedReading {
  return {
    id: 'r1',
    savedAt: iso(30),
    profile: { gender: 'male', calendarType: 'solar', year: 1990, month: 6, day: 15, location: { name: '北京', longitude: 116.4, latitude: 39.9, timezone: 8 } },
    schools: {},
    question: { topicId: 'career', text: '该不该跳槽' } as any,
    seed: 42,
    result: { charts: [] } as any,
    topicLabel: '事业',
    ...over,
  };
}

function setup(over: Partial<SavedReading> = {}) {
  const saved: Array<{ id: string; outcome: StoredOutcome | null }> = [];
  const utils = render(
    <HistoryPanel
      history={[reading(over)]}
      onRestore={() => {}}
      onDelete={() => {}}
      onClear={() => {}}
      onToggleFavorite={() => {}}
      onExportAll={() => {}}
      onImport={() => {}}
      onSetOutcome={(id, outcome) => saved.push({ id, outcome })}
    />
  );
  return { ...utils, saved };
}

describe('复盘交互链路（点击路径实测）', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('点「复盘」展开编辑器，未选档时「记下这条」不可点', async () => {
    setup();
    fireEvent.click(screen.getByText(/历史记录/));
    fireEvent.click(screen.getByText('复盘'));

    expect(screen.getByText(/复盘：/)).toBeTruthy();
    const submit = screen.getByText('记下这条').closest('button') as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    // 等主导判断回填完再收尾，避免异步 setState 泄漏到下一个用例
    await waitFor(() => expect(screen.getByText(/当时最强调/)).toBeTruthy());
  });

  it('编辑器展开后会回填「当时最强调」的主导判断（来自内核共识，不是事后重算）', async () => {
    setup();
    fireEvent.click(screen.getByText(/历史记录/));
    fireEvent.click(screen.getByText('复盘'));

    await waitFor(() => expect(screen.getByText(/当时最强调：宜守/)).toBeTruthy());
    expect(screen.getByText(/一致度 62%/)).toBeTruthy();
  });

  it('选档 + 写备注 + 记下，回传出完整 StoredOutcome', async () => {
    const { saved } = setup();
    fireEvent.click(screen.getByText(/历史记录/));
    fireEvent.click(screen.getByText('复盘'));
    await waitFor(() => expect(screen.getByText(/当时最强调/)).toBeTruthy());

    fireEvent.click(screen.getByText('部分应验'));
    fireEvent.change(screen.getByPlaceholderText(/后来实际发生了什么/), {
      target: { value: '跳了，但钱没涨' },
    });
    fireEvent.click(screen.getByText('记下这条'));

    expect(saved.length).toBe(1);
    const rec = saved[0];
    expect(rec).toBeTruthy();
    expect(rec?.id).toBe('r1');
    expect(rec?.outcome?.verdict).toBe('partial');
    expect(rec?.outcome?.actualNote).toBe('跳了，但钱没涨');
    // 主导判断被固化，日后算法演进也不会篡改这条复盘
    expect(rec?.outcome?.dominant).toEqual({
      axis: 'timing',
      dir: -1,
      mean: -1.4,
      agreement: 0.62,
      sampleSize: 6,
    });
    // 30 天前问的事，今天回来复盘
    expect(rec?.outcome?.daysAfter).toBe(30);
    expect(rec?.outcome?.resolvedAt).toBeTruthy();
  });

  it('已标定的记录：列表上出现徽章，「撤销标注」可清空', async () => {
    const { saved } = setup({
      outcome: { verdict: 'hit', resolvedAt: new Date().toISOString(), daysAfter: 5 },
    });
    fireEvent.click(screen.getByText(/历史记录/));

    expect(screen.getByText(/✓ 应验了/)).toBeTruthy();
    fireEvent.click(screen.getByText('复盘'));
    await waitFor(() => expect(screen.getByText(/当时最强调/)).toBeTruthy());
    fireEvent.click(screen.getByText('撤销标注'));
    expect(saved[0]?.outcome).toBeNull();
  });

  it('导出按钮等到 Markdown 生成后再下载（旧代码传的是 Promise，会存下 [object Promise]）', async () => {
    setup();
    fireEvent.click(screen.getByText(/历史记录/));

    const created: string[] = [];
    const origCreate = URL.createObjectURL;
    URL.createObjectURL = ((b: Blob) => {
      created.push(b.type);
      return origCreate.call(URL, b);
    }) as typeof URL.createObjectURL;

    fireEvent.click(screen.getByText('导出'));

    // 至少要真的产出一个 markdown blob —— 说明 await 生效了，
    // 而不是同步把 Promise 塞进 Blob（旧代码会存下一个 [object Promise] 的 .md）
    await waitFor(() => expect(created.some((t) => t.includes('markdown'))).toBe(true));
    URL.createObjectURL = origCreate;
  });
});
