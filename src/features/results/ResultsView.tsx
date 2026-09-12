import React from 'react';
import {
  SYSTEM_META,
  type CalculateResult,
  type Consensus,
  type SystemId,
} from '../../core';
import { SystemRenderer, JsonView } from '../../renderers';
import { TopicPath } from '../../TopicPath';
import { ResultSummary } from '../../ResultSummary';
import { DimensionGauges } from '../../DimensionGauges';
import { AlignmentView } from '../../AlignmentView';
import { LayerView } from '../../LayerView';
import { DissentView } from '../../DissentView';
import { SystemOverview } from '../../SystemOverview';
import { SynthesisReport } from '../../SynthesisReport';
import { ResultNav } from '../../ResultNav';
import {
  downloadText,
  safeFileName,
  TOPIC_LABELS,
  readingToMarkdown,
  newReadingId,
  type SavedReading,
} from '../../history';
import type { AppForm } from '../form/DivinationForm';

interface ResultsViewProps {
  result: CalculateResult;
  consensus: Consensus[];
  report: import('../../core').SynthesisReport | null;
  form: AppForm;
  schools: Record<string, string>;
  seed: number | null;
  seedMode: 'question' | 'random';
  showRaw: Record<string, boolean>;
  setShowRaw: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  onFlash: (msg: string) => void;
  onShare?: () => void;
  onReroll?: () => void;
}

const fmtTime = (t?: { year: number; month: number; day: number; hour: number; minute: number; second: number }) =>
  t ? `${t.year}-${String(t.month).padStart(2, '0')}-${String(t.day).padStart(2, '0')} ${String(t.hour).padStart(2, '0')}:${String(t.minute).padStart(2, '0')}` : '—';

/**
 * 结果页 —— v0.5 三层阅读架构（匹配设计稿）。
 *
 * Level 1 (10秒): ResultSummary → 一句话结论 + 总体倾向
 * Level 2 (1分钟): DimensionGauges → AlignmentView → DissentView → 六大维度 + 对齐度 + 分歧
 * Level 3 (深度):   SystemOverview → SynthesisReport → 八大体系详情 + 综合报告
 */
