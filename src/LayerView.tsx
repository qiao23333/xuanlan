import React, { useMemo } from 'react';
import { aggregateConsensusByLayer, readCrossLayerGap, type CalculateResult, type Consensus } from './core';
import { AXIS_LABELS } from './core-meta';

const CHART_LABEL = '命盘层 · 长期结构';
const DIV_LABEL = '卜卦层 · 当前窗口';

/**
 * 分层共识 —— 回应评审那条最尖锐的批评：「命盘/卜卦不该直接加权平均」。
 *
 * 之前 UI 只是把八个体系的名字分成两组摆出来（好看），但共识度仍然是
 * 八家一锅炖算出来的（不好）。那等于把「你这个人偏保守」和
 * 「这件事现在别动手」混成一个数 —— 两个不同时间尺度的问题被强行合并。
 *
 * 这里改成：两层各算各的，再把「两层的错位」单独点出来。
 * 错位恰恰是最有信息量的地方：底色和当下不一致时，取中间值是最没用的读法。
 */
export function LayerView({ result }: { result: CalculateResult }) {
  const layered = useMemo(
    () => aggregateConsensusByLayer(result.charts.flatMap((c) => c.assertions)),
    [result]
  );

  if (layered.chart.length === 0 && layered.divination.length === 0) return null;

  const axes = Array.from(
    new Set([...layered.chart, ...layered.divination].map((c) => c.axis))
  );

  return (
    <section className="layer-view xl-card">
      <div className="lv-head">
        <h3>两层分开看：底色 vs 当下</h3>
        <span className="lv-sub">命盘与卜卦回答的不是同一个问题，所以不合并成一个数</span>
      </div>

      <div className="lv-legend">
        <span className="lv-lg lv-lg-chart">{CHART_LABEL}</span>
        <span className="lv-lg lv-lg-div">{DIV_LABEL}</span>
      </div>

      <div className="lv-rows">
        {axes.map((axis) => {
          const c = layered.chart.find((x) => x.axis === axis);
          const d = layered.divination.find((x) => x.axis === axis);
          const lab = AXIS_LABELS[axis];
          return (
            <div className="lv-row" key={axis}>
              <div className="lv-axis">
                {lab.negative}
                <span className="lv-arrow">↔</span>
                {lab.positive}
              </div>
              <LayerBar side="chart" c={c} />
              <LayerBar side="divination" c={d} />
            </div>
          );
        })}
      </div>

      {layered.crossLayerGaps.length > 0 && (
        <div className="lv-gaps">
          <div className="lv-gaps-title">
            <span className="lv-bolt">⚡</span> 跨层张力
          </div>
          {layered.crossLayerGaps.map((g) => (
            <div className="lv-gap" key={g.axis}>
              <div className="lv-gap-head">
                <span className="lv-gap-axis">
                  {AXIS_LABELS[g.axis].negative} ↔ {AXIS_LABELS[g.axis].positive}
                </span>
                <span className="lv-gap-num">
                  底色 {fmt(g.chartMean)} · 当下 {fmt(g.divinationMean)}
                </span>
              </div>
              <p className="lv-gap-read">{readCrossLayerGap(g)}</p>
            </div>
          ))}
          <p className="lv-gap-note">
            底色与当下不一致不是「算错了」。它通常意味着：你长期是这种倾向，但眼前这扇窗开的方向不同。
            <b>取中间值是最没信息量的读法</b>，这里刻意不给你平均数。
          </p>
        </div>
      )}
    </section>
  );
}

function LayerBar({ c, side }: { c?: Consensus; side: 'chart' | 'divination' }) {
  if (!c) return <div className={`lv-bar lv-bar-${side} lv-empty`}>该层未表态</div>;
  const pos = ((c.weightedMean + 2) / 4) * 100;
  const dir = c.weightedMean > 0 ? 1 : c.weightedMean < 0 ? -1 : 0;
  const word = dir === 0 ? '持平' : dir > 0 ? AXIS_LABELS[c.axis].positive : AXIS_LABELS[c.axis].negative;
  return (
    <div className={`lv-bar lv-bar-${side}`}>
      <span className="lv-bar-side">{side === 'chart' ? '底' : '当'}</span>
      <span className="lv-track">
        <i className="lv-track-mid" />
        <i className="lv-knob" style={{ left: `${pos}%` }} />
      </span>
      <span className="lv-bar-word">{word}</span>
      <span className="lv-bar-meta">
        {c.sampleSize}家 · {Math.round(c.agreement * 100)}%
      </span>
    </div>
  );
}

function fmt(n: number): string {
  return (n > 0 ? '+' : '') + n.toFixed(1);
}
