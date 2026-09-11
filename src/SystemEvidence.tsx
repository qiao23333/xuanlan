import React from 'react';
import type { Assertion, ChartResult, SystemMeta } from './core';
import { AXIS_LABELS } from './core-meta';

/**
 * 体系详情 · 证据层（Rule → Evidence → 倾向值）
 *
 * 内核的每条 Assertion 本来就带着 evidence 字符串数组与 confidence，
 * 但过去前端只把它拿去算「一致度」，从没把「为什么这么判断」摊给用户看。
 * 这个组件就是补上这一层：让每个体系都能自证其判断，而不是只丢一个结论。
 *
 * 全部字段来自内核确定性产出，组件自身不做任何推断。
 */
export function SystemEvidence({ chart, meta }: { chart: ChartResult; meta: SystemMeta }) {
  const assertions: Assertion[] = (chart?.assertions as Assertion[]) ?? [];
  const applied = Object.entries((chart?.appliedConfig as Record<string, unknown>) ?? {});
  const warnings = (chart?.warnings as Array<{ level: string; code: string; message: string }>) ?? [];
  const divergences: string[] = meta.knownDivergences ?? [];
  const limitations: string[] = meta.limitations ?? [];

  return (
    <section className="sys-evidence">
      <header className="se-head">
        <h5 className="se-title">判断依据</h5>
        <p className="se-sub">规则 → 依据 → 倾向值，全部由确定性算法产出，不经过 AI</p>
      </header>

      {assertions.length === 0 ? (
        <p className="se-empty">本体系本次未产出决策轴断言，仅提供盘面与解读。</p>
      ) : (
        <ol className="se-list">
          {assertions.map((a, i) => {
            const lab = AXIS_LABELS[a.axis];
            const w = (Math.abs(a.score) / 2) * 50;
            const pos = a.score >= 0;
            return (
              <li className="se-item" key={`${a.axis}-${i}`}>
                <span className="se-idx">{String(i + 1).padStart(2, '0')}</span>
                <div className="se-main">
                  <div className="se-row">
                    <span className="se-axis">
                      {lab.positive} <i>↔</i> {lab.negative}
                    </span>
                    <span className={`se-score${pos ? '' : ' neg'}`}>
                      {a.score > 0 ? `+${a.score}` : a.score}
                    </span>
                    <span className="se-conf">确信度 {Math.round(a.confidence * 100)}%</span>
                  </div>

                  {/* 倾向条：以中点为界，右为正向、左为负向 */}
                  <div className="se-bar" aria-hidden="true">
                    <span className="se-bar-mid" />
                    <span
                      className={`se-bar-fill${pos ? '' : ' neg'}`}
                      style={pos ? { left: '50%', width: `${w}%` } : { right: '50%', width: `${w}%` }}
                    />
                  </div>

                  <ul className="se-ev">
                    {a.evidence.map((e, j) => (
                      <li key={j}>{e}</li>
                    ))}
                  </ul>
                  <div className="se-school">口径 · {a.schoolId}</div>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {applied.length > 0 && (
        <div className="se-block">
          <div className="se-block-head">实际生效的流派参数</div>
          <div className="se-chips">
            {applied.map(([k, v]) => (
              <span className="se-chip" key={k}>
                {k} <b>{String(v)}</b>
              </span>
            ))}
          </div>
          <p className="se-note">
            快照随参数固化：换一个流派参数，下面的结论会变，历史记录里的旧结论不会被改写。
          </p>
        </div>
      )}

      {divergences.length > 0 && (
        <div className="se-block">
          <div className="se-block-head">已知流派分歧点</div>
          <ul className="se-plain">
            {divergences.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>
        </div>
      )}

      {limitations.length > 0 && (
        <div className="se-block se-block-warn">
          <div className="se-block-head">已知边界 · 本体系做不到的地方</div>
          <ul className="se-plain">
            {limitations.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>
        </div>
      )}

      {warnings.length > 0 && (
        <div className="se-block">
          <div className="se-block-head">计算提示</div>
          <ul className="se-plain">
            {warnings.map((w, i) => (
              <li key={i} className={`se-warn se-warn-${w.level}`}>
                {w.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
