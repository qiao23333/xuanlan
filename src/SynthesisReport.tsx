import React, { useMemo, useState } from 'react';
import type { SynthesisReport as Report } from './core';

const TOPIC_LABELS: Record<string, string> = {
  general: '综合',
  career: '事业',
  romance: '感情',
  money: '财运',
  move: '出行/搬迁',
  study: '学业',
  health: '健康',
  relationship: '人际',
  timing: '择时',
};

/**
 * 综合解读报告——把八大体系 + 共识度翻译成人话长文。
 * 确定性生成（来自 kernel 的 synthesizeReport），可一键复制分享。
 */
export function SynthesisReport({ report, topic }: { report: Report; topic?: string }) {
  const [copied, setCopied] = useState(false);
  const topicLabel = topic ? TOPIC_LABELS[topic] ?? topic : '';

  const plain = useMemo(() => {
    const lines: string[] = [];
    lines.push(`玄览 · 综合解读（关于「${topicLabel || '综合'}」）`);
    lines.push(report.headline);
    lines.push('');
    lines.push('—— 各维度共识 ——');
    for (const a of report.byAxis) lines.push(`· ${a.text}`);
    lines.push('');
    lines.push('—— 各体系要点 ——');
    for (const s of report.perSystem) {
      lines.push(`【${s.name}】`);
      for (const p of s.points) lines.push(`  ${p}`);
    }
    lines.push('');
    lines.push('—— 各体系的局限与说明 ——');
    for (const c of report.caveats) lines.push(`· ${c}`);
    return lines.join('\n');
  }, [report, topicLabel]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(plain);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* 剪贴板不可用时静默 */
    }
  };

  if (report.byAxis.length === 0 && report.perSystem.length === 0) return null;

  return (
    <section className="synthesis">
      <div className="syn-head">
        <h3>📜 综合解读报告{topicLabel ? ` · 关于「${topicLabel}」` : ''}</h3>
        <button className="link" type="button" onClick={copy}>
          {copied ? '已复制 ✓' : '复制全文'}
        </button>
      </div>

      <p className="syn-headline">{report.headline}</p>

      {report.question && (
        <blockquote className="syn-question">「{report.question}」</blockquote>
      )}

      {report.sensitivityNote && (
        <p className="syn-sensitivity">{report.sensitivityNote}</p>
      )}

      {report.byAxis.length > 0 && (
        <div className="syn-section">
          <div className="syn-sub">各维度共识</div>
          <ul className="syn-axes">
            {report.byAxis.map((a) => (
              <li key={a.axis} className={`syn-axis syn-${a.direction}`}>
                {a.text}
              </li>
            ))}
          </ul>
        </div>
      )}

      {report.perSystem.length > 0 && (
        <details className="syn-details">
          <summary className="syn-sub">各体系要点（{report.perSystem.length} 套 · 点击展开）</summary>
          <div className="syn-systems">
            {report.perSystem.map((s) => (
              <div className="syn-sys" key={s.systemId}>
                <div className="syn-sys-name">{s.name}</div>
                <ul>
                  {s.points.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </details>
      )}

      <div className="syn-caveats">
        <div className="syn-caveats-head">各体系的局限与说明</div>
        {report.caveats.map((c, i) => (
          <div key={i} className="syn-caveat">{c}</div>
        ))}
      </div>
    </section>
  );
}
