import React, { useMemo, useState } from 'react';
import type { CalculateResult, Consensus, TopicId, AxisId } from './core';
import { AXIS_LABELS } from './core-meta';
import { buildAdvisors, leanColor, type Advisor } from './councilData';
import { SystemSigil } from './systemIdentity';

interface Camp {
  advisor: Advisor;
  score: number;
  evidence: string[];
}

/** 按一致率给这一轴的分歧定性，并给出「该怎么用」的说明 */
function readDivergence(agreement: number, proN: number, conN: number): { level: string; advice: string } {
  const balanced = proN > 0 && conN > 0 && Math.abs(proN - conN) <= 1;
  if (agreement < 0.45) {
    return {
      level: '势均力敌',
      advice: balanced
        ? '两派人数相当、方向相反，这是本轮信号最不干净的一轴。不确定性本身就是要纳入决策的信息——宜先补齐事实（信息、时机、对方态度）再定，不宜把它当作行动依据。'
        : '两派方向相反且差距明显，说明这一轴高度依赖各体系的判断口径。可优先采信样本更多的一侧，同时留意落单的那家是否看到了别人忽略的东西。',
    };
  }
  if (agreement < 0.75) {
    return {
      level: '明显分歧',
      advice: '主流一侧可作为主参考，但反方意见值得看一眼——它往往指出了你还没考虑到的风险面。',
    };
  }
  return {
    level: '轻微分歧',
    advice: '方向基本一致，个别体系保留意见。可作为参考，但分歧幅度小，不必过度解读。',
  };
}

/**
 * 分歧辩论 —— 玄览对「为什么不用 AI 直接问」的终极回答。
 *
 * AI 聊天会把八家意见揉成一段自信的整合叙事，把分歧藏起来。
 * 玄览偏要把分歧演出来：挑出八顾问分歧最大的一轴，把「主张动/吉」与「主张静/凶」
 * 两派各自摊开，让你自己看谁在说什么、凭什么这么说。
 *
 * v0.12 增强：不再只锁死在「分歧最大的一轴」，六条轴可自由切换；
 * 并新增「顾问位置刻度图」——八家在同一根 −2…+2 轴上的落点一目了然。
 */
