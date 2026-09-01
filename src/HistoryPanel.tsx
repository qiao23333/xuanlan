import React, { useState } from 'react';
import type { SavedReading } from './history';
import { readingToMarkdown, downloadText, safeFileName } from './history';

/**
 * 历史记录面板：列出已保存的排盘，支持【查看 / 导出 MD / 删除】。
 * 存的是完整结果，所以"查看"是瞬时回放，不重算、不变形。
 */
export function HistoryPanel({
  history,
  onRestore,
  onDelete,
  onClear,
}: {
  history: SavedReading[];
  onRestore: (r: SavedReading) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  return (
    <div className="history">
      <button className="history-toggle" type="button" onClick={() => setOpen((o) => !o)}>
        🕘 历史记录{history.length ? `（${history.length}）` : ''}
        <span className="caret">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="history-panel">
          {history.length === 0 ? (
            <div className="history-empty">还没有记录。排一次盘会自动存入这里，可随时回看或导出。</div>
          ) : (
            <>
              <div className="history-top">
                {confirmClear ? (
                  <span className="confirm">
                    确定清空全部？
                    <button className="link danger" type="button" onClick={() => { onClear(); setConfirmClear(false); }}>清空</button>
                    <button className="link" type="button" onClick={() => setConfirmClear(false)}>取消</button>
                  </span>
                ) : (
                  <button className="link" type="button" onClick={() => setConfirmClear(true)}>清空全部</button>
                )}
              </div>
              <ul className="history-list">
                {history.map((r) => (
                  <li className="hist-item" key={r.id}>
                    <button className="hist-main" type="button" onClick={() => onRestore(r)}>
                      <div className="hist-title">
                        {r.profile.name || '（未署名）'} · {r.topicLabel}
                      </div>
                      <div className="hist-meta">
                        {fmtDate(r.savedAt)} · {r.profile.year}-{String(r.profile.month).padStart(2, '0')}-{String(r.profile.day).padStart(2, '0')}
                      </div>
                    </button>
                    <div className="hist-actions">
                      <button className="link" type="button" onClick={() => onRestore(r)}>查看</button>
                      <button
                        className="link"
                        type="button"
                        onClick={() => downloadText(`${safeFileName(r.profile.name || '玄览')}-${r.seed}.md`, readingToMarkdown(r))}
                      >
                        导出
                      </button>
                      <button className="link danger" type="button" onClick={() => onDelete(r.id)}>
                        删
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
