import React from 'react';
import type { Consensus, SystemId, TopicId } from './core';
import { SYSTEM_META } from './core';
import { overallAgreement, AXIS_LABELS } from './core-meta';

/** 命盘类（长期结构） */
const STRUCTURAL: SystemId[] = ['bazi', 'ziwei', 'astrolabe'];
/** 卜卦类（当前事件窗口） */
const SITUATIONAL: SystemId[] = ['qimen', 'liuren', 'xiaoliuren', 'meihua', 'tarot'];

/**
 * 从 consensus 数据中提炼核心优势条目（参考图 Screen 03 右栏「核心优势」）。
 * 基于各轴加权均值排序，取 top 维度生成语义化优势描述。
 */
export function deriveCoreAdvantages(consensus: Consensus[]): { icon: string; title: string; desc: string }[] {
  const sorted = [...consensus].sort((a, b) => b.weightedMean - a.weightedMean);
  const top = sorted.slice(0, 3);

  const ADV_TEMPLATES: Record<string, { icon: string; title: string; desc: string }> = {
    action:     { icon: '🧠', title: '思想敏锐', desc: '洞察力强，善于在复杂局势中快速定位关键路径。' },
    timing:     { icon: '⏱️', title: '时机把握', desc: '对节奏变化敏感，懂得在恰当的节点发力，避免盲目行动。' },
    social:     { icon: '🤝', title: '人际融洽', desc: '善于协调各方关系，在团队与合作场景中能发挥桥梁作用。' },
    risk:       { icon: '💪', title: '进取有力', desc: '敢于突破舒适区，面对挑战时展现出坚韧的行动力。' },
    change:     { icon: '🔄', title: '适应力强', desc: '在变化中保持弹性，能较快调整策略以适应新环境。' },
    auspicious: { icon: '🍀', title: '顺势而为', desc: '整体能量场较为顺畅，做事容易得到外部环境的支持。' },
  };

  return top.map((c) => {
    const tpl = ADV_TEMPLATES[c.axis] ?? { icon: '✦', title: DIM_NAMES[c.axis] || c.axis, desc: `${AXIS_LABELS[c.axis]?.positive || c.axis}维度表现突出。` };
    return { icon: tpl.icon, title: tpl.title, desc: tpl.desc };
  });
}

/** 轴 → 中文展示名（贴近设计稿"人生维度"感） */

interface AlignmentViewProps {
  consensus: Consensus[];
  topic: TopicId;
}

/**
 * 体系共识与分歧 —— 照参考图 Screen 03 左下双卡：
 * 卡1「体系共识与分歧」蓝青渐变甜甜圈 + 图例（高度一致/基本一致/存在分歧）；
 * 卡2「最大分歧」⚡ + 分歧轴 + 唱反调体系 chips + 分歧说明。
 */