export function DissentView({
  result,
  consensus,
  topic,
}: {
  result: CalculateResult;
  consensus: Consensus[];
  topic: TopicId;
}) {
  const advisors = useMemo(() => buildAdvisors(result, consensus), [result, consensus]);

  /** 可切换的轴：样本≥2 且未完全一致的轴，按一致率升序（最分歧的在前） */
  const contestedAxes = useMemo(
    () =>
      consensus
        .filter((c) => c.sampleSize >= 2 && c.agreement < 1)
        .sort((a, b) => a.agreement - b.agreement),
    [consensus],
  );

  const [pickedAxis, setPickedAxis] = useState<AxisId | null>(null);

  const debate = useMemo(() => {
    const chosen =
      (pickedAxis ? consensus.find((c) => c.axis === pickedAxis) : undefined) ??
      contestedAxes.find((c) => c.sampleSize >= 3) ??
      contestedAxes[0];
    if (!chosen || chosen.agreement >= 1) return null;

    const axis = chosen.axis as AxisId;
    const lab = AXIS_LABELS[axis];

    const pro: Camp[] = [];
    const con: Camp[] = [];
    const mid: Camp[] = [];
    const marks: Array<{ systemId: Advisor['systemId']; name: string; score: number }> = [];
    for (const a of advisors) {
      const as = a.assertions.find((x) => x.axis === axis);
      if (!as) continue;
      marks.push({ systemId: a.systemId, name: a.name, score: as.score });
      const camp: Camp = { advisor: a, score: as.score, evidence: as.evidence };
      if (as.score > 0.3) pro.push(camp);
      else if (as.score < -0.3) con.push(camp);
      else mid.push(camp);
    }
    if (pro.length === 0 && con.length === 0) return null;

    return {
      axis,
      lab,
      pro,
      con,
      mid,
      marks,
      agreement: chosen.agreement,
      read: readDivergence(chosen.agreement, pro.length, con.length),
    };
  }, [advisors, consensus, contestedAxes, pickedAxis]);

  if (!debate) {
    return (
      <section className="dissent dissent-calm">
        <div className="dissent-head">
          <h3>八顾问合议 · 分歧</h3>
        </div>
        <p className="dissent-cap">
          本轮八家体系在六条决策轴上高度同向——没有形成可供辩论的显著分歧。
          一致性高，往往意味着「信号干净」；但也可能意味着「缺乏互相制衡」。
        </p>
      </section>
    );
  }

  const { lab, pro, con, mid, marks, agreement, read } = debate;
  const activeAxis = debate.axis;

  return (
    <section className="dissent">
      <div className="dissent-head">
        <h3>八顾问合议 · 最大分歧</h3>
        <span className="dissent-axis">
          {lab.positive} ↔ {lab.negative}
        </span>
        <span className="dissent-agree">一致率 {Math.round(agreement * 100)}%</span>
      </div>
      <p className="dissent-cap">
        这是八家分歧最大的一轴。AI 会给你一个揉碎的答案，玄览把两派摊开——你可以自己判断信谁。
      </p>

      {/* 轴切换：其它也有分歧的轴 */}
      {contestedAxes.length > 1 && (
        <div className="dissent-tabs" role="tablist" aria-label="切换决策轴">
          {contestedAxes.map((c) => {
            const l = AXIS_LABELS[c.axis as AxisId];
            const on = c.axis === activeAxis;
            return (
              <button
                key={c.axis}
                type="button"
                role="tab"
                aria-selected={on}
                className={`dtab${on ? ' on' : ''}`}
                onClick={() => setPickedAxis(c.axis as AxisId)}
              >
                <span className="dtab-name">{l.positive}</span>
                <span className="dtab-rate">{Math.round(c.agreement * 100)}%</span>
              </button>
            );
          })}
        </div>
      )}

      {/* 顾问位置刻度图：八家在这根轴上的落点 */}
      {marks.length > 0 && (
        <div className="duel-scale" aria-label={`${lab.positive}到${lab.negative}的顾问分布`}>
          <div className="duel-track">
            <span className="duel-mid" aria-hidden="true" />
            {marks.map((m, i) => (
              <span
                key={m.systemId}
                className="duel-mark"
                title={`${m.name}：${m.score > 0 ? '+' : ''}${m.score}`}
                style={
                  {
                    left: `${((m.score + 2) / 4) * 100}%`,
                    top: `calc(50% + ${((i % 3) - 1) * 9}px)`,
                    '--mk': leanColor(m.score),
                  } as React.CSSProperties
                }
              >
                <SystemSigil id={m.systemId} size={13} />
              </span>
            ))}
          </div>
          <div className="duel-ends">
            <span>
              {lab.negative} −2
            </span>
            <span className="duel-zero">0</span>
            <span>
              +2 {lab.positive}
            </span>
          </div>
        </div>
      )}

      <div className="debate">
        <div className="debate-camp pro">
          <div className="camp-head">
            <span className="camp-glyph">主张 {lab.positive}</span>
            <span className="camp-count">{pro.length} 位顾问</span>
          </div>
          <ul className="camp-list">
            {pro.map((c) => (
              <li key={c.advisor.systemId} className="camp-item">
                <span className="camp-name" style={{ color: leanColor(c.score) }}>
                  <SystemSigil id={c.advisor.systemId} size={15} /> {c.advisor.name}
                  <b className="camp-score">
                    {c.score > 0 ? '+' : ''}
                    {c.score}
                  </b>
                </span>
                <p className="camp-ev">{c.evidence.join('；')}</p>
              </li>
            ))}
            {pro.length === 0 && <li className="camp-empty">（此派暂无人明确主张）</li>}
          </ul>
        </div>

        <div className="debate-mid" aria-hidden="true">vs</div>

        <div className="debate-camp con">
          <div className="camp-head">
            <span className="camp-glyph">主张 {lab.negative}</span>
            <span className="camp-count">{con.length} 位顾问</span>
          </div>
          <ul className="camp-list">
            {con.map((c) => (
              <li key={c.advisor.systemId} className="camp-item">
                <span className="camp-name" style={{ color: leanColor(c.score) }}>
                  <SystemSigil id={c.advisor.systemId} size={15} /> {c.advisor.name}
                  <b className="camp-score">
                    {c.score > 0 ? '+' : ''}
                    {c.score}
                  </b>
                </span>
                <p className="camp-ev">{c.evidence.join('；')}</p>
              </li>
            ))}
            {con.length === 0 && <li className="camp-empty">（此派暂无人明确主张）</li>}
          </ul>
        </div>
      </div>

      {mid.length > 0 && (
        <p className="dissent-mid">
          另有 {mid.length} 位顾问在此轴持中性或折中立场：
          {mid.map((m) => m.advisor.name).join('、')}。
        </p>
      )}

      {/* 分歧解读：这一轴的分歧该怎么用 */}
      <div className="dissent-read">
        <span className="dr-level">{read.level}</span>
        <p className="dr-text">{read.advice}</p>
        <p className="dr-note">
          分歧本身是信息：八家用的是互不相通的本体（五行 / 星曜 / 牌义 / 门星），
          结论不同往往不是谁算错了，而是各自看到的面不同。
        </p>
      </div>
    </section>
  );
}
