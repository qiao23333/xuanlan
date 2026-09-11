import { describe, it, expect, beforeEach } from 'vitest';
import {
  pickDominant,
  dominantText,
  summarizeReflection,
  daysSince,
  type DominantJudgement,
  type StoredOutcome,
  type Verdict,
} from './reflection';
import { loadHistory, saveReading, setOutcome, clearHistory, type SavedReading } from './history';

const iso = (daysAgo: number) => new Date(Date.now() - daysAgo * 86400000).toISOString();

function makeReading(over: Partial<SavedReading> = {}): SavedReading {
  return {
    id: `r-${Math.random().toString(36).slice(2)}`,
    savedAt: new Date().toISOString(),
    profile: {
      gender: 'male',
      calendarType: 'solar',
      year: 1990,
      month: 6,
      day: 15,
      location: { name: '北京', longitude: 116.4, latitude: 39.9, timezone: 8 },
    },
    schools: {},
    question: null,
    seed: 123,
    result: { charts: [] } as any,
    topicLabel: '综合',
    ...over,
  };
}

const cons = (axis: string, mean: number, agreement: number, sampleSize: number) =>
  ({ axis, weightedMean: mean, agreement, outliers: [], sampleSize }) as any;

describe('复盘回路 reflection', () => {
  describe('pickDominant 主导判断', () => {
    it('取偏离 0 最远且有至少两家参与的轴', () => {
      const d = pickDominant([
        cons('action', 0.5, 0.9, 4),
        cons('timing', -1.6, 0.7, 4),
        cons('risk', 0.2, 1, 1), // 只有 1 家，忽略
      ]);
      expect(d).toEqual({ axis: 'timing', dir: -1, mean: -1.6, agreement: 0.7, sampleSize: 4 });
    });

    it('全轴接近 0 或样本不足时返回 null', () => {
      expect(pickDominant([cons('action', 0, 1, 4)])).toBeNull();
      expect(pickDominant([cons('action', 1.5, 1, 1)])).toBeNull();
      expect(pickDominant([])).toBeNull();
    });

    it('均值绝对值相同时取一致度更高的', () => {
      const d = pickDominant([cons('action', 1, 0.5, 4), cons('change', 1, 0.8, 4)]);
      expect(d?.axis).toBe('change');
    });
  });

  describe('dominantText 人话翻译', () => {
    it('负方向取 negative 标签，并带上参与家数与一致度', () => {
      const d: DominantJudgement = { axis: 'timing', dir: -1, mean: -1.2, agreement: 0.62, sampleSize: 6 };
      expect(dominantText(d)).toBe('宜守 · 6 家参与 · 一致度 62%');
    });
    it('空值返回空串（UI 上会走「未记录」分支）', () => {
      expect(dominantText(null)).toBe('');
      expect(dominantText(undefined)).toBe('');
    });
  });

  describe('summarizeReflection 统计', () => {
    it('按四档计数、按主题分组，未标注的计入 pending', () => {
      const list: SavedReading[] = [
        makeReading({ question: { topicId: 'career', text: '跳槽' } as any, outcome: mkOutcome('hit') }),
        makeReading({ question: { topicId: 'career', text: '加薪' } as any, outcome: mkOutcome('miss') }),
        makeReading({ question: { topicId: 'romance', text: '复合' } as any, outcome: mkOutcome('partial') }),
        makeReading({ savedAt: iso(3) }), // 3 天前，不该进 pending
        makeReading({ savedAt: iso(10) }), // 10 天前，该提醒
      ];
      const s = summarizeReflection(list);
      expect(s.total).toBe(5);
      expect(s.judged).toBe(3);
      expect(s.counts).toEqual({ hit: 1, partial: 1, miss: 1, unknown: 0 });
      expect(s.pending.length).toBe(1);

      const career = s.byTopic.find((t) => t.topic === 'career');
      expect(career?.total).toBe(2);
      expect(career?.counts.hit).toBe(1);
      expect(career?.counts.miss).toBe(1);
      expect(s.byTopic.find((t) => t.topic === 'romance')?.counts.partial).toBe(1);
      // 主题按样本数降序
      expect(s.byTopic[0].topic).toBe('career');
    });

    it('对照条目按复盘时间倒序', () => {
      const list: SavedReading[] = [
        makeReading({ outcome: mkOutcome('hit', '2026-01-01T00:00:00.000Z') }),
        makeReading({ outcome: mkOutcome('miss', '2026-03-01T00:00:00.000Z') }),
      ];
      const s = summarizeReflection(list);
      expect(s.pairs[0].outcome.verdict).toBe('miss');
      expect(s.pairs[1].outcome.verdict).toBe('hit');
    });

    it('空历史不炸，judged 为 0', () => {
      const s = summarizeReflection([]);
      expect(s).toMatchObject({ total: 0, judged: 0 });
      expect(s.pairs).toEqual([]);
      expect(s.pending).toEqual([]);
    });
  });

  describe('daysSince', () => {
    it('按整天计算，非法日期返回 0', () => {
      expect(daysSince(iso(7))).toBe(7);
      expect(daysSince(iso(0))).toBe(0);
      expect(daysSince('不是日期')).toBe(0);
    });
  });

  describe('setOutcome 落盘', () => {
    beforeEach(() => clearHistory());

    it('写入后可读回，传 null 撤销', () => {
      const r = makeReading({ id: 'x1' });
      saveReading(r);
      const o: StoredOutcome = {
        verdict: 'partial',
        actualNote: '一半说中',
        resolvedAt: new Date().toISOString(),
        dominant: { axis: 'timing', dir: -1, mean: -1.2, agreement: 0.62, sampleSize: 6 },
        daysAfter: 9,
      };
      const after = setOutcome('x1', o);
      expect(after.find((x) => x.id === 'x1')?.outcome?.verdict).toBe('partial');
      expect(loadHistory().find((x) => x.id === 'x1')?.outcome?.actualNote).toBe('一半说中');

      const cleared = setOutcome('x1', null);
      expect(cleared.find((x) => x.id === 'x1')?.outcome).toBeUndefined();
    });
  });
});

function mkOutcome(verdict: Verdict, resolvedAt?: string): StoredOutcome {
  return { verdict, resolvedAt: resolvedAt ?? new Date().toISOString(), daysAfter: 1 };
}
