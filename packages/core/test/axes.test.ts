import assert from 'node:assert';
import { test } from 'node:test';
import { calculateAll } from '../src/index.ts';
import { createSeededRandom } from 'mingyu-core/random';
import { aggregateConsensus } from '../src/consensus.ts';
import type { TopicId } from '../src/types.ts';

// 使用已验证的样本（male / 1990-05-15 14:30 / career / seed 12345）：
// 实测 timing 覆盖 5 体系、social 覆盖 3 体系，八大轴全部非空。
const profile = {
  name: '示例',
  gender: 'male' as const,
  calendarType: 'solar' as const,
  year: 1990,
  month: 5,
  day: 15,
  hour: 14,
  minute: 30,
  location: { name: '北京', longitude: 116.4, latitude: 39.9, timezone: 8 },
};

test('六大决策轴均被至少一个体系覆盖（防 P0-2 回归）', async () => {
  const question = {
    topicId: 'career' as TopicId,
    text: '今年是否该换工作',
    askedAt: { year: 2026, month: 9, day: 3, hour: 14, minute: 0, second: 0 },
  };
  const random = createSeededRandom(12345);
  const res = await calculateAll(profile, { question, random });
  const cons = aggregateConsensus(res.charts.flatMap((c) => c.assertions));
  const axes = new Set(cons.map((c) => c.axis));

  for (const ax of ['action', 'timing', 'social', 'risk', 'change', 'auspicious'] as const) {
    assert.ok(axes.has(ax), `决策轴 ${ax} 没有任何体系表态，交叉验证卖点崩塌`);
  }

  // timing / social 至少为「多体系」覆盖，避免回到「空白轴」名不副实的旧状。
  // 注意：紫微/六壬的 social 是条件发射（依赖兄弟宫/三传天将数据），
  // 故下限取 2 而非更高，防止不同命盘下的偶发误报。
  const timing = cons.find((c) => c.axis === 'timing');
  const social = cons.find((c) => c.axis === 'social');
  assert.ok((timing?.sampleSize ?? 0) >= 3, `timing 覆盖体系过少: ${timing?.sampleSize}`);
  assert.ok((social?.sampleSize ?? 0) >= 2, `social 覆盖体系过少: ${social?.sampleSize}`);
});
