import React from 'react';
import type {
  Consensus,
  SystemId,
  TopicId,
  ChartResult,
  SystemMeta,
  CalculateResult,
} from './core';
import { SYSTEM_META } from './core';
import { overallAgreement } from './core-meta';
import { SystemIcon, ACCENTS } from './systemIdentity';
import { SystemRenderer } from './renderers';
import { InterpretationBlock } from './Interpretation';
import { SystemEvidence } from './SystemEvidence';
import { DimensionGauges } from './DimensionGauges';
import { deriveSalientFaces } from './AlignmentView';
import type { AppForm } from './features/form/DivinationForm';

interface SystemDetailViewProps {
  chart: ChartResult;
  meta: SystemMeta;
  consensus: Consensus[];
  result: CalculateResult;
  form: AppForm;
  topic: TopicId;
  showRaw: Record<string, boolean>;
  setShowRaw: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  onClose: () => void;
}

/** 用户档案卡：头像 + 基础信息（参考各体系详情页顶部） */
function ProfileCard({ form }: { form: AppForm }) {
  const name = form.name?.trim() || '探索者';
  const genderLabel = form.gender === 'male' ? '男' : '女';
  const calLabel = form.calendarType === 'solar' ? '阳历' : '阴历';
  const hh = String(form.hour).padStart(2, '0');
  const mm = String(form.minute).padStart(2, '0');
  const birth = `${form.year}年${form.month}月${form.day}日 ${hh}:${mm}`;

  return (
    <div className="sd-profile xl-card">
      <div className="sd-avatar" aria-hidden="true">{name.slice(0, 1)}</div>
      <div className="sd-profile-info">
        <div className="sd-pi-row">
          <strong className="sd-name">{name}</strong>
          <span className="sd-gender">{genderLabel}</span>
        </div>
        <div className="sd-pi-meta">
          <span>{calLabel} · {birth}</span>
          <span className="sd-loc">{form.locName || '—'}</span>
          {form.useTrueSolarTime && <span className="sd-badge">真太阳时</span>}
        </div>
      </div>
      <blockquote className="sd-profile-quote">
        「知命者不怨天，知己者不尤人。」
      </blockquote>
    </div>
  );
}

/** 体系共识甜甜圈（单体系页用：跨轴整体一致度） */
function ConsensusDonut({ consensus }: { consensus: Consensus[] }) {
  const overall = overallAgreement(consensus);
  const pct = Math.round(overall * 100);
  const high = consensus.filter((c) => c.agreement >= 0.75).length;
  const mid = consensus.filter((c) => c.agreement >= 0.5 && c.agreement < 0.75).length;
  const low = consensus.filter((c) => c.agreement < 0.5).length;
  const R = 44;
  const CIRC = 2 * Math.PI * R;

  return (
    <div className="sd-consensus">
      <h4 className="sd-block-title">八大体系共识<span className="sec-en"> · CONSENSUS</span></h4>
      <div className="sd-donut-body">
        <div className="al-donut-wrap">
          <svg viewBox="0 0 110 110" width="104" height="104" role="img" aria-label={`跨体系一致度 ${pct}%`}>
            <defs>
              <linearGradient id="sdDonut" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#4a90e2" />
                <stop offset="100%" stopColor="#2dd4bf" />
              </linearGradient>
            </defs>
            <circle cx="55" cy="55" r={R} fill="none" stroke="var(--line)" strokeWidth="10" strokeOpacity="0.5" />
            <circle
              cx="55" cy="55" r={R}
              fill="none" stroke="url(#sdDonut)" strokeWidth="10" strokeLinecap="round"
              strokeDasharray={CIRC} strokeDashoffset={CIRC * (1 - pct / 100)}
              transform="rotate(-90 55 55)"
              style={{ transition: 'stroke-dashoffset 0.9s cubic-bezier(0.22,0.61,0.36,1)' }}
            />
            <text x="55" y="52" textAnchor="middle" className="al-num">{pct}%</text>
            <text x="55" y="66" textAnchor="middle" className="al-pct">一致度</text>
          </svg>
        </div>
        <div className="al-legend">
          <div className="al-bd-item"><i className="al-dot" style={{ background: '#4a90e2' }} />高度一致<strong>{high}</strong></div>
          <div className="al-bd-item"><i className="al-dot" style={{ background: '#e8b04b' }} />基本一致<strong>{mid}</strong></div>
          <div className="al-bd-item"><i className="al-dot" style={{ background: '#f472b6' }} />存在分歧<strong>{low}</strong></div>
        </div>
      </div>
    </div>
  );
}

