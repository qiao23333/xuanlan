/**
 * 黄金用例回归测试。
 *
 * 这些期望值来自实测，不是推算。任何一条挂掉都意味着：
 * 要么底层库升级改了算法，要么我们改坏了 —— 两者都必须人工确认后才能更新。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateAll } from '../src/index.ts';
import { BAZI_GOLDEN, LIUREN_GOLDEN, fourPillars } from './fixtures.ts';
import { liurenAdapter } from '../src/adapters/index.ts';
import { normalizeBirth } from '../src/profile.ts';

test('八字四柱黄金用例', async () => {
  for (const c of BAZI_GOLDEN) {
    const r = await calculateAll(c.profile, { systems: ['bazi'] });
    assert.equal(r.failed.length, 0, `${c.tag} 排盘失败: ${JSON.stringify(r.failed)}`);

    const chart = r.charts[0];
    assert.ok(chart, `${c.tag} 无结果`);
    const actual = fourPillars(chart);

    assert.deepEqual(actual, c.expected, `${c.tag} 四柱不符：期望 ${c.expected.join(' ')}，实得 ${actual.join(' ')}`);
  }
});

test('已知分歧用例必须仍然分歧（防止被"修好"而丢失信息）', async () => {
  const divergent = BAZI_GOLDEN.filter((c) => c.knownDivergence);
  assert.ok(divergent.length > 0, '应至少有一条已知分歧用例');
  for (const c of divergent) {
    const r = await calculateAll(c.profile, { systems: ['bazi'] });
    const actual = fourPillars(r.charts[0]!);

    // 本平台结果应保持己方口径
    assert.deepEqual(actual, c.expected, `${c.tag} 己方口径发生变化，需人工确认`);
    // 且与对方口径确实不同 —— 若相同说明分歧消失了，要重新核实
    assert.notDeepEqual(
      actual,
      c.knownDivergence!.lunarTypescript,
      `${c.tag} 与 lunar-typescript 的分歧消失了，需重新核实口径`
    );
  }
});

test('大六壬三传 / 课体 / 月将黄金用例', () => {
  for (const c of LIUREN_GOLDEN) {
    const ctx = {
      profile: {
        name: 'golden',
        gender: 'male' as const,
        calendarType: 'solar' as const,
        year: c.at.year,
        month: c.at.month,
        day: c.at.day,
        hour: c.at.hour,
        minute: c.at.minute,
      },
      normalized: normalizeBirth({
        name: 'golden',
        gender: 'male',
        calendarType: 'solar',
        year: c.at.year,
        month: c.at.month,
        day: c.at.day,
        hour: c.at.hour,
        minute: c.at.minute,
      }).normalized,
      config: {},
      question: { topicId: 'general' as const, askedAt: c.at },
    };

    const chart = liurenAdapter(ctx) as ReturnType<typeof liurenAdapter>;
    const d = (chart as unknown as { data: Record<string, unknown> }).data;

    const tt = d.threeTransmissions as Array<{ branch: string; god: string }>;
    const actual = tt.map((x) => x.branch + x.god);
    assert.deepEqual(actual, c.expected, `${c.tag} 三传不符：期望 ${c.expected.join('>')}，实得 ${actual.join('>')}`);

    assert.equal(d.transmissionRule, c.expectedRule, `${c.tag} 课体不符`);
    assert.equal(d.monthLeader, c.expectedMonthLeader, `${c.tag} 月将不符`);
  }
});

test('configHash 对同输入稳定、对异输入敏感', async () => {
  const p = BAZI_GOLDEN[0]!.profile;
  const a = await calculateAll(p, { systems: ['bazi'] });
  const b = await calculateAll(p, { systems: ['bazi'] });
  assert.equal(a.charts[0]!.configHash, b.charts[0]!.configHash, '同输入两次调用 configHash 必须一致');

  // 改流派配置后 hash 必须变，否则缓存会把不同流派的结果混在一起
  const c = await calculateAll(p, { systems: ['qimen'], config: { qimen: { juMethod: 'chaibu' } } });
  const d = await calculateAll(p, { systems: ['qimen'], config: { qimen: { juMethod: 'zhirun' } } });
  assert.notEqual(
    c.charts[0]!.configHash,
    d.charts[0]!.configHash,
    '不同流派配置必须产生不同 configHash'
  );
});

test('每个结果都携带溯源信息', async () => {
  const r = await calculateAll(BAZI_GOLDEN[0]!.profile);
  for (const c of r.charts) {
    assert.ok(c.engineVersion.includes('mingyu-core'), `${c.systemId} 缺 engineVersion`);
    assert.match(c.configHash, /^[0-9a-f]{16}$/, `${c.systemId} configHash 格式不对`);
    assert.ok(Array.isArray(c.warnings), `${c.systemId} warnings 必须是数组`);
    assert.ok(Array.isArray(c.assertions), `${c.systemId} assertions 必须是数组`);
    assert.ok(c.appliedConfig && typeof c.appliedConfig === 'object', `${c.systemId} 缺 appliedConfig`);
  }
});
