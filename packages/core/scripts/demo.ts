/**
 * 内核冒烟：一次输入，8 个体系并排出结果。
 *
 * 运行：npm run demo
 */
import { calculateAll } from '../src/index.ts';
import type { BirthProfile, Question, RandomSource } from '../src/types.ts';
import { createSeededRandom } from 'mingyu-core/random';

const profile: BirthProfile = {
  name: '玄览演示',
  gender: 'male',
  calendarType: 'solar',
  year: 1990,
  month: 5,
  day: 15,
  hour: 14,
  minute: 30,
  useTrueSolarTime: true,
  location: { name: '北京市朝阳区', longitude: 116.41, latitude: 39.9, timezone: 8 },
};

const question: Question = {
  topicId: 'career',
  text: '这个季度适合换工作吗',
  askedAt: { year: 2026, month: 8, day: 31, hour: 12, minute: 0, second: 0 },
};

const random = createSeededRandom(20260831) as unknown as RandomSource;

const result = await calculateAll(profile, { question, random });

console.log('════════ 玄览内核 · 八体系并排演示 ════════\n');

const n = result.normalized;
console.log('【时间归一化】');
console.log(`  钟表时间   ${fmt(n.clockTime)}`);
console.log(`  排盘时刻   ${fmt(n.effectiveTime)}   (真太阳时修正 ${n.trueSolarOffsetSeconds}s)`);
console.log(`  时辰索引   ${n.timeIndex}   输入模式 ${n.timeInputMode}`);
console.log(`  出生地点   ${n.resolvedLocation?.name} (${n.resolvedLocation?.longitude}°, ${n.resolvedLocation?.latitude}°)`);

console.log(`\n【全局警告】${result.warnings.length} 条`);
for (const w of result.warnings) console.log(`  [${w.level}] ${w.code}\n      ${w.message}`);

console.log(`\n【排盘结果】成功 ${result.charts.length} / 失败 ${result.failed.length}`);
for (const c of result.charts) {
  console.log(`\n── ${c.systemId} ──`);
  console.log(`  engine    ${c.engineVersion}`);
  console.log(`  configHash ${c.configHash}`);
  console.log(`  config    ${JSON.stringify(c.appliedConfig)}`);
  console.log(`  data keys ${Object.keys(c.data as object).slice(0, 10).join(', ')}`);
  if (c.warnings.length) {
    for (const w of c.warnings) console.log(`  [${w.level}] ${w.code}: ${w.message}`);
  }
}

if (result.failed.length) {
  console.log('\n【失败明细】');
  for (const f of result.failed) console.log(`  ${f.systemId}: ${f.message}`);
}

function fmt(t: { year: number; month: number; day: number; hour: number; minute: number; second: number }): string {
  return `${t.year}-${p(t.month)}-${p(t.day)} ${p(t.hour)}:${p(t.minute)}:${p(t.second)}`;
}
function p(v: number): string {
  return String(v).padStart(2, '0');
}
