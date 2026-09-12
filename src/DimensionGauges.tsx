import React, { useEffect, useState } from 'react';
import type { Consensus, TopicId } from './core';
import { AXIS_LABELS } from './core-meta';

/** 数值滚动：0 → target 平滑递增（参考图动效系统 #8） */
function useCountUp(target: number, duration = 900): number {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setVal(target);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return val;
}

/** 轴 → 中文展示名（贴近设计稿"人生维度"感） */
export const DIM_NAMES: Record<string, string> = {
  action: '行动',
  timing: '时机',
  social: '人际',
  risk: '进取',
  change: '变化',
  auspicious: '吉凶',
};

/**
 * 每轴固定配色 —— 照参考图 Screen 03 的彩色圆环
 * （事业蓝 / 财富青 / 感情粉 / 学业绿 / 人际紫 / 决策青蓝）。
 */
const DIM_COLORS: Record<string, string> = {
  action: '#4a90e2',     // 蓝
  risk: '#2dd4bf',       // 青
  auspicious: '#f472b6', // 粉
  change: '#4ade80',     // 绿
  social: '#a78bfa',     // 紫
  timing: '#38bdf8',     // 青蓝
};

/** 分数 → 参考图风格的状态词 */
function levelLabel(score: number): string {
  if (score >= 68) return '较佳';
  if (score >= 58) return '有利';
  if (score >= 52) return '向上';
  if (score >= 45) return '平稳';
  if (score >= 38) return '谨慎乐观';
  return '守势';
}

/** 加权均值 → 0~100 分数（用于圆环填充） */
function toScore(val: number): number {
  // [-2, 2] → [0, 100]，0 居中
  return Math.round(((val + 2) / 4) * 100);
}

interface DimensionGaugesProps {
  consensus: Consensus[];
  topic: TopicId;
}

/**
 * 六大人生维度 —— 照参考图 Screen 03：
 * 标题行「六大人生维度 / 基于八大体系的综合评估 / 查看详情 →」，
 * 六个彩色圆环，环心大数字，环下维度名 + 彩色状态词。
 */
export function DimensionGauges({ consensus, topic }: DimensionGaugesProps) {
  if (consensus.length === 0) return null;

  // 按主题排优先级：相关轴靠前
  const topicAxes: Partial<Record<TopicId, string[]>> = {
    career: ['action', 'risk', 'timing'],
    romance: ['social', 'auspicious'],
    money: ['auspicious', 'risk'],
    move: ['action', 'timing'],
    study: ['timing', 'auspicious'],
    health: ['auspicious', 'risk'],
    relationship: ['social', 'change'],
  };
  const priority = topicAxes[topic] ?? [];
  const sorted = [...consensus].sort((a, b) => {
    const ai = priority.indexOf(a.axis);
    const bi = priority.indexOf(b.axis);
    if (ai >= 0 && bi >= 0) return ai - bi;
    if (ai >= 0) return -1;
    if (bi >= 0) return 1;
    return 0;
  });

  return (
    <section className="dim-gauges xl-card">
      <div className="dg-head-row">
        <h3 className="dg-head">
          六大人生维度 <span className="sec-en">· LIFE DIMENSIONS</span>
        </h3>
        <span className="dg-sub">基于八大体系的综合评估</span>
        <a className="dg-more" href="#sys-overview" onClick={(e) => {
          e.preventDefault();
          document.querySelector('.sys-overview')?.scrollIntoView({ behavior: 'smooth' });
        }}>查看详情 →</a>
      </div>
      <div className="dg-grid">
        {sorted.map((c) => {
          const lab = AXIS_LABELS[c.axis];
          const score = toScore(c.weightedMean);
          return <GaugeItem key={c.axis} axis={c.axis} score={score} hint={`${lab.positive} / ${lab.negative}`} />;
        })}
      </div>
    </section>
  );
}

/** 单个维度环（拆出来以便每环独立跑数值滚动） */
function GaugeItem({ axis, score, hint }: { axis: string; score: number; hint: string }) {
  const shown = useCountUp(score);
  const color = DIM_COLORS[axis] ?? '#4a90e2';
  const level = levelLabel(score);
  const r = 34;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - shown / 100);

  return (
    <div className="dg-item" title={hint}>
      <svg viewBox="0 0 84 84" width="84" height="84" role="img" aria-label={`${DIM_NAMES[axis]} ${score}分 ${level}`}>
        <defs>
          <linearGradient id={`dgGrad-${axis}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={color} />
            <stop offset="100%" stopColor={color} stopOpacity="0.55" />
          </linearGradient>
        </defs>
        {/* 背景环 */}
        <circle cx="42" cy="42" r={r} fill="none" stroke="var(--line)" strokeWidth="6" strokeOpacity="0.5" />
        {/* 值环（跟随数值滚动一起长） */}
        <circle
          cx="42" cy="42" r={r}
          fill="none"
          stroke={`url(#dgGrad-${axis})`}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          transform="rotate(-90 42 42)"
        />
        {/* 环心大数字 */}
        <text x="42" y="48" textAnchor="middle" className="dg-num" fill={color}>{shown}</text>
      </svg>
      <div className="dg-label">{DIM_NAMES[axis]}</div>
      <div className="dg-level" style={{ color }}>{level}</div>
    </div>
  );
}
