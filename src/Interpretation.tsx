import React, { useState } from 'react';
import type { InterpretationData } from './core';
import { lookupTerm } from './glossary';

/** 可点击的专业名词，点开弹白话解释（术语词典） */
export function Term({ term, children }: { term?: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const entry = lookupTerm(term);
  if (!entry) return <>{children}</>;
  return (
    <span className="term-wrap">
      <button
        type="button"
        className="term"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      >
        {children}
      </button>
      {open && (
        <span className="term-pop" role="tooltip">
          <b>{entry.title}</b>
          <span>{entry.text}</span>
        </span>
      )}
    </span>
  );
}

/** 确定性解读层渲染：总览 + 指标卡（带术语词典）+ 时间轴 */
export function InterpretationBlock({ data }: { data?: InterpretationData }) {
  if (!data) return null;
  return (
    <div className="interpretation">
      <div className="interp-head">📖 本体系解读</div>
      {data.summary.map((s, i) => (
        <p className="interp-summary" key={i}>
          {s}
        </p>
      ))}
      <div className="interp-highlights">
        {data.highlights.map((h, i) => (
          <div className="hl" key={i}>
            <span className="hl-label">{h.label}</span>
            <span className="hl-value">
              <Term term={h.term}>{h.value}</Term>
            </span>
            {h.note && <span className="hl-note">{h.note}</span>}
          </div>
        ))}
      </div>
      {data.timeline && data.timeline.length > 0 && (
        <div className="interp-timeline">
          {data.timeline.map((t, i) => (
            <div className={`tl-item${t.isCurrent ? ' tl-current' : ''}`} key={i}>
              <span className="tl-label">{t.label}</span>
              <span className="tl-text">{t.text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
