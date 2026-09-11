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
      {/* ===== 工具栏 ===== */}
      <div className="result-head">
        <h2>推演结果</h2>
        <div className="result-head-actions">
          {seed != null && (
            <span className="seed" title={seedMode === 'question' ? '起卦数由「所问之事 + 主题 + 问事时刻」哈希导出，同问题同时刻必然同结果' : '未填所问之事，采用随机起卦'}>
              {seedMode === 'question' ? '🔢 问题起卦' : '🎲 随机起卦'}
            </span>
          )}
          <button className="btn-ghost" type="button" onClick={exportCurrent}>导出 MD</button>
          <button className="btn-ghost" type="button" onClick={exportJSON}>导出 JSON</button>
          {onReroll && (
            <button className="btn-ghost" type="button" onClick={onReroll} title="用新的随机起卦重算">换一卦 ⟳</button>
          )}
          {onShare && <button className="btn-gold" type="button" onClick={onShare}>分享</button>}
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

      {/* ═══════ Level 1: 10秒抓到结论 ═══════ */}
      <ResultSummary
        consensus={consensus}
        headline={report?.headline}
        topicLabel={TOPIC_LABELS[form.topic] ?? form.topic}
        qtext={form.qtext || undefined}
      />

      {/* ═══════ Level 2: 1分钟看懂全貌 ═══════ */}
      <DimensionGauges consensus={consensus} topic={form.topic} />
      <AlignmentView consensus={consensus} topic={form.topic} />
      {/* 命盘层与卜卦层分开算：混算会把「底色」和「当下」两个不同的问题压成一个数 */}
      <LayerView result={result} />
      <DissentView result={result} consensus={consensus} topic={form.topic} />
      <TopicPath topic={form.topic} qtext={form.qtext} />

      {/* ═══════ Level 3: 深度用户 ═══════ */}
      <SystemOverview result={result} showRaw={showRaw} setShowRaw={setShowRaw} />
      {report && <SynthesisReport report={report} topic={form.topic} />}

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
