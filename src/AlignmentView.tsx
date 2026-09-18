import React from 'react';
import type { AxisId, Consensus, SystemId, TopicId } from './core';
import { SYSTEM_META } from './core';
import { overallAgreement, AXIS_LABELS, DIM_NAMES } from './core-meta';

/** 命盘类（长期结构） */
const STRUCTURAL: SystemId[] = ['bazi', 'ziwei', 'astrolabe'];
/** 卜卦类（当前事件窗口） */
const SITUATIONAL: SystemId[] = ['qimen', 'liuren', 'xiaoliuren', 'meihua', 'tarot'];

/**
 * 每根轴、每个方向各一段文案。
 *
 * **这个表存在的理由，是修一个语义错误**：原实现叫「核心优势」，
 * 取的是 `weightedMean` 最高的三条轴。但 weightedMean 是**方向**不是质量——
 * `timing = +2` 是「宜进」，`−2` 是「宜守」，谁也不比谁「优」。
 * 按数值降序取三条，等于系统性地专挑「指向积极那一端」的轴，
 * 再一律裹成褒义词——于是它变成一台**夸人机器**，跟盘面其实无关。
 *
 * 现在的规则：按 |weightedMean|（倾向强度）取三条，并且**按方向说方向**。
 */
const FACE_COPY: Record<AxisId, { positive: { title: string; desc: string }; negative: { title: string; desc: string } }> = {
  action: {
    positive: { title: '此刻宜动', desc: '八家的信号偏向「推进」——原地等不如往前走一步。' },
    negative: { title: '此刻宜静', desc: '八家的信号偏向「按住」——维持现状比换动作划算。' },
  },
  timing: {
    positive: { title: '时机偏有利', desc: '往前压一段是划算的，重点是把节奏拉起来。' },
    negative: { title: '时机偏不利', desc: '现在推不动，硬推只会消耗自己，等一等更稳。' },
  },
  social: {
    positive: { title: '该借用外力', desc: '主动开口、找人合作，现在的信号支持这个。' },
    negative: { title: '先靠自己', desc: '信号偏向减少外部牵扯，把精力收回到自己身上。' },
  },
  risk: {
    positive: { title: '可以冒一点险', desc: '有余量去试——但要留退路，别一次压满。' },
    negative: { title: '该收一收风险', desc: '现在不适合押注，先降杠杆、守住已有。' },
  },
  change: {
    positive: { title: '该求变', desc: '换一套做法，比在旧做法上加大投入更有效。' },
    negative: { title: '该守常', desc: '同一套做法现在还能用，别急着改。' },
  },
  auspicious: {
    positive: { title: '整体偏顺', desc: '外部条件是帮忙的——借势比硬扛省力。' },
    negative: { title: '整体偏耗', desc: '外部条件不帮忙，这时候少做事比多做事强。' },
  },
};

/**
 * 从 consensus 里提炼「八家看你最明显的三个面」。
 *
 * 按**倾向强度**（|weightedMean|）排序，而不是按数值高低——见 FACE_COPY 的注释。
 * 方向由 sign 决定；|mean| ≤ 0.3 视为这一面没有方向，直接说明白。
 */
export function deriveSalientFaces(consensus: Consensus[]): { title: string; desc: string }[] {
  const sorted = [...consensus].sort((a, b) => Math.abs(b.weightedMean) - Math.abs(a.weightedMean));

  return sorted.slice(0, 3).map((c) => {
    const copy = FACE_COPY[c.axis];
    if (Math.abs(c.weightedMean) <= 0.3) {
      return {
        title: `${DIM_NAMES[c.axis]}· 信号中性`,
        desc: `这一面八家没给出方向（${c.sampleSize} 家参与，一致度 ${Math.round(c.agreement * 100)}%），得按你自己的判断走。`,
      };
    }
    const side = c.weightedMean > 0 ? copy.positive : copy.negative;
    return {
      title: `${DIM_NAMES[c.axis]}· ${side.title}`,
      desc: `${side.desc}（${c.sampleSize} 家参与，一致度 ${Math.round(c.agreement * 100)}%）`,
    };
  });
}

interface AlignmentViewProps {
  consensus: Consensus[];
  topic: TopicId;
}

/**
 * 体系共识与分歧 —— 照参考图 Screen 03 左下双卡：
 * 卡1「体系共识与分歧」蓝青渐变甜甜圈 + 图例（高度一致/基本一致/存在分歧）；
 * 卡2「最大分歧」⚡ + 分歧轴 + 唱反调体系 chips + 分歧说明。
 * 卡3「八家看你最明显的三个面」。
 */
export function AlignmentView({ consensus, topic }: AlignmentViewProps) {
  void topic;
  if (consensus.length === 0) return null;

  const overall = overallAgreement(consensus);
  const pct = Math.round(overall * 100);
  const faces = deriveSalientFaces(consensus);

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
          <p className="al-cap">
            下面这个百分数是<b>八家彼此意见的一致程度</b>——分歧小不代表结论更准，
            更不是给你打的分。
          </p>
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

        {/* ===== 卡3：八家看你最明显的三个面 ===== */}
        <div className="al-card al-advantages-card xl-card">
          <div className="al-head">
            <h3>
              <span className="al-trophy">🎯</span> 八家看你最明显的三个面{' '}
              <span className="sec-en">· TOP 3 SIGNALS</span>
            </h3>
          </div>
          <div className="al-adv-list">
            {faces.map((f, i) => (
              <div className="al-adv-item" key={i}>
                <span className="al-adv-icon" aria-hidden="true">{i + 1}</span>
                <div className="al-adv-text">
                  <strong className="al-adv-title">{f.title}</strong>
                  <span className="al-adv-desc">{f.desc}</span>
                </div>
              </div>
            ))}
          </div>
          <p className="al-adv-note">
            按「八家在这件事上表态的强度」取前三，方向照实说——所以这里会出现
            「该收一收风险」这类话，而不只是一味的好话。
          </p>
        </div>
      </div>
    </section>
  );
}
