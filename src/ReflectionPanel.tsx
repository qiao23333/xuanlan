import React, { useEffect, useMemo, useState } from 'react';
import { loadCore } from './loadCore';
import type { SavedReading } from './history';
import {
  VERDICT_META,
  VERDICT_ORDER,
  daysSince,
  dominantText,
  pickDominant,
  summarizeReflection,
  type DominantJudgement,
  type StoredOutcome,
  type Verdict,
} from './reflection';

/**
 * 复盘总览。
 *
 * 呈现原则：**只给对照，不给结论**。这里不会出现「准确率 62%」这种数字，
 * 因为样本通常是个位数，任何比例都是噪声。真正有价值的信息是那张
 * 「当时最强调什么 ↔ 后来你标了什么」的对照表 —— 洞见留给人，不留给算法。
 */
export function ReflectionPanel({
  history,
  onRestore,
}: {
  history: SavedReading[];
  onRestore: (r: SavedReading) => void;
}) {
  const [open, setOpen] = useState(false);
  const stats = useMemo(() => summarizeReflection(history), [history]);

  if (history.length === 0) return null;

  return (
    <div className="reflect">
      <button className="reflect-toggle" type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        🔁 复盘回路{stats.judged ? `（${stats.judged}）` : ''}
        <span className="caret">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="reflect-panel">
          <p className="reflect-note">
            排盘之后，事情到底怎样了？回来说一句，玄览才会从「一次性的解读」变成「能被检验的记录」。
            <b>这里的一切只存在你自己的浏览器里</b>，平台不上传、不聚合、也不对外宣称任何命中率。
          </p>

          {stats.judged === 0 ? (
            <div className="reflect-empty">
              还没有复盘记录。在下方任意一条历史记录上点「复盘」，标记它后来应验了没有 ——
              攒够几条，这里就会显示你自己的对照表。
            </div>
          ) : (
            <>
              <div className="reflect-counts">
                {VERDICT_ORDER.map((v) => {
                  const m = VERDICT_META[v];
                  const n = stats.counts[v];
                  return (
                    <div className={`rc-item rc-${m.tone}`} key={v}>
                      <span className="rc-icon">{m.icon}</span>
                      <b className="rc-num">{n}</b>
                      <span className="rc-label">{m.label}</span>
                    </div>
                  );
                })}
              </div>

              <p className="reflect-caveat">
                共 {stats.total} 条记录，已复盘 {stats.judged} 条。
                {stats.judged < 10 && ' 样本只有个位数，任何比例都不构成统计意义，请只把它当作你自己的备忘录。'}
              </p>

              {stats.byTopic.length > 1 && (
                <div className="reflect-topic">
                  <div className="rt-title">按主题</div>
                  {stats.byTopic.map((t) => (
                    <div className="rt-row" key={t.topic}>
                      <span className="rt-name">{t.label}</span>
                      <span className="rt-bars">
                        {VERDICT_ORDER.map((v) =>
                          t.counts[v] > 0 ? (
                            <i
                              key={v}
                              className={`rt-seg rt-${VERDICT_META[v].tone}`}
                              style={{ flexGrow: t.counts[v] }}
                              title={`${VERDICT_META[v].label} ${t.counts[v]}`}
                            />
                          ) : null
                        )}
                      </span>
                      <span className="rt-total">{t.total}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="reflect-pairs">
                <div className="rt-title">当时怎么说 ↔ 后来怎么样</div>
                {stats.pairs.map(({ reading, outcome }) => (
                  <div className="rp-row" key={reading.id}>
                    <button className="rp-link" type="button" onClick={() => onRestore(reading)}>
                      <span className="rp-when">{fmtDate(reading.savedAt)}</span>
                      <span className="rp-q">{reading.question?.text || reading.topicLabel}</span>
                    </button>
                    <div className="rp-mid">
                      {outcome.dominant ? (
                        <span className="rp-said" title="当时被最多体系强调的一条判断">
                          {dominantText(outcome.dominant)}
                        </span>
                      ) : (
                        <span className="rp-said muted">（未记录主导判断）</span>
                      )}
                      <span className="rp-arrow">→</span>
                      <span className={`rp-verdict rv-${VERDICT_META[outcome.verdict].tone}`}>
                        {VERDICT_META[outcome.verdict].icon} {VERDICT_META[outcome.verdict].label}
                      </span>
                    </div>
                    {outcome.actualNote && <div className="rp-note">{outcome.actualNote}</div>}
                    {outcome.daysAfter != null && outcome.daysAfter > 0 && (
                      <div className="rp-after">{outcome.daysAfter} 天后回来复盘</div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {stats.pending.length > 0 && (
            <div className="reflect-pending">
              有 {stats.pending.length} 条记录已经过去 7 天以上，事情应该有点眉目了 —— 要不要现在回去标一下？
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * 单条复盘编辑器（内联展开）。
 *
 * 「当时最强调的一条判断」要现场算：断言是存在 result 里的，但共识需要
 * aggregateConsensus。这里只在展开时懒加载一次内核，且一旦算过就随
 * outcome 一起固化，避免日后算法演进导致复盘自我证成。
 */
export function ReflectionEditor({
  r,
  onSave,
  onClose,
}: {
  r: SavedReading;
  onSave: (outcome: StoredOutcome | null) => void;
  onClose: () => void;
}) {
  const [verdict, setVerdict] = useState<Verdict | null>(r.outcome?.verdict ?? null);
  const [note, setNote] = useState(r.outcome?.actualNote ?? '');
  const [dominant, setDominant] = useState<DominantJudgement | null>(r.outcome?.dominant ?? null);
  const [loading, setLoading] = useState(!r.outcome?.dominant);

  useEffect(() => {
    if (r.outcome?.dominant) {
      setLoading(false);
      return;
    }
    let alive = true;
    loadCore()
      .then((core) => {
        const c = core.aggregateConsensus(r.result.charts.flatMap((x) => x.assertions));
        const d = pickDominant(c);
        if (alive) {
          setDominant(d);
          setLoading(false);
        }
      })
      .catch(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [r.id, r.outcome?.dominant, r.result]);

  const submit = () => {
    if (!verdict) return;
    onSave({
      verdict,
      actualNote: note.trim() || undefined,
      resolvedAt: new Date().toISOString(),
      dominant: dominant ?? undefined,
      daysAfter: daysSince(r.savedAt),
    });
  };

  return (
    <div className="reflect-editor">
      <div className="re-head">
        复盘：{r.profile.name || '（未署名）'} · {r.topicLabel}
        <span className="re-when">{fmtDate(r.savedAt)}</span>
      </div>

      {r.question?.text && <div className="re-q">所问：{r.question.text}</div>}

      <div className="re-said">
        {loading ? '正在提取当时的主导判断…' : dominant ? `当时最强调：${dominantText(dominant)}` : '当时没有形成明确倾向'}
      </div>

      <div className="re-pick">
        {VERDICT_ORDER.map((v) => {
          const m = VERDICT_META[v];
          return (
            <button
              key={v}
              type="button"
              className={`re-opt rv-${m.tone}${verdict === v ? ' on' : ''}`}
              aria-pressed={verdict === v}
              onClick={() => setVerdict(v)}
            >
              <span className="re-icon">{m.icon}</span>
              <span className="re-label">{m.label}</span>
              <span className="re-hint">{m.hint}</span>
            </button>
          );
        })}
      </div>

      <textarea
        className="re-note"
        placeholder="后来实际发生了什么？（选填，只给自己看）"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
      />

      <div className="re-actions">
        <button className="link primary" type="button" onClick={submit} disabled={!verdict}>
          记下这条
        </button>
        {r.outcome?.verdict && (
          <button className="link danger" type="button" onClick={() => onSave(null)}>
            撤销标注
          </button>
        )}
        <button className="link" type="button" onClick={onClose}>
          收起
        </button>
      </div>
    </div>
  );
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
