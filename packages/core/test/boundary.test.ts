/**
 * 边界用例测试。
 *
 * 排盘类软件最容易在边界上出错，而边界恰恰是用户最容易质疑的地方
 * （"我和别人只差一分钟，为什么结果完全不同"）。
 * 这里的每一条都必须给出明确行为：要么算对，要么给出可解释的警告。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateAll, normalizeBirth, InvalidBirthProfileError } from '../src/index.ts';
import { TRUE_SOLAR_CASE, CHINA_DST_CASE, POLAR_CASE } from './fixtures.ts';
import type { Warning } from '../src/types.ts';

const has = (warnings: Warning[], code: string) => warnings.some((w) => w.code === code);

test('真太阳时：乌鲁木齐 23:30 应回退 2 小时 5 分 46 秒', () => {
  const { normalized, warnings } = normalizeBirth(TRUE_SOLAR_CASE.profile);

  assert.deepEqual(
    {
      hour: normalized.effectiveTime.hour,
      minute: normalized.effectiveTime.minute,
      second: normalized.effectiveTime.second,
    },
    { hour: 21, minute: 24, second: 14 },
    '真太阳时换算结果与实测基准不符'
  );
  assert.equal(
    normalized.trueSolarOffsetSeconds,
    TRUE_SOLAR_CASE.expectedOffsetSeconds,
    '真太阳时偏移秒数不符'
  );

  // 修正后仍在同一天（23:30 → 21:24，未跨日），但必须给出明确提示
  assert.ok(
    has(warnings, 'profile.trueSolarEnabled'),
    '启用真太阳时必须产生 info 警告，说明与其他平台可能不同'
  );
});

test('真太阳时必须显式声明，默认关闭', () => {
  const { normalized } = normalizeBirth({
    name: 'x',
    gender: 'male',
    calendarType: 'solar',
    year: 1990,
    month: 5,
    day: 15,
    hour: 23,
    minute: 30,
    location: { longitude: 87.62, latitude: 43.82, timezone: 8 },
  });
  // 未显式开启 → 不做任何修正
  assert.equal(normalized.trueSolarOffsetSeconds, 0, '默认不应启用真太阳时');
});

test('真太阳时导致跨日时必须 warn', () => {
  // 东经 87.62，出生在 00:10 → 修正后回退到前一日 22:0x
  const { warnings } = normalizeBirth({
    name: 'x',
    gender: 'male',
    calendarType: 'solar',
    year: 1990,
    month: 5,
    day: 16,
    hour: 0,
    minute: 10,
    useTrueSolarTime: true,
    location: { longitude: 87.62, latitude: 43.82, timezone: 8 },
  });
  assert.ok(
    has(warnings, 'profile.trueSolarDateShift'),
    '真太阳时导致跨日时必须产生 dateShift 警告（日柱时柱都会变）'
  );
});

test('子时出生必须提示早晚子时分歧', () => {
  for (const hour of [23, 0]) {
    const { warnings } = normalizeBirth({
      name: 'x',
      gender: 'male',
      calendarType: 'solar',
      year: 1990,
      month: 5,
      day: 15,
      hour,
      minute: 30,
    });
    assert.ok(has(warnings, 'profile.ziShiBoundary'), `${hour} 时应产生子时换日警告`);
  }
});

test('中国夏令时必须 warn', () => {
  const { warnings } = normalizeBirth(CHINA_DST_CASE.profile);
  assert.ok(has(warnings, 'profile.chinaDst'), 'applyChinaDst 时应产生夏令时警告');
});

test('极区必须报 Placidus 失效（底层库不报，由内核补）', () => {
  const { warnings } = normalizeBirth(POLAR_CASE.profile);
  const w = warnings.find((x) => x.code === 'profile.placidusPolarFailure');
  assert.ok(w, '纬度 78.2° 必须产生 Placidus 失效警告');
  assert.equal(w!.level, 'error', '极区失效应标记为 error 而非 info');
});

test('赤道附近不应误报极区', () => {
  const { warnings } = normalizeBirth({
    name: 'x',
    gender: 'male',
    calendarType: 'solar',
    year: 1990,
    month: 5,
    day: 15,
    hour: 14,
    minute: 30,
    location: { longitude: 116.41, latitude: 39.9, timezone: 8 },
  });
  assert.ok(!has(warnings, 'profile.placidusPolarFailure'), '北京纬度不应触发极区警告');
});

test('仅提供时辰（无精准时分）时必须说明', () => {
  const { normalized, warnings } = normalizeBirth({
    name: 'x',
    gender: 'male',
    calendarType: 'solar',
    year: 1990,
    month: 5,
    day: 15,
    timeIndex: 7,
  });
  assert.equal(normalized.timeInputMode, 'traditional-shichen');
  assert.ok(has(warnings, 'profile.shichenOnly'), '仅时辰时必须提示结果粒度');
});

test('档案无效时明确拒绝，而不是让各体系硬算', async () => {
  // 缺出生时辰：所有依赖出生档案的体系都算不了，应整体拒绝
  await assert.rejects(
    () =>
      calculateAll({
        name: 'x',
        gender: 'male',
        calendarType: 'solar',
        year: 1990,
        month: 5,
        day: 15,
        // 无 hour/minute/timeIndex
      } as never),
    (e: unknown) => {
      assert.ok(e instanceof InvalidBirthProfileError, `应抛出 InvalidBirthProfileError，实得 ${String(e)}`);
      assert.ok(e.fields.includes('hour|minute|timeIndex'), `缺失字段应被标出，实得 ${e.fields.join(',')}`);
      return true;
    }
  );
});

test('单体系失败不拖垮其他体系', async () => {
  // 混入一个不存在的体系 id，其余 8 个应全部成功
  const r = await calculateAll(TRUE_SOLAR_CASE.profile, {
    systems: ['bazi', 'liuren', 'tarot', 'not-a-real-system' as never],
    question: { topicId: 'general', askedAt: { year: 2026, month: 8, day: 31, hour: 12, minute: 0, second: 0 } },
  });

  assert.ok(Array.isArray(r.charts), 'charts 必须始终是数组');
  assert.equal(r.charts.length, 3, '3 个有效体系应全部成功');
  assert.equal(r.failed.length, 1, '1 个无效体系应进 failed');
  assert.equal(r.failed[0]!.systemId, 'not-a-real-system');
  assert.match(r.failed[0]!.message, /未知体系/, '失败原因应明确可读');
  assert.equal(
    r.charts.length + r.failed.length,
    4,
    '每个体系必须有明确归属（成功或失败），不允许静默丢失'
  );
});

test('输出顺序稳定，不因并发完成顺序改变', async () => {
  const p = TRUE_SOLAR_CASE.profile;
  const q = { topicId: 'general' as const, askedAt: { year: 2026, month: 8, day: 31, hour: 12, minute: 0, second: 0 } };
  const a = await calculateAll(p, { question: q });
  const b = await calculateAll(p, { question: q });
  assert.deepEqual(
    a.charts.map((c) => c.systemId),
    b.charts.map((c) => c.systemId),
    '两次调用的输出顺序必须一致'
  );
});
