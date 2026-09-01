/**
 * 双库交叉对拍。
 *
 * 排盘是确定性逻辑，但没有独立参照就无法证明「我们算对了」。
 * 因此对每个体系找一个独立实现来比对：
 * - 八字四柱 / 节气 → lunar-typescript（6tail）
 * - 大六壬        → liuren-ts-lib（LookFate）
 *
 * 对拍结果一律打印一致率报告，因为「哪里不一致」和「哪里一致」同样重要：
 * 不一致处往往是真实流派分歧，正是本产品要展示给用户看的东西。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Solar, Lunar } from 'lunar-typescript';
import { drawTarotSpread } from 'mingyu-core/divination/tarot';
import { calculateAll } from '../src/index.ts';
import { BAZI_GOLDEN, LIUREN_GOLDEN, fourPillars } from './fixtures.ts';
import { tarotAdapter } from '../src/adapters/index.ts';
import { normalizeBirth } from '../src/profile.ts';
import type { RandomSource } from '../src/types.ts';

/** 天将别名归一：腾/螣 是同一个字的不同写法 */
const norm = (s: string) => s.replace(/[腾螣]/g, '螣');

test('八字四柱 vs lunar-typescript：报告一致率', async () => {
  let agree = 0;
  const lines: string[] = [];

  for (const c of BAZI_GOLDEN) {
    const p = c.profile;
    const r = await calculateAll(p, { systems: ['bazi'] });
    const mine = fourPillars(r.charts[0]!).join(' ');

    const ec = Lunar.fromSolar(Solar.fromYmdHms(p.year, p.month, p.day, p.hour!, p.minute!, 0)).getEightChar();
    const theirs = [ec.getYear(), ec.getMonth(), ec.getDay(), ec.getTime()].join(' ');

    const ok = mine === theirs;
    if (ok) agree++;
    lines.push(`  ${ok ? '一致  ' : '分歧  '}${c.tag}\n         本平台 ${mine} / lunar-ts ${theirs}`);
  }

  console.log(`\n【八字四柱对拍】${agree}/${BAZI_GOLDEN.length} 一致`);
  for (const l of lines) console.log(l);

  const expectedDivergent = BAZI_GOLDEN.filter((c) => c.knownDivergence).length;
  assert.equal(
    agree,
    BAZI_GOLDEN.length - expectedDivergent,
    `一致率应为 ${BAZI_GOLDEN.length - expectedDivergent}（总分歧数 ${expectedDivergent}）；` +
      `若低于此值说明出现了未记录的新的分歧，必须逐条核实原因`
  );
});

test('大六壬 vs liuren-ts-lib：三传、天将、课体、月将全比对', async () => {
  let chuan = 0;
  let keTi = 0;
  let yueJiang = 0;
  const lines: string[] = [];

  // 动态导入：对拍库是 devDependency，缺失时降级跳过而非让整个测试套件挂掉
  let liurenTs: { getLiuRenByDate: (d: Date) => Record<string, unknown> } | null = null;
  try {
    liurenTs = (await import('liuren-ts-lib')) as unknown as typeof liurenTs;
  } catch {
    console.log('  （liuren-ts-lib 未安装，跳过对拍）');
    return;
  }

  for (const c of LIUREN_GOLDEN) {
    const r = await calculateAll(
      {
        name: 'golden',
        gender: 'male',
        calendarType: 'solar',
        year: c.at.year,
        month: c.at.month,
        day: c.at.day,
        hour: c.at.hour,
        minute: c.at.minute,
      },
      { systems: ['liuren'], question: { topicId: 'general', askedAt: c.at } }
    );
    const d = r.charts[0]!.data as {
      threeTransmissions: Array<{ branch: string; god: string }>;
      transmissionRule: string;
      monthLeader: string;
    };
    const mine = d.threeTransmissions.map((x) => x.branch + norm(x.god)).join('>');
    const mineKeTi = d.transmissionRule.replace(/法$/, '');

    const B = liurenTs!.getLiuRenByDate(
      new Date(c.at.year, c.at.month - 1, c.at.day, c.at.hour, c.at.minute, 0)
    ) as {
      sanChuan?: {
        chuChuan?: string[];
        zhongChuan?: string[];
        moChuan?: string[];
        keTi?: string;
      };
      dateInfo?: { yuejiang?: string };
    };
    const bChuan = [
      B.sanChuan?.chuChuan ? B.sanChuan.chuChuan[0] + norm(B.sanChuan.chuChuan[1] ?? '') : '',
      B.sanChuan?.zhongChuan ? B.sanChuan.zhongChuan[0] + norm(B.sanChuan.zhongChuan[1] ?? '') : '',
      B.sanChuan?.moChuan ? B.sanChuan.moChuan[0] + norm(B.sanChuan.moChuan[1] ?? '') : '',
    ]
      .filter(Boolean)
      .join('>');

    const bKeTi = (B.sanChuan?.keTi ?? '').split('·')[0];
    const bYueJiang = B.dateInfo?.yuejiang;

    const okChuan = mine === bChuan;
    const okKeTi = mineKeTi === bKeTi;
    const okYueJiang = d.monthLeader === bYueJiang;
    if (okChuan) chuan++;
    if (okKeTi) keTi++;
    if (okYueJiang) yueJiang++;

    lines.push(
      `  ${okChuan && okKeTi && okYueJiang ? '全一致' : '有差异'} ${c.tag}\n` +
        `         三传 ${mine} / ${bChuan}${okChuan ? '' : '  ✗'}\n` +
        `         课体 ${mineKeTi} / ${bKeTi}${okKeTi ? '' : '  ✗'}    月将 ${d.monthLeader} / ${bYueJiang}${okYueJiang ? '' : '  ✗'}`
    );
  }

  const total = LIUREN_GOLDEN.length;
  console.log(`\n【大六壬对拍】三传 ${chuan}/${total}  课体 ${keTi}/${total}  月将 ${yueJiang}/${total}`);
  for (const l of lines) console.log(l);

  assert.equal(chuan, total, `大六壬三传应全部一致，实得 ${chuan}/${total}`);
  assert.equal(keTi, total, `大六壬课体应全部一致，实得 ${keTi}/${total}`);
  assert.equal(yueJiang, total, `大六壬月将应全部一致，实得 ${yueJiang}/${total}`);
});

