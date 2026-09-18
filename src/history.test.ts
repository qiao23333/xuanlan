import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadHistory,
  saveReading,
  clearHistory,
  toggleFavorite,
  exportAllJson,
  importBackup,
  migrate,
  type SavedReading,
} from './history';

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

describe('history 存储与备份', () => {
  beforeEach(() => {
    clearHistory();
    localStorage.clear();
  });

  it('migrate 为旧数据补全 favorite 默认字段', () => {
    const out = migrate([{ id: 'x', savedAt: '', profile: {} as any, schools: {}, seed: 1, result: {} as any, topicLabel: '' }]);
    expect(out[0]?.favorite).toBe(false);
  });

  it('toggleFavorite 切换收藏标记', () => {
    const saved = saveReading(makeReading({ id: 'a' }));
    expect(saved[0]?.favorite).toBeFalsy();
    const toggled = toggleFavorite('a');
    expect(toggled.find((r) => r.id === 'a')?.favorite).toBe(true);
    toggleFavorite('a');
    expect(loadHistory().find((r) => r.id === 'a')?.favorite).toBe(false);
  });

  it('导出全部再导入可无损恢复，并按 id 去重', () => {
    saveReading(makeReading({ id: 'a', profile: { ...makeReading().profile, name: '张三' } }));
    saveReading(makeReading({ id: 'b' }));
    const json = exportAllJson(loadHistory());
    expect(JSON.parse(json).schemaVersion).toBe(1);

    clearHistory();
    expect(loadHistory().length).toBe(0);

    const { added, skipped } = importBackup(json);
    expect(added).toBe(2);
    expect(skipped).toBe(0);
    expect(loadHistory().length).toBe(2);

    // 再次导入相同备份应跳过重复
    const again = importBackup(json);
    expect(again.skipped).toBe(2);
    expect(again.added).toBe(0);
    expect(loadHistory().length).toBe(2);
  });

  it('导入损坏的备份抛出可捕获错误', () => {
    expect(() => importBackup('不是 json')).toThrow();
  });
});
