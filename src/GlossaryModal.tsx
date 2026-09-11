import React, { useMemo, useState } from 'react';
import { GLOSSARY } from './glossary';
import { useModalA11y } from './useModalA11y';

/**
 * 术语词典浏览弹层（评审 P1：术语扩到 30+ 且可全局搜索）。
 *
 * 命中解释层 highlights 的 term 已在卡片内联点开；这里提供"总览 + 搜索"，
 * 让新手能一次性通览八大体系的关键概念，避免在术语海洋里迷失。
 */
export function GlossaryModal({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState('');
  const modalRef = useModalA11y(onClose);

  const entries = useMemo(() => {
    const all = Object.entries(GLOSSARY).map(([key, v]) => ({ key, ...v }));
    const t = q.trim().toLowerCase();
    if (!t) return all;
    return all.filter(
      (e) =>
        e.key.includes(q.trim()) ||
        e.title.toLowerCase().includes(t) ||
        e.text.toLowerCase().includes(t)
    );
  }, [q]);

  return (
    <div className="modal-veil" onClick={onClose} role="dialog" aria-modal="true" aria-label="术语词典">
      <div className="modal glossary-modal" ref={modalRef} tabIndex={-1} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>
            术语词典 <span className="muted">· {Object.keys(GLOSSARY).length} 条</span>
          </h3>
          <button className="modal-x" type="button" onClick={onClose} aria-label="关闭">
            ✕
          </button>
        </div>
        <input
          className="gl-search"
          placeholder="搜索术语，如：用神、大运、牌阵、分宫制…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoFocus
        />
        <div className="gl-list">
          {entries.map((e) => (
            <div className="gl-item" key={e.key}>
              <div className="gl-term">{e.title}</div>
              <div className="gl-text">{e.text}</div>
            </div>
          ))}
          {entries.length === 0 && <div className="gl-empty">没有匹配「{q}」的术语</div>}
        </div>
      </div>
    </div>
  );
}