test('同一 seed 抽牌必须可复现，不同 seed 必须不同', () => {
  const draw = (seed: number) => {
    const r = tarotAdapter(mkTarotCtx({ tarot: { spread: 'three', seed } })) as {
      data: { cards: Array<{ name: string; isReversed?: boolean }> };
      randomTrace?: { mode: string; samples: number[] };
      warnings: Array<{ code: string }>;
    };
    return {
      cards: r.data.cards.map((c) => c.name + (c.isReversed ? '(逆)' : '')).join(' | '),
      mode: r.randomTrace?.mode,
      samples: r.randomTrace?.samples ?? [],
      notReproducible: r.warnings.some((w) => w.code === 'tarot.notReproducible'),
    };
  };

  const a1 = draw(12345);
  const a2 = draw(12345);
  const b1 = draw(999);

  console.log(
    `\n【塔罗 seed 复现】\n  seed 12345 第一次 ${a1.cards}\n  seed 12345 第二次 ${a2.cards}\n  seed 999    ${b1.cards}` +
      `\n  randomTrace.mode = ${a1.mode}   样本数 = ${a1.samples.length}`
  );

  // 核心：参数名写错时库会静默回退到 Math.random，mode 会变成 'system'。
  // 这个断言就是防止那类静默失效再次溜进生产。
  assert.ok(!a1.notReproducible, '抽牌必须走种子随机，不能静默回退到系统随机');
  assert.equal(a1.mode, 'seeded', "randomTrace.mode 必须是 'seeded'");
  assert.ok(a1.samples.length > 0, '必须记录随机样本，否则无法事后重放');

  assert.equal(a1.cards, a2.cards, '同 seed 两次抽牌必须完全一致');
  assert.deepEqual(a1.samples, a2.samples, '同 seed 的随机样本序列必须一致');
  assert.notEqual(a1.cards, b1.cards, '不同 seed 应产生不同结果');
});

test('未提供 seed 时抽牌结果恒定，且如实告知', () => {
  const draw = () => {
    const r = tarotAdapter(mkTarotCtx({ tarot: { spread: 'three' } })) as {
      data: { cards: Array<{ name: string }> };
      randomTrace?: { mode: string };
      warnings: Array<{ code: string }>;
    };
    return {
      cards: r.data.cards.map((c) => c.name).join('|'),
      warned: r.warnings.some((w) => w.code === 'tarot.defaultSeed'),
      mode: r.randomTrace?.mode,
    };
  };

  const a = draw();
  const b = draw();
  console.log(`\n【塔罗默认 seed】${a.cards}   mode=${a.mode}`);
  assert.equal(a.cards, b.cards, '未指定 seed 时结果必须恒定');
  assert.equal(a.mode, 'seeded', '默认 seed 也必须走种子随机');
  assert.ok(a.warned, '使用默认 seed 时必须告知用户');
});

test('保存的 samples 可以精确重放抽牌', () => {
  const first = tarotAdapter(mkTarotCtx({ tarot: { spread: 'three', seed: 777 } })) as {
    data: { cards: Array<{ name: string }> };
    randomTrace?: { samples: number[] };
  };
  const samples = first.randomTrace?.samples ?? [];
  assert.ok(samples.length > 0, '必须有样本可供重放');

  // 用 replay 重放：这是复盘时间轴的关键能力
  const replayed = drawTarotSpread('three', { replay: samples }) as {
    data?: unknown;
    cards: Array<{ name: string }>;
    meta: { random: { mode: string } };
  };
  assert.equal(replayed.meta.random.mode, 'replay', 'replay 模式下 mode 应为 replay');
  assert.deepEqual(
    replayed.cards.map((c) => c.name),
    first.data.cards.map((c) => c.name),
    '用保存的 samples 重放必须得到完全相同的牌'
  );
});

// ───────────────────────────── 辅助 ─────────────────────────────

function mkTarotCtx(config: { tarot?: { spread?: 'single' | 'three' | 'love' | 'career' | 'decision'; seed?: number } }) {
  const profile = {
    name: 'x',
    gender: 'male' as const,
    calendarType: 'solar' as const,
    year: 1990,
    month: 5,
    day: 15,
    hour: 14,
    minute: 30,
  };
  return {
    profile,
    normalized: normalizeBirth(profile).normalized,
    config,
  };
}
