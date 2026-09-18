import { describe, it, expect } from 'vitest';
import type { Consensus } from './core';
import { deriveVerdict, primaryAxisOf, axisWord, DIM_NAMES } from './core-meta';

/** 造一条共识。默认口径一致、方向为正。 */
const c = (axis: Consensus['axis'], weightedMean: number, agreement = 0.9, sampleSize = 8): Consensus => ({
  axis,
  weightedMean,
  agreement,
  sampleSize,
  outliers: [],
});

describe('deriveVerdict —— 首屏那口「准话」', () => {
  it('口径一致时说「口径一致」，并把方向词说清楚', () => {
    const v = deriveVerdict([c('auspicious', 1.2, 0.875), c('action', -0.6, 0.7)], 'health');
    expect(v?.stance).toBe('clear');
    expect(v?.axis).toBe('auspicious');
    expect(v?.lean).toBe('吉');
    expect(v?.agreeCount).toBe(7);
    expect(v?.call).toContain('口径一致');
    // 用户要的是「所以呢」——不能只给一个数
    expect(v?.so.length).toBeGreaterThan(10);
  });

  it('打平就直说打平，且不给方向建议，改交付「能确定的那部分」', () => {
    // 主判轴 auspicious 只有 50% 一致（8 家里 4 家，即 4:4 打平），另一条 action 高达 100%
    const v = deriveVerdict([c('auspicious', 0.4, 0.5), c('action', -1.1, 1.0)], 'health');
    expect(v?.stance).toBe('split');
    expect(v?.call).toContain('不给你');
    // 这一条是关键：打平时 so 不能装成结论，必须是「八家说得比较齐的那件」
    expect(v?.so).toContain('说得比较齐');
    expect(v?.so).toContain('行动');
  });

  it('5:3 算「有主调」，4:4 才算「打平」——阈值不能糊在 0.5 上', () => {
    expect(deriveVerdict([c('auspicious', 0.4, 0.625)], 'health')?.stance).toBe('leaning');
    expect(deriveVerdict([c('auspicious', 0.4, 0.5)], 'health')?.stance).toBe('split');
  });

  it('有主调但没到一致时，明说「是倾向，不是定论」', () => {
    const v = deriveVerdict([c('auspicious', 0.5, 0.625)], 'health');
    expect(v?.stance).toBe('leaning');
    expect(v?.call).toContain('不是定论');
  });

  it('主判轴缺席时退到「最有话说」的那条轴，而不是输出空结论', () => {
    // health 的主判轴是 auspicious，这里故意不给它
    const v = deriveVerdict([c('social', 1.4, 0.9), c('change', 0.2, 0.9)], 'health');
    expect(v?.axis).toBe('social');
    expect(v?.call.length).toBeGreaterThan(0);
  });

  it('方向为负时用后端的词（不是把负值说成「差」）', () => {
    const v = deriveVerdict([c('timing', -1.5, 0.9)], 'study');
    expect(v?.axis).toBe('timing');
    expect(v?.lean).toBe('宜守');
    expect(v?.so).toContain('稳住');
  });

  it('值极小（|mean| ≤ 0.3）时说不清方向，不许硬编一个', () => {
    const v = deriveVerdict([c('auspicious', 0.1, 0.9)], 'health');
    expect(v?.lean).toBe('持平');
    expect(v?.hasDirection).toBe(false);
    // 断的是「不许硬编方向」这件本质的事，而不是绑死某句措辞
    // （上一版这里断 `toContain('不擅长')`，文案一改就误报——测试不该跟着文案改）
    expect(v?.call).not.toContain('偏「');
    expect(v?.so).toContain('没给方向');
  });

  it('每个主题都有主判轴、有「所以呢」、有边界话术', () => {
    const topics = ['general', 'career', 'romance', 'money', 'move', 'study', 'health', 'relationship', 'timing'] as const;
    // 六条轴全给，主判轴才一定在（缺轴会走「退到最有话说那条」的兜底，
    // 那样测的就不是「主判轴命中」而是兜底逻辑了）
    const full: Consensus[] = [
      c('auspicious', 1, 0.9),
      c('action', 0.8, 0.9),
      c('timing', -0.9, 0.9),
      c('social', 0.6, 0.9),
      c('risk', -0.7, 0.9),
      c('change', 0.5, 0.9),
    ];
    for (const t of topics) {
      const v = deriveVerdict(full, t);
      expect(v, `主题 ${t} 没产出裁断`).not.toBeNull();
      expect(v?.so.length, `主题 ${t} 的「所以呢」太短`).toBeGreaterThan(10);
      expect(v?.boundary.length, `主题 ${t} 缺边界提醒`).toBeGreaterThan(5);
      expect(v?.dimName).toBe(DIM_NAMES[v!.axis]);
      expect(v?.axis, `主题 ${t} 没走到自己的主判轴`).toBe(primaryAxisOf(t));
    }
  });

  it('方向是中位时不许写「偏「持平」」——要说「一致地看不出方向」', () => {
    // 真实踩点：健康那次一致度 63%（看着像「有主调」），可真值是中位 ——
    // 多数体系都判了 0。于是「有主调」+「方向是中位」拼出了「偏「持平」」这种句子。
    const v = deriveVerdict([c('auspicious', 0.05, 0.875), c('action', -1.1, 1.0)], 'health');
    expect(v?.hasDirection).toBe(false);
    expect(v?.stance).toBe('clear');
    expect(v?.call).not.toContain('偏「持平」');
    expect(v?.call).toContain('没有明确方向');
    // 主判轴没结论时，必须把「能确定的那件」交出去，不能只说「我不知道」
    expect(v?.so).toContain('说得比较齐');
    expect(v?.so).toContain('行动');
    expect(v?.dimName).toBe('吉凶');
  });

  it('中位且没有别的共识时，也要给一句诚实说明而不是空话', () => {
    const v = deriveVerdict([c('auspicious', 0, 0.9)], 'health');
    expect(v?.so.length).toBeGreaterThan(15);
    expect(v?.so).not.toContain('偏「持平」');
  });

  it('任何主题、任何档位都不许在文案里出现「偏「持平」」', () => {
    const topics = ['general', 'career', 'romance', 'money', 'move', 'study', 'health', 'relationship', 'timing'] as const;
    for (const mean of [-1.6, -0.8, -0.2, 0, 0.25, 0.9, 1.5]) {
      for (const agr of [0.375, 0.5, 0.625, 0.875, 1]) {
        for (const t of topics) {
          const v = deriveVerdict([c(primaryAxisOf(t), mean, agr), c('action', -1, 1)], t);
          expect(v?.call, `${t}/${mean}/${agr}`).not.toContain('偏「持平」');
          expect(v?.so, `${t}/${mean}/${agr}`).not.toContain('偏「持平」');
          expect(v?.call.length, `${t}/${mean}/${agr} 的结论为空`).toBeGreaterThan(8);
          expect(v?.so.length, `${t}/${mean}/${agr} 的「所以呢」为空`).toBeGreaterThan(8);
        }
      }
    }
  });

  it('参与体系太少时不许说「口径一致」——n=1 的一致度必然是 100%', () => {
    // 真实踩点：事业题钦定的主判轴「进取」全平台只有八字一家会表态（n=1），
    // 页面于是输出过：「口径一致：偏「避险」（1 家里 1 家同向，一致度 100%）。」
    // 拿一家之言冒充八家共识 —— 这比不说更糟。
    const v = deriveVerdict([c('auspicious', -0.5, 1.0, 1), c('action', -0.6, 1.0, 4)], 'health');
    expect(v?.underSampled).toBe(true);
    expect(v?.sampleSize).toBe(1);
    expect(v?.call).not.toContain('口径一致');
    expect(v?.call).toContain('样本太少');
    // 主判轴不说话了，但必须把「能确定的那件」交出去
    expect(v?.so).toContain('说得比较齐');
  });

  it('样本量够的时候不受门槛影响', () => {
    const v = deriveVerdict([c('auspicious', 0.8, 0.875, 8), c('action', -0.6, 1.0, 4)], 'health');
    expect(v?.underSampled).toBe(false);
    expect(v?.call).toContain('口径一致');
  });

  it('n=2 也在门槛内（n=2 的一致度只能是 50% 或 100%，同样是算术）', () => {
    expect(deriveVerdict([c('auspicious', 0.9, 1.0, 2)], 'health')?.underSampled).toBe(true);
    expect(deriveVerdict([c('auspicious', 0.9, 1.0, 3)], 'health')?.underSampled).toBe(false);
  });

  it('每个主题钦定的主判轴都不该是「只有一两家会表态」的轴', () => {
    // 实测（9 主题 × 6 轴）各轴参与体系数：
    //   吉凶 8 / 时机 5 / 行动 4 / 人际 3 / 变化 2 / 进取 1
    // 「进取」只有八字一家 —— 所以 career 绝不能钦定 risk，否则必触发样本不足。
    // 这条断言把这个对应关系锁住，将来内核增删体系导致 n 变化时会被发现。
    const REAL_SAMPLE: Record<string, number> = {
      auspicious: 8, timing: 5, action: 4, social: 3, change: 2, risk: 1,
    };
    const topics = ['general', 'career', 'romance', 'money', 'move', 'study', 'health', 'relationship', 'timing'] as const;
    for (const t of topics) {
      const axis = primaryAxisOf(t);
      const n = REAL_SAMPLE[axis] ?? 0;
      expect(n, `主题 ${t} 的主判轴 ${axis} 只有 ${n} 家表态`).toBeGreaterThanOrEqual(3);
    }
  });

  it('「说得齐」那条也不许写「倾向「持平」」—— 持平不是一端，不能"倾向"它', () => {
    // 真实踩点：事业题首屏的「说得齐」那条输出过
    // 「时机上 80% 一致，倾向「持平」」。
    const v = deriveVerdict([c('action', -0.61, 1.0, 4), c('timing', -0.2, 0.8, 5)], 'career');
    expect(v?.consensusItem?.axis).toBe('timing');
    expect(v?.consensusItem?.text).not.toContain('持平');
    expect(v?.consensusItem?.text).toContain('中位');
    // 有方向时仍要照实说方向
    const w = deriveVerdict([c('action', -0.61, 1.0, 4), c('timing', -1.2, 0.8, 5)], 'career');
    expect(w?.consensusItem?.text).toContain('倾向「宜守」');
  });

  it('空共识返回 null，让调用方自己去降级', () => {
    expect(deriveVerdict([], 'health')).toBeNull();
  });
});

describe('axisWord 的阈值与展示层保持一致', () => {
  it('±0.3 以内算持平', () => {
    expect(axisWord('change', 0.3)).toBe('持平');
    expect(axisWord('change', 0.31)).toBe('求变');
    expect(axisWord('change', -0.31)).toBe('守常');
  });
});