/** 三个最明显的面（复用 AlignmentView 的提炼逻辑；按倾向强度取，不按数值高低） */
function KeyPoints({ consensus }: { consensus: Consensus[] }) {
  const faces = deriveSalientFaces(consensus);
  return (
    <div className="sd-keypoints">
      <h4 className="sd-block-title">最明显的三个面<span className="sec-en"> · TOP 3 SIGNALS</span></h4>
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
    </div>
  );
}

/**
 * 单体系详情视图 —— 照 8 张参考图统一框架：
 * 返回链接 → 用户资料卡 → 体系横幅 → 人生维度评分 → 共识与优势双栏 → 专属盘面 → 对比提示。
 * 中央「盘面」复用各体系已有的 SystemRenderer，确保排盘数据真实可信。
 */
export function SystemDetailView({
  chart,
  meta,
  consensus,
  result,
  form,
  topic,
  showRaw,
  setShowRaw,
  onClose,
}: SystemDetailViewProps) {
  const accent = ACCENTS[chart.systemId as SystemId] ?? 'var(--gold)';
  const catLabel = meta.category === 'chart' ? '命盘类 · 长期结构' : '卜卦类 · 当前事件';

  return (
    <article
      className="system-detail"
      style={{ '--accent': accent } as React.CSSProperties}
    >
      {/* 面包屑 */}
      <div className="sd-breadcrumb">
        <button className="breadcrumb" type="button" onClick={onClose}>← 返回探索</button>
        <span className="sd-crumb-sep">/</span>
        <span className="sd-crumb-cur">{meta.name}解读</span>
      </div>

      {/* 用户资料卡 */}
      <ProfileCard form={form} />

      {/* 体系横幅 */}
      <header className="sd-banner">
        <span className="sd-banner-icon"><SystemIcon id={chart.systemId as SystemId} size={56} /></span>
        <div className="sd-banner-text">
          <h2 className="sd-banner-title">{meta.name}</h2>
          <p className="sd-banner-desc">{meta.summary}</p>
          <div className="sd-banner-tags">
            <span className={`sd-tag cat-${meta.category}`}>{catLabel}</span>
            {meta.knownDivergences.slice(0, 2).map((d, i) => (
              <span className="sd-tag" key={i}>{d}</span>
            ))}
          </div>
        </div>
      </header>

      {/* 人生维度评分（复用主结果页六环） */}
      <DimensionGauges consensus={consensus} topic={topic} />

      {/* 共识 + 核心优势 双栏 */}
      <div className="sd-dual">
        <div className="xl-card sd-dual-card"><ConsensusDonut consensus={consensus} /></div>
        <div className="xl-card sd-dual-card"><KeyPoints consensus={consensus} /></div>
      </div>

      {/* 专属盘面 */}
      <section className="sd-panel xl-card">
        <h3 className="sd-panel-title">
          <SystemIcon id={chart.systemId as SystemId} size={22} />
          {meta.name}盘面
        </h3>
        <div className="sd-render">
          <SystemRenderer systemId={chart.systemId} data={chart.data} />
        </div>
        <InterpretationBlock data={chart.interpretation} />
        <SystemEvidence chart={chart} meta={meta} />
        <footer className="so-detail-foot">
          <span className="hash" title={chart.configHash}>hash {chart.configHash.slice(0, 8)}</span>
          <button
            className="link"
            type="button"
            onClick={() => setShowRaw((s) => ({ ...s, [chart.systemId]: !s[chart.systemId] }))}
          >
            {showRaw[chart.systemId] ? '收起原始数据' : '查看原始数据'}
          </button>
        </footer>
        {showRaw[chart.systemId] && (
          <div className="so-raw">
            <pre>{JSON.stringify(chart.data, null, 2)}</pre>
          </div>
        )}
      </section>

      {/* 对比提示：回到综合一览 */}
      <div className="sd-back-overview">
        <button className="link" type="button" onClick={onClose}>← 返回八大体系综合一览</button>
      </div>

      {/* 其他体系（对比矩阵，参考图底部「专业盘面细对比」） */}
      <section className="sd-compare">
        <h4 className="sd-block-title">专业盘面细对比<span className="sec-en"> · COMPARE</span></h4>
        <div className="sd-compare-grid">
          {result.charts
            .filter((c) => c.systemId !== chart.systemId)
            .map((c) => (
              <button
                key={c.systemId}
                className="sd-compare-item"
                type="button"
                style={{ '--so-accent': ACCENTS[c.systemId as SystemId] } as React.CSSProperties}
                onClick={() => onClose()}
              >
                <SystemIcon id={c.systemId as SystemId} size={26} />
                <span>{SYSTEM_META[c.systemId as SystemId]?.name ?? c.systemId}</span>
              </button>
            ))}
        </div>
      </section>
    </article>
  );
}