export default function ResultsView({
  result,
  consensus,
  report,
  form,
  schools,
  seed,
  seedMode,
  showRaw,
  setShowRaw,
  onFlash,
  onShare,
  onReroll,
}: ResultsViewProps) {
  const exportCurrent = () => {
    if (!result || seed == null) return;
    const d = new Date();
    const r: SavedReading = {
      id: newReadingId(),
      savedAt: d.toISOString(),
      profile: {
        name: form.name || undefined,
        gender: form.gender,
        calendarType: form.calendarType,
        year: Number(form.year),
        month: Number(form.month),
        day: Number(form.day),
        hour: form.useTimeIndex ? undefined : Number(form.hour),
        minute: form.useTimeIndex ? undefined : Number(form.minute),
        timeIndex: form.useTimeIndex ? Number(form.timeIndex) : undefined,
        location: {
          name: form.locName,
          longitude: Number(form.lng),
          latitude: Number(form.lat),
          timezone: Number(form.tz),
        },
        useTrueSolarTime: form.useTrueSolarTime || undefined,
        applyChinaDst: form.applyChinaDst || undefined,
      },
      schools: { ...schools },
      question: { topicId: form.topic, text: form.qtext || undefined, askedAt: {
        year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate(),
        hour: d.getHours(), minute: d.getMinutes(), second: d.getSeconds(),
      }},
      seed,
      result,
      topicLabel: TOPIC_LABELS[form.topic] ?? form.topic,
    };
    downloadText(`${safeFileName(form.name || '玄览')}-${seed}.md`, readingToMarkdown(r));
    onFlash('已导出 Markdown');
  };

  const exportJSON = () => {
    if (!result || seed == null) return;
    downloadText(
      `${safeFileName(form.name || '玄览')}-${seed}.json`,
      JSON.stringify(result, null, 2),
      'application/json'
    );
    onFlash('已导出 JSON');
  };

  return (
    <section className="results">
      {/* ===== 面包屑 + 标题栏（参考设计稿） ===== */}
      <div className="result-head">
        <button className="breadcrumb" type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          ← 返回探索
        </button>
        <div className="result-title-group">
          <h2>玄览 · 探索结果</h2>
          <p className="result-subtitle">一次输入，八大体系并排推演</p>
        </div>
        <div className="result-head-actions">
          <span className="timebar">
            <span>{fmtTime(result.normalized.effectiveTime)}</span>
            <span className="tb-sep">·</span>
            <span>侦察对象：{form.name || '你自己'}</span>
          </span>
          {onReroll && (
            <button className="btn-gold btn-sm" type="button" onClick={onReroll}>重新演算 →</button>
          )}
        </div>
      </div>

      {/* 生辰条（照参考图 Screen 03：日历图标 + 时间地点 + 真太阳时 + 重新推演） */}
      <div className="profile-bar xl-card">
        <span className="pb-icon" aria-hidden="true">
          <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.2">
            <rect x="1.5" y="2.5" width="13" height="12" rx="2" />
            <line x1="1.5" y1="6" x2="14.5" y2="6" />
            <line x1="5" y1="1" x2="5" y2="4" />
            <line x1="11" y1="1" x2="11" y2="4" />
          </svg>
        </span>
        <span className="pb-time">{fmtTime(result.normalized.effectiveTime)}</span>
        <span className="pb-loc">{form.locName || '—'}</span>
        {form.useTrueSolarTime && <span className="pb-badge">真太阳时</span>}
        <span className="pb-topic">{TOPIC_LABELS[form.topic] ?? form.topic}{form.qtext ? ` · ${form.qtext}` : ''}</span>
        {onReroll && (
          <button className="pb-reroll" type="button" onClick={onReroll} title="用新的随机起卦重算">换一卦 ⟳</button>
        )}
      </div>

      {/* 警告 / 失败 */}
      {result.warnings.length > 0 && (
        <details className="gwarns" open>
          <summary>提示（{result.warnings.length}）</summary>
          {result.warnings.map((w, i) => (
            <div className={`warn warn-${w.level}`} key={i}>[{w.level}] {w.message}</div>
          ))}
        </details>
      )}
      {result.failed.length > 0 && (
        <div className="failed">
          {result.failed.map((f) => <div className="warn warn-error" key={f.systemId}>{SYSTEM_META[f.systemId as SystemId]?.name ?? f.systemId} 失败：{f.message}</div>)}
        </div>
      )}

      <div className="results-body">
        {/* 桌面端粘性章节目录：结果页很长，用它快速定位（小屏自动隐藏） */}
        <ResultNav />

        <div className="results-main">
          {/* ═══════ Level 1: 10秒抓到结论 ═══════ */}
          <div id="sec-summary">
            <ResultSummary
              consensus={consensus}
              headline={report?.headline}
              topicLabel={TOPIC_LABELS[form.topic] ?? form.topic}
              qtext={form.qtext || undefined}
            />
          </div>

          {/* ═══════ Level 2: 1分钟看懂全貌 ═══════ */}
          <div id="sec-axes">
            <DimensionGauges consensus={consensus} topic={form.topic} />
          </div>
          <div id="sec-align">
            <AlignmentView consensus={consensus} topic={form.topic} />
          </div>
          {/* 命盘层与卜卦层分开算：混算会把「底色」和「当下」两个不同的问题压成一个数 */}
          <div id="sec-layers">
            <LayerView result={result} />
          </div>
          <div id="sec-dissent">
            <DissentView result={result} consensus={consensus} topic={form.topic} />
          </div>
          <TopicPath topic={form.topic} qtext={form.qtext} />

          {/* ═══════ Level 3: 深度用户 ═══════ */}
          <div id="sec-systems">
            <SystemOverview
              result={result}
              consensus={consensus}
              topic={form.topic}
              form={form}
              showRaw={showRaw}
              setShowRaw={setShowRaw}
            />
          </div>
          <div id="sec-report">
            {report && <SynthesisReport report={report} topic={form.topic} />}
          </div>
        </div>
      </div>

      {/* 兼容：保留旧 card-wall 作为隐藏的完整数据源（可折叠） */}
      <details className="legacy-wall">
        <summary>完整原始排盘（开发者/深度用户）</summary>
        <div className="wall">
          {result.charts.map((c) => {
            const meta = SYSTEM_META[c.systemId as SystemId];
            const open = showRaw[c.systemId] ?? false;
            return (
              <article className="card legacy-card" key={c.systemId} id={`card-${c.systemId}`}>
                <header className="card-head">
                  <span>{meta?.name ?? c.systemId}</span>
                  <span className="hash">{c.configHash.slice(0, 8)}</span>
                </header>
                <div className="card-body">
                  <SystemRenderer systemId={c.systemId} data={c.data} />
                </div>
                {open && <JsonView data={c.data} />}
              </article>
            );
          })}
        </div>
      </details>
    </section>
  );
}
