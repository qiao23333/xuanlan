import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BaziView } from './renderers';

const mockBaziData = {
  pillars: {
    year: { gan: '甲', zhi: '子', ganZhi: '甲子' },
    month: { gan: '乙', zhi: '丑', ganZhi: '乙丑' },
    day: { gan: '丙', zhi: '寅', ganZhi: '丙寅' },
    hour: { gan: '丁', zhi: '卯', ganZhi: '丁卯' },
  },
  dayMaster: { gan: '丙', element: '火', yinYang: '阳' },
  zodiac: '鼠',
  lunarDate: { year: 1984, month: 1, day: 15, monthName: '正月', dayName: '十五' },
  solarDate: { year: 1984, month: 2, day: 16 },
  wuxingStrength: { 金: 12, 木: 34, 水: 23, 火: 45, 土: 15 },
  analysis: {
    dayMasterStrength: { status: '偏强', details: { timely: true, seasonalEffect: '支持' } },
    mingGe: { pattern: '正官格', isSpecial: false },
    usefulGod: { useful: '官杀', avoid: '印', favorableWuxing: ['金', '水'] },
  },
  tenGods: { 甲: '偏印', 乙: '正印', 丙: '比肩', 丁: '劫财' },
  shenShaAnalysis: { year: ['天乙贵人', '文昌'], month: ['太极贵人'] },
  lifeStages: { year: '胎', month: '养', day: '长生', hour: '沐浴' },
  nayin: { year: '海中金', month: '海中金', day: '炉中火', hour: '炉中火' },
  luckInfo: {
    startInfo: '3 岁起运',
    handoverInfo: '每逢庚年交换',
    cycles: [
      { age: 3, year: 1987, ganZhi: '丁卯', isXiaoyun: false, type: '大运', years: [{ year: 1987, age: 3, ganZhi: '丁卯', tenGod: '劫财', tenGodZhi: '劫财' }] },
      { age: 13, year: 1997, ganZhi: '戊辰', isXiaoyun: false, type: '大运', years: [] },
    ],
  },
  liunian: [
    { year: 2024, age: 40, ganZhi: '甲辰', tenGod: '偏印', tenGodZhi: '偏印' },
    { year: 2025, age: 41, ganZhi: '乙巳', tenGod: '正印', tenGodZhi: '正印' },
  ],
  age: 41,
};

describe('BaziView', () => {
  it('renders four pillars', () => {
    render(<BaziView data={mockBaziData} />);
    expect(screen.getByText('年柱')).toBeInTheDocument();
    expect(screen.getByText('月柱')).toBeInTheDocument();
    expect(screen.getByText('日柱')).toBeInTheDocument();
    expect(screen.getByText('时柱')).toBeInTheDocument();
    expect(screen.getByText('丙')).toBeInTheDocument();
  });

  it('renders day master info', () => {
    render(<BaziView data={mockBaziData} />);
    // 「日主」同时出现在日主标签与「日主强弱」分项标题，故用 getAllByText
    expect(screen.getAllByText(/日主/).length).toBeGreaterThan(0);
  });

  it('renders analysis section when data provided', () => {
    render(<BaziView data={mockBaziData} />);
    expect(screen.getByText('偏强')).toBeInTheDocument();
    expect(screen.getByText('正官格')).toBeInTheDocument();
    expect(screen.getByText('官杀')).toBeInTheDocument();
  });

  it('renders ten gods fold', () => {
    render(<BaziView data={mockBaziData} />);
    expect(screen.getByText('十神映射')).toBeInTheDocument();
  });

  it('renders luck cycles fold', () => {
    render(<BaziView data={mockBaziData} />);
    // 「大运」同时出现在折叠标题与每步的类型标签，故用 getAllByText
    expect(screen.getAllByText(/大运/).length).toBeGreaterThan(0);
  });

  it('renders liunian fold', () => {
    render(<BaziView data={mockBaziData} />);
    expect(screen.getByText(/流年一览/)).toBeInTheDocument();
  });
});
