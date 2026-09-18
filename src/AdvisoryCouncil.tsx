import React, { useMemo, useState } from 'react';
import type { AxisId, CalculateResult, Consensus, SystemId, TopicId } from './core';
import { AXIS_LABELS, overallAgreement } from './core-meta';
import { buildAdvisors, leanColor, humanLean, humanAxisMeaning, type Advisor } from './councilData';
import { SystemSigil } from './systemIdentity';

function dirWord(axis: AxisId, score: number): string {
  const lab = AXIS_LABELS[axis];
  if (score > 0.3) return lab.positive;
  if (score < -0.3) return lab.negative;
  return '中性';
}

/**
 * 分歧视觉标记：一条线分叉成两条岔路 = 「走出不一样的判断」。
 * 取代原先直接写「异」汉字——用户明确反对用字符表达分歧。
 */
const FORK = `<path d="M6 1 V7 M6 7 C6 11 1.5 10 1.5 15 M6 7 C6 11 10.5 10 10.5 15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="1.5" cy="15" r="1.5" fill="currentColor" stroke="none"/><circle cx="10.5" cy="15" r="1.5" fill="currentColor" stroke="none"/>`;

/** 点击合议节点后，平滑滚动定位到该体系的结果卡（视图联动）。 */
function focusCard(systemId: string) {
  const el = document.getElementById(`card-${systemId}`);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

/**
 * 八顾问合议 —— 玄览的招牌视图。
 *
 * 把八大体系拟人化为 8 位「参谋」环绕中心「共识环」：
 * - 每位的颜色代表其整体倾向（翠绿=动/吉，朱红=静/凶，金=中性）
 * - 中心环的弧长 = 总体共识度
 * - 带「异」徽章者，是与多数体系分歧最大的参谋
 *
 * 这是在正面回答「凭什么不用 AI 直接问」：AI 给一段自信的整合叙事，
 * 玄览把八个互不兼容的传统体系摆上同一张牌桌，让你看见它们在哪里一致、在哪里拆台。
 */
export function AdvisoryCouncil({
  result,
  consensus,
  topic,
}: {
  result: CalculateResult;
  consensus: Consensus[];
  topic: TopicId;
}) {
  const [selected, setSelected] = useState<SystemId | null>(null);

  const advisors = useMemo<Advisor[]>(() => buildAdvisors(result, consensus), [result, consensus]);

  const overall = overallAgreement(consensus);
  const C = 180;
  const R = 132;
  const N = Math.max(advisors.length, 1);
  const pos = advisors.map((_, i) => {
    const ang = (-90 + (360 / N) * i) * (Math.PI / 180);
    return { x: C + R * Math.cos(ang), y: C + R * Math.sin(ang) };
  });

  const ringR = 92;
  const circ = 2 * Math.PI * ringR;
  const dash = circ * overall;
  const sel = selected ? advisors.find((a) => a.systemId === selected) ?? null : null;

  return (
    <section className="council">
      <div className="council-head">
        <h3>八顾问合议</h3>
        <span className="council-overall">共识 {Math.round(overall * 100)}%</span>
      </div>
      <p className="council-cap">
        八大体系如八位独立参谋，环绕中心「共识环」。翠绿=倾向行动/吉，朱红=倾向保守/凶，金=中性；带「异」者是与多数体系分歧最大的参谋。点任一参谋看其判词。
      </p>

      <div className="council-stage">
        <svg className="council-svg" viewBox="0 0 360 360" role="img" aria-label="八顾问合议图">
          {pos.map((p, i) => {
            const a = advisors[i];
            if (!a) return null;
            return (
              <line
                key={`l${i}`}
                x1={C}
                y1={C}
                x2={p.x}
                y2={p.y}
                stroke={leanColor(a.lean)}
                strokeWidth={leanColor(a.lean) === 'var(--gold)' ? 1 : 1.6}
                opacity={0.28}
              />
            );
          })}

          <circle cx={C} cy={C} r={ringR} fill="none" stroke="var(--line)" strokeWidth={10} />
          <circle
            cx={C}
            cy={C}
            r={ringR}
            fill="none"
            stroke="var(--gold)"
            strokeWidth={10}
            strokeLinecap="round"
            strokeDasharray={circ}
            style={{ '--circ': circ, strokeDashoffset: circ - dash, animation: 'ringDraw 1.1s ease .15s backwards' } as React.CSSProperties}
            transform={`rotate(-90 ${C} ${C})`}
          />
          <text x={C} y={C - 4} textAnchor="middle" className="ring-pct">
            {Math.round(overall * 100)}%
          </text>
          <text x={C} y={C + 18} textAnchor="middle" className="ring-label">
            共识度
          </text>

          {pos.map((p, i) => {
            const a = advisors[i];
            if (!a) return null;
            const col = leanColor(a.lean);
            const isSel = selected === a.systemId;
            return (
              <g
                key={a.systemId}
                className="council-node"
                onClick={() => setSelected(a.systemId)}
                style={{ cursor: 'pointer', animationDelay: `${i * 70}ms` }}
              >
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={isSel ? 27 : 24}
                  fill="var(--panel2)"
                  stroke={a.accent}
                  strokeWidth={isSel ? 3.5 : 2.5}
                  strokeDasharray={a.isOutlier ? '4 3' : undefined}
                />
                <svg
                  x={p.x - 13}
                  y={p.y - 13}
                  width={26}
                  height={26}
                  viewBox="0 0 24 24"
                  className="node-sigil"
                  style={{ color: a.accent }}
                  dangerouslySetInnerHTML={{ __html: a.sigil }}
                />
                <text x={p.x} y={p.y + 42} textAnchor="middle" className="node-name">
                  {a.name}
                </text>
                {a.isOutlier && (
                  <g
                    className="node-badge"
                    transform={`translate(${p.x + 14}, ${p.y - 26}) scale(0.92)`}
                    style={{ color: 'var(--red)' }}
                    dangerouslySetInnerHTML={{ __html: FORK }}
                  />
                )}
              </g>
            );
          })}
        </svg>

        <div className="council-list">
          {advisors.map((a) => {
            const col = leanColor(a.lean);
            return (
              <button
                key={a.systemId}
                type="button"
                className={`council-chip${a.isOutlier ? ' is-outlier' : ''}${selected === a.systemId ? ' is-sel' : ''}`}
                onClick={() => setSelected(a.systemId)}
                style={{ borderColor: col }}
              >
                <span className="cc-glyph" style={{ color: a.accent }}>
                  <SystemSigil id={a.systemId} size={16} />
                </span>
                <span className="cc-name">{a.name}</span>
                {a.isOutlier && (
                  <span className="cc-badge" title="与其他体系分歧最大" aria-label="分歧最大">
                    <svg viewBox="0 0 12 16" width="11" height="14" dangerouslySetInnerHTML={{ __html: FORK }} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {sel && (
        <div className="council-detail">
          <div className="cd-head">
            <span className="cd-glyph" style={{ color: sel.accent }}>
              <SystemSigil id={sel.systemId} size={22} />
            </span>
            <h4>{sel.name}的判断</h4>
            <span className="cd-lean" style={{ color: leanColor(sel.lean) }}>
              {humanLean(sel.lean)}
            </span>
            <button className="cd-jump" type="button" onClick={() => focusCard(sel.systemId)}>
              查看{sel.name}完整盘面 ›
            </button>
          </div>
          <div className="cd-axes">
            {sel.assertions.map((x, i) => (
              <div className="cd-axis" key={i}>
                <span className="cd-axis-name">
                  {AXIS_LABELS[x.axis].positive} ↔ {AXIS_LABELS[x.axis].negative}
                </span>
                <span className="cd-dir" style={{ color: leanColor(x.score) }}>
                  {dirWord(x.axis, x.score)}
                </span>
                <p className="cd-ev">{x.evidence.join('；')}</p>
                <p className="cd-meaning">{humanAxisMeaning(x.axis, x.score)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
