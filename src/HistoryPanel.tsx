import React, { useMemo, useRef, useState } from 'react';
import type { SavedReading } from './history';
import { readingToMarkdown, downloadText, safeFileName, TOPIC_LABELS } from './history';
import { ReflectionEditor, ReflectionPanel } from './ReflectionPanel';
import { VERDICT_META, type StoredOutcome } from './reflection';

/**
 * 历史记录面板（评审 P1：留存闭环增强）。
 * 在原有「查看/导出/删除/清空」基础上增加：
 *  - 关键词搜索（姓名 / 主题 / 日期）
 *  - 按主题筛选 + 仅看收藏
 *  - 收藏星标
 *  - 一键导出全部（JSON 备份）/ 导入备份
 *  - 复盘回路：给每条记录标记后来是否应验（仅本人可见）
 */
export function HistoryPanel({
  history,
  onRestore,
  onDelete,
  onClear,
  onToggleFavorite,
  onExportAll,
  onImport,
  onSetOutcome,
}: {
  history: SavedReading[];
  onRestore: (r: SavedReading) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
  onToggleFavorite: (id: string) => void;
  onExportAll: () => void;
  onImport: (file: File) => void;
  onSetOutcome: (id: string, outcome: StoredOutcome | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [q, setQ] = useState('');
  const [topic, setTopic] = useState<string>('all');
  const [favOnly, setFavOnly] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [reflecting, setReflecting] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return history.filter((r) => {
      if (favOnly && !r.favorite) return false;
      if (topic !== 'all' && r.question?.topicId !== topic && r.topicLabel !== TOPIC_LABELS[topic]) return false;
      if (!t) return true;
      const hay = `${r.profile.name ?? ''} ${r.topicLabel} ${r.profile.year}-${r.profile.month}-${r.profile.day} ${r.question?.text ?? ''}`.toLowerCase();
      return hay.includes(t);
    });
  }, [history, q, topic, favOnly]);

  const topics = useMemo(() => {
    const set = new Set(history.map((r) => r.question?.topicId ?? 'general'));
    return Array.from(set);
  }, [history]);

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const text = await f.text();
      onImport(f);
      setImportMsg(`已导入备份：${f.name}`);
    } catch {
      setImportMsg('备份文件无法解析，请确认是玄览导出的 JSON');
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="history">
      <button className="history-toggle" type="button" onClick={() => setOpen((o) => !o)}>
        🕘 历史记录{history.length ? `（${history.length}）` : ''}
        <span className="caret">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="history-panel">
          {history.length === 0 ? (
            <div className="history-empty">还没有记录。排一次盘会自动存入这里，可随时回看、收藏或导出。</div>
          ) : (
            <>
              <ReflectionPanel history={history} onRestore={onRestore} />

              <div className="history-toolbar">
                <input
                  className="hist-search"
                  placeholder="搜索姓名 / 主题 / 日期"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
                <select className="hist-topic" value={topic} onChange={(e) => setTopic(e.target.value)}>
                  <option value="all">全部主题</option>
                  {topics.map((t) => (
                    <option key={t} value={t}>
                      {TOPIC_LABELS[t] ?? t}
                    </option>
                  ))}
                </select>
                <button
                  className={`chip${favOnly ? ' on' : ''}`}
                  type="button"
                  onClick={() => setFavOnly((v) => !v)}
                  aria-pressed={favOnly}
                >
                  ★ 收藏
                </button>
              </div>

              <div className="history-top">
                <span className="hist-count">显示 {filtered.length} / {history.length}</span>
                <span className="hist-io">
                  <button className="link" type="button" onClick={onExportAll}>导出全部</button>
                  <button className="link" type="button" onClick={() => fileRef.current?.click()}>导入备份</button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="application/json,.json"
                    style={{ display: 'none' }}
                    onChange={handleImportFile}
                  />
                  {confirmClear ? (
                    <span className="confirm">
                      确定清空？
                      <button className="link danger" type="button" onClick={() => { onClear(); setConfirmClear(false); }}>清空</button>
                      <button className="link" type="button" onClick={() => setConfirmClear(false)}>取消</button>
                    </span>
                  ) : (
                    <button className="link" type="button" onClick={() => setConfirmClear(true)}>清空全部</button>
                  )}
                </span>
              </div>

              {importMsg && <div className="hist-import-msg">{importMsg}</div>}

              {filtered.length === 0 ? (
                <div className="history-empty">没有符合条件的记录。</div>
              ) : (
                <ul className="history-list">
                  {filtered.map((r) => (
                    <li className="hist-item" key={r.id}>
                      <button className="hist-star" type="button" onClick={() => onToggleFavorite(r.id)} aria-label="收藏">
                        {r.favorite ? '★' : '☆'}
                      </button>
                      <button className="hist-main" type="button" onClick={() => onRestore(r)}>
                        <div className="hist-title">
                          {r.profile.name || '（未署名）'} · {r.topicLabel}
                          {r.outcome?.verdict && (
                            <span className={`hist-verdict hv-${VERDICT_META[r.outcome.verdict].tone}`}>
                              {VERDICT_META[r.outcome.verdict].icon} {VERDICT_META[r.outcome.verdict].label}
                            </span>
                          )}
                        </div>
                        <div className="hist-meta">
                          {fmtDate(r.savedAt)} · {r.profile.year}-{String(r.profile.month).padStart(2, '0')}-{String(r.profile.day).padStart(2, '0')}
                        </div>
                      </button>
                      <div className="hist-actions">
                        <button className="link" type="button" onClick={() => onRestore(r)}>查看</button>
                        <button
                          className={`link${r.outcome?.verdict ? ' done' : ''}`}
                          type="button"
                          onClick={() => setReflecting(reflecting === r.id ? null : r.id)}
                        >
                          复盘
                        </button>
                        <button
                          className="link"
                          type="button"
                          onClick={() => {
                            // readingToMarkdown 是异步的（要懒加载内核合成报告），
                            // 必须等它 resolve 之后再下载，否则会存下一个 [object Promise]。
                            readingToMarkdown(r).then((md) =>
                              downloadText(`${safeFileName(r.profile.name || '玄览')}-${r.seed}.md`, md)
                            );
                          }}
                        >
                          导出
                        </button>
                        <button className="link danger" type="button" onClick={() => onDelete(r.id)}>
                          删
                        </button>
                      </div>
                      {reflecting === r.id && (
                        <ReflectionEditor
                          r={r}
                          onSave={(o) => {
                            onSetOutcome(r.id, o);
                            setReflecting(null);
                          }}
                          onClose={() => setReflecting(null)}
                        />
                      )}
                    </li>
                  ))}
                </ul>
              )}
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