export function AlignmentView({ consensus, topic }: AlignmentViewProps) {
  if (consensus.length === 0) return null;

  const overall = overallAgreement(consensus);
  const pct = Math.round(overall * 100);
  const advantages = deriveCoreAdvantages(consensus);

  // 统计各一致率区间的轴数
  const high = consensus.filter((c) => c.agreement >= 0.75).length;
  const mid = consensus.filter((c) => c.agreement >= 0.5 && c.agreement < 0.75).length;
  const low = consensus.filter((c) => c.agreement < 0.5).length;

  // 找分歧最大的轴
  const dissent = [...consensus].filter((c) => c.sampleSize >= 3).sort((a, b) => a.agreement - b.agreement)[0];
  const dissentLab = dissent ? AXIS_LABELS[dissent.axis] : null;

  const R = 44;
  const CIRC = 2 * Math.PI * R;

  return (
    <section className="alignment">
      <div className="al-cards">
        {/* ===== 卡1：共识甜甜圈 ===== */}
        <div className="al-card xl-card">
          <div className="al-head">
            <h3>体系共识与分歧</h3>
          </div>
          <div className="al-body">
            <div className="al-donut-wrap">
              <svg viewBox="0 0 110 110" width="110" height="110" role="img" aria-label={`体系观点一致度 ${pct}%`}>
                <defs>
                  <linearGradient id="donutGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#4a90e2" />
                    <stop offset="100%" stopColor="#2dd4bf" />
                  </linearGradient>
                </defs>
                <circle cx="55" cy="55" r={R} fill="none" stroke="var(--line)" strokeWidth="10" strokeOpacity="0.5" />
                <circle
                  cx="55" cy="55" r={R}
                  fill="none"
                  stroke="url(#donutGrad)"
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={CIRC}
                  strokeDashoffset={CIRC * (1 - pct / 100)}
                  transform="rotate(-90 55 55)"
                  style={{ transition: 'stroke-dashoffset 0.9s cubic-bezier(0.22, 0.61, 0.36, 1)' }}
                />
                <text x="55" y="52" textAnchor="middle" className="al-num">{pct}%</text>
                <text x="55" y="66" textAnchor="middle" className="al-pct">一致度{pct >= 65 ? '较高' : pct >= 40 ? '中等' : '较低'}</text>
              </svg>
            </div>
            <div className="al-legend">
              <div className="al-bd-item"><i className="al-dot" style={{ background: '#4a90e2' }} />高度一致<strong>{high}</strong></div>
              <div className="al-bd-item"><i className="al-dot" style={{ background: '#e8b04b' }} />基本一致<strong>{mid}</strong></div>
              <div className="al-bd-item"><i className="al-dot" style={{ background: '#f472b6' }} />存在分歧<strong>{low}</strong></div>
            </div>
          </div>
          {/* 命盘/卜问分组 */}
          <div className="al-groups">
            <div className="al-group">
              <span className="al-g-label">命盘类 · 长期结构</span>
              <div className="al-g-sys">
                {STRUCTURAL.map((id) => (
                  <span className="al-sys-chip" key={id}>{SYSTEM_META[id].name}</span>
                ))}
              </div>
            </div>
            <div className="al-group">
              <span className="al-g-label">卜问类 · 当前事件</span>
              <div className="al-g-sys">
                {SITUATIONAL.map((id) => (
                  <span className="al-sys-chip" key={id}>{SYSTEM_META[id].name}</span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ===== 卡2：最大分歧 ===== */}
        {dissent && dissentLab && (
          <div className="al-card al-dissent-card xl-card">
            <div className="al-head">
              <h3>
                <span className="al-bolt">⚡</span> 最大分歧{' '}
                <span className="sec-en">· KEY DISAGREEMENT</span>
              </h3>
            </div>
            <div className="al-dissent-axis">
              {dissentLab.positive} / {dissentLab.negative}
              <span className="al-dissent-pct">{Math.round(dissent.agreement * 100)}% 一致</span>
            </div>
            {dissent.outliers.length > 0 && (
              <div className="al-outliers">
                <span className="al-o-label">唱反调</span>
                {dissent.outliers.map((o) => (
                  <span className="al-o-chip" key={o.systemId}>
                    {SYSTEM_META[o.systemId]?.name ?? o.systemId}
                  </span>
                ))}
              </div>
            )}
            <p className="al-dissent-note">
              <b>分歧说明：</b>命盘类反映长期结构，卜问类针对当前事件，时间尺度不同，
              方向差异是正常的——差异本身也是信息。
            </p>
          </div>
        )}

        {/* ===== 卡3：核心优势（参考图 Screen 03 右栏） ===== */}
        <div className="al-card al-advantages-card xl-card">
          <div className="al-head">
            <h3>
              <span className="al-trophy">🏆</span> 核心优势{' '}
              <span className="sec-en">· KEY POINTS</span>
            </h3>
          </div>
          <div className="al-adv-list">
            {advantages.map((adv, i) => (
              <div className="al-adv-item" key={i}>
                <span className="al-adv-icon" aria-hidden="true">{adv.icon}</span>
                <div className="al-adv-text">
                  <strong className="al-adv-title">{adv.title}</strong>
                  <span className="al-adv-desc">{adv.desc}</span>
                </div>
              </div>
            ))}
          </div>
          <p className="al-adv-note">
            以上优势基于八大体系综合评分提取，代表多维共识中的突出特质。
          </p>
        </div>
      </div>
    </section>
  );
}
