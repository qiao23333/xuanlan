import React, { useState, useMemo } from 'react';
import {
  calculateAll,
  createSeededRandom,
  aggregateConsensus,
  synthesizeReport,
  hashObject,
  SYSTEM_META,
  listSystemMeta,
  type BirthProfile,
  type SchoolConfig,
  type Question,
  type DateTimeParts,
  type TopicId,
  type CalculateResult,
  type SystemId,
  type Consensus,
} from './core';
import { SystemRenderer, JsonView } from './renderers';
import { ConsensusDashboard } from './ConsensusDashboard';
import { SynthesisReport } from './SynthesisReport';
import { InterpretationBlock } from './Interpretation';
import { HistoryPanel } from './HistoryPanel';
import { Landing, TaijiRing } from './Landing';
import { CaseStudy } from './CaseStudy';
import {
  loadHistory,
  saveReading,
  deleteReading,
  clearHistory,
  newReadingId,
  readingToMarkdown,
  downloadText,
  safeFileName,
  TOPIC_LABELS,
  type SavedReading,
} from './history';

/* ───────────── 预设城市（用于真太阳时/星盘坐标） ───────────── */
const CITIES = [
  { name: '北京', longitude: 116.41, latitude: 39.9, timezone: 8 },
  { name: '上海', longitude: 121.47, latitude: 31.23, timezone: 8 },
  { name: '广州', longitude: 113.26, latitude: 23.13, timezone: 8 },
  { name: '成都', longitude: 104.07, latitude: 30.57, timezone: 8 },
  { name: '乌鲁木齐', longitude: 87.62, latitude: 43.82, timezone: 8 },
  { name: '纽约', longitude: -74.0, latitude: 40.71, timezone: -5 },
];

const TOPICS: Array<{ id: TopicId; label: string }> = [
  { id: 'general', label: '综合' },
  { id: 'career', label: '事业' },
  { id: 'romance', label: '感情' },
  { id: 'money', label: '财运' },
  { id: 'move', label: '出行/搬迁' },
  { id: 'study', label: '学业' },
  { id: 'health', label: '健康' },
  { id: 'relationship', label: '人际' },
];

/* 把 { 'qimen.juMethod': 'chaibu' } 写回嵌套对象 */
function buildSchoolConfig(flat: Record<string, string>): SchoolConfig {
  const cfg: any = {};
  for (const [key, val] of Object.entries(flat)) {
    const parts = key.split('.');
    let cur = cfg;
    for (let i = 0; i < parts.length - 1; i++) {
      cur[parts[i]] = cur[parts[i]] ?? {};
      cur = cur[parts[i]];
    }
    cur[parts[parts.length - 1]] = val;
  }
  return cfg as SchoolConfig;
}

type AppForm = {
  name: string;
  gender: 'male' | 'female';
  calendarType: 'solar' | 'lunar';
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  useTimeIndex: boolean;
  timeIndex: number;
  city: string;
  locName: string;
  lng: number;
  lat: number;
  tz: number;
  useTrueSolarTime: boolean;
  applyChinaDst: boolean;
  topic: TopicId;
  qtext: string;
};

/** 表单 → 排盘用的 BirthProfile（handleSubmit 与导出当前记录共用，避免漂移） */
function buildProfile(form: AppForm): BirthProfile {
  return {
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
  };
}

/**
 * 起卦数：由「所问之事 + 主题 + 问事时刻」确定性导出（时刻精确到分，不含秒）。
 *
 * 这是卜卦类体系的命门：**同一问题同一时刻必然同一结果（可复现），
 * 问题变了或时刻变了则结果必变**。刻掉"秒"是为了让用户在同分钟内能重放验证。
 * 命盘类（八字/紫微/占星）不受此影响——它们只吃生辰，本就不该随问事时刻漂移。
 */
function seedFromQuestion(text: string, topic: TopicId, askedAt: DateTimeParts): number {
  const hex = hashObject({
    text: text.trim(),
    topic,
    at: { year: askedAt.year, month: askedAt.month, day: askedAt.day, hour: askedAt.hour, minute: askedAt.minute },
  });
  return parseInt(hex.slice(0, 8), 16) >>> 0;
}

const nowParts = () => {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate(), hour: d.getHours(), minute: d.getMinutes(), second: d.getSeconds() };
};

export default function App() {
  const [form, setForm] = useState({
    name: '',
    gender: 'male' as 'male' | 'female',
    calendarType: 'solar' as 'solar' | 'lunar',
    year: 1990, month: 5, day: 15, hour: 14, minute: 30,
    useTimeIndex: false, timeIndex: 7,
    city: '北京', locName: '北京市', lng: 116.41, lat: 39.9, tz: 8,
    useTrueSolarTime: false, applyChinaDst: false,
    topic: 'general' as TopicId, qtext: '',
  });
  const [schools, setSchools] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const m of listSystemMeta()) {
      for (const sc of m.schools) {
        if (sc.switchable) init[sc.key] = sc.default;
      }
    }
    return init;
  });
  const [result, setResult] = useState<CalculateResult | null>(null);
  const [seed, setSeed] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState<Record<string, boolean>>({});
  const [history, setHistory] = useState<SavedReading[]>(() => loadHistory());
  const [toast, setToast] = useState<string | null>(null);
  const [view, setView] = useState<'landing' | 'divination' | 'case'>('landing');
  const [seedMode, setSeedMode] = useState<'question' | 'random'>('random');

  const flash = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast((t) => (t === msg ? null : t)), 2600);
  };

  const consensus: Consensus[] = useMemo(
    () => (result ? aggregateConsensus(result.charts.flatMap((c) => c.assertions)) : []),
    [result]
  );

  const report = useMemo(
    () => (result ? synthesizeReport(result, consensus, { topic: form.topic, question: form.qtext }) : null),
    [result, consensus, form.topic, form.qtext]
  );

  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  const switchableSchools = listSystemMeta().flatMap((m) =>
    m.schools.filter((s) => s.switchable).map((s) => ({ systemId: m.id, ...s }))
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const profile: BirthProfile = buildProfile(form);
      const question: Question = {
        topicId: form.topic,
        text: form.qtext || undefined,
        askedAt: nowParts(),
      };
      const hasQuestion = form.qtext.trim().length > 0;
      const sd = hasQuestion
        ? seedFromQuestion(form.qtext, form.topic, question.askedAt)
        : Math.floor(Math.random() * 1e9);
      setSeed(sd);
      setSeedMode(hasQuestion ? 'question' : 'random');
      const random = createSeededRandom(sd) as any;
      const res = await calculateAll(profile, {
        question,
        config: buildSchoolConfig(schools),
        random,
      });
      setResult(res);
      const saved: SavedReading = {
        id: newReadingId(),
        savedAt: new Date().toISOString(),
        profile,
        schools: { ...schools },
        question,
        seed: sd,
        result: res,
        topicLabel: TOPIC_LABELS[form.topic] ?? form.topic,
      };
      const list = saveReading(saved);
      setHistory(list);
      flash(`已存入历史记录（共 ${list.length} 条）`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const fmtTime = (t?: { year: number; month: number; day: number; hour: number; minute: number; second: number }) =>
    t ? `${t.year}-${String(t.month).padStart(2, '0')}-${String(t.day).padStart(2, '0')} ${String(t.hour).padStart(2, '0')}:${String(t.minute).padStart(2, '0')}` : '—';

  const restoreReading = (r: SavedReading) => {
    const p = r.profile;
    setForm((f) => ({
      ...f,
      name: p.name ?? '',
      gender: p.gender,
      calendarType: p.calendarType,
      year: p.year,
      month: p.month,
      day: p.day,
      hour: p.hour ?? f.hour,
      minute: p.minute ?? f.minute,
      useTimeIndex: p.timeIndex != null,
      timeIndex: p.timeIndex ?? f.timeIndex,
      city: p.location?.name ?? f.city,
      locName: p.location?.name ?? f.locName,
      lng: p.location?.longitude ?? f.lng,
      lat: p.location?.latitude ?? f.lat,
      tz: p.location?.timezone ?? f.tz,
      useTrueSolarTime: !!p.useTrueSolarTime,
      applyChinaDst: !!p.applyChinaDst,
      topic: (r.question?.topicId ?? 'general') as TopicId,
      qtext: r.question?.text ?? '',
    }));
    setSchools({ ...r.schools });
    setResult(r.result);
    setSeed(r.seed);
    setShowRaw({});
    flash('已载入历史记录');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const exportCurrent = () => {
    if (!result || seed == null) return;
    const r: SavedReading = {
      id: newReadingId(),
      savedAt: new Date().toISOString(),
      profile: buildProfile(form),
      schools: { ...schools },
      question: { topicId: form.topic, text: form.qtext || undefined, askedAt: nowParts() },
      seed,
      result,
      topicLabel: TOPIC_LABELS[form.topic] ?? form.topic,
    };
    downloadText(`${safeFileName(form.name || '玄览')}-${seed}.md`, readingToMarkdown(r));
    flash('已导出 Markdown');
  };

  return (
    <div className="app">
      {view !== 'landing' && (
        <nav className="nav">
          <button className="nav-brand" type="button" onClick={() => setView('divination')}>
            玄览
          </button>
          <button
            className={`nav-item${view === 'divination' ? ' active' : ''}`}
            type="button"
            onClick={() => setView('divination')}
          >
            推演
          </button>
          <button
            className={`nav-item${view === 'case' ? ' active' : ''}`}
            type="button"
            onClick={() => setView('case')}
          >
            项目故事
          </button>
        </nav>
      )}

      {view === 'landing' && (
        <Landing onEnter={() => setView('divination')} onCase={() => setView('case')} />
      )}

      {view === 'divination' && (
        <>
      <header className="hero">
        <h1>玄览 · 术数聚合</h1>
        <p className="tagline">一次输入，八大体系并排推演 · 内核严肃，外壳科普</p>
      </header>

      <div className="disclaimer">
        <strong>文化体验与科普声明：</strong>
        本平台所有结果均由开源术数算法按古籍规则确定性计算，仅供文化体验与学习，<b>不构成任何人生、医疗、法律、投资建议</b>。
        各体系源流、流派分歧与现代学界评价详见每套盘面的「科普」说明。命理预测之有效性尚无科学共识。
      </div>

      <form className="panel form" onSubmit={handleSubmit}>
        <div className="form-grid">
          <label>姓名（可选）<input value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="用于盘面署名" /></label>
          <label>性别
            <select value={form.gender} onChange={(e) => set({ gender: e.target.value as any })}>
              <option value="male">男</option>
              <option value="female">女</option>
            </select>
          </label>
          <label>历法
            <select value={form.calendarType} onChange={(e) => set({ calendarType: e.target.value as any })}>
              <option value="solar">公历</option>
              <option value="lunar">农历</option>
            </select>
          </label>
          <label>出生年<input type="number" value={form.year} onChange={(e) => set({ year: +e.target.value })} /></label>
          <label>月<input type="number" value={form.month} onChange={(e) => set({ month: +e.target.value })} /></label>
          <label>日<input type="number" value={form.day} onChange={(e) => set({ day: +e.target.value })} /></label>
          <label className="chk">
            <input type="checkbox" checked={!form.useTimeIndex} onChange={(e) => set({ useTimeIndex: !e.target.checked })} />
            精确到时分
          </label>
          {!form.useTimeIndex ? (
            <>
              <label>时<input type="number" value={form.hour} onChange={(e) => set({ hour: +e.target.value })} /></label>
              <label>分<input type="number" value={form.minute} onChange={(e) => set({ minute: +e.target.value })} /></label>
            </>
          ) : (
            <label>时辰(0子…11亥)<input type="number" min={0} max={12} value={form.timeIndex} onChange={(e) => set({ timeIndex: +e.target.value })} /></label>
          )}
        </div>

        <div className="form-grid">
          <label>出生地
            <select value={form.city} onChange={(e) => {
              const c = CITIES.find((x) => x.name === e.target.value);
              set({ city: e.target.value, locName: c?.name ?? form.locName, lng: c?.longitude ?? form.lng, lat: c?.latitude ?? form.lat, tz: c?.timezone ?? form.tz });
            }}>
              {CITIES.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
              <option value="__custom">自定义</option>
            </select>
          </label>
          {form.city === '__custom' && (
            <>
              <label>地名<input value={form.locName} onChange={(e) => set({ locName: e.target.value })} /></label>
              <label>经度<input type="number" step="0.01" value={form.lng} onChange={(e) => set({ lng: +e.target.value })} /></label>
              <label>纬度<input type="number" step="0.01" value={form.lat} onChange={(e) => set({ lat: +e.target.value })} /></label>
              <label>时区偏移<input type="number" value={form.tz} onChange={(e) => set({ tz: +e.target.value })} /></label>
            </>
          )}
        </div>

        <div className="switch-row">
          <label className="chk">
            <input type="checkbox" checked={form.useTrueSolarTime} onChange={(e) => set({ useTrueSolarTime: e.target.checked })} />
            启用真太阳时（东西部可差 2 小时以上，将改变日/时柱）
          </label>
          <label className="chk">
            <input type="checkbox" checked={form.applyChinaDst} onChange={(e) => set({ applyChinaDst: e.target.checked })} />
            中国夏令时修正（仅 1986–1991 年出生需要）
          </label>
        </div>

        <div className="form-grid">
          <label>所问之事
            <select value={form.topic} onChange={(e) => set({ topic: e.target.value as any })}>
              {TOPICS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </label>
          <label className="span2">
            具体问题
            <span className="hint">
              参与起卦：卜卦类（六壬/奇门/梅花/小六壬/塔罗）的结果由「问题 + 时刻」共同决定——换时间或换问题，卦就变；
              命盘类（八字/紫微/占星）只吃生辰，不随问事时刻漂移，但流年大运按当前年份推。留空则随机起卦。
            </span>
            <input value={form.qtext} onChange={(e) => set({ qtext: e.target.value })} placeholder="例如：今年适合换工作吗？" />
          </label>
        </div>

        {switchableSchools.length > 0 && (
          <details className="schools">
            <summary>流派开关（改变排盘结果，非展示偏好）</summary>
            <div className="schools-grid">
              {switchableSchools.map((sc) => (
                <label key={sc.key + sc.systemId} className="school-item">
                  <span className="school-label">{SYSTEM_META[sc.systemId as SystemId]?.name} · {sc.label}</span>
                  <select value={schools[sc.key] ?? sc.default} onChange={(e) => setSchools((s) => ({ ...s, [sc.key]: e.target.value }))}>
                    {sc.options.map((o) => <option key={o.value} value={o.value}>{o.label}{o.note ? `（${o.note}）` : ''}</option>)}
                  </select>
                </label>
              ))}
            </div>
          </details>
        )}

        <button className="submit" type="submit" disabled={loading}>
          {loading ? '推演中…' : '⚡ 一次排八大体系'}
        </button>
        {error && <div className="err">出错了：{error}</div>}
      </form>

      <HistoryPanel
        history={history}
        onRestore={restoreReading}
        onDelete={(id) => setHistory(deleteReading(id))}
        onClear={() => { setHistory(clearHistory()); flash('已清空历史记录'); }}
      />

      {result && (
        <section className="results">
          <div className="result-head">
            <h2>推演结果</h2>
            <div className="result-head-actions">
              {seed != null && (
                <span className="seed" title={seedMode === 'question' ? '起卦数由「所问之事 + 主题 + 问事时刻」哈希导出，同问题同时刻必然同结果' : '未填所问之事，采用随机起卦'}>
                  {seedMode === 'question' ? '起卦数' : '随机种子'} {seed}
                  {seedMode === 'question' ? '（随问题与时刻变化）' : '（可复现）'}
                </span>
              )}
              <button className="btn-ghost" type="button" onClick={exportCurrent}>导出 Markdown</button>
              <button className="btn-ghost" type="button" onClick={() => downloadText(`${safeFileName(form.name || '玄览')}-${seed}.json`, JSON.stringify(result, null, 2), 'application/json')}>导出 JSON</button>
            </div>
          </div>

          <div className="timebar">
            <div><b>钟表时间</b>{fmtTime(result.normalized.clockTime)}</div>
            <div><b>排盘时刻</b>{fmtTime(result.normalized.effectiveTime)}
              {result.normalized.trueSolarOffsetSeconds ? `（真太阳时修正 ${result.normalized.trueSolarOffsetSeconds}s）` : ''}
            </div>
            <div><b>时辰</b>第 {result.normalized.timeIndex} 时 · {result.normalized.timeInputMode === 'traditional-shichen' ? '传统时辰' : '精准钟表'}</div>
            <div className="span-all"><b>所问</b>{TOPIC_LABELS[form.topic] ?? form.topic}{form.qtext ? ` · ${form.qtext}` : ' · 未填所问之事（随机起卦）'}</div>
          </div>

          {result.warnings.length > 0 && (
            <details className="gwarns" open>
              <summary>全局提示（{result.warnings.length}）</summary>
              {result.warnings.map((w, i) => (
                <div className={`warn warn-${w.level}`} key={i}>[{w.level}] {w.message}</div>
              ))}
            </details>
          )}

          {result.failed.length > 0 && (
            <div className="failed">
              {result.failed.map((f) => <div className="warn warn-error" key={f.systemId}>{SYSTEM_META[f.systemId]?.name ?? f.systemId} 失败：{f.message}</div>)}
            </div>
          )}

          <ConsensusDashboard consensus={consensus} topic={form.topic} />

          {report && <SynthesisReport report={report} topic={form.topic} />}

          <div className="wall">
            {result.charts.map((c) => {
              const meta = SYSTEM_META[c.systemId as SystemId];
              const open = showRaw[c.systemId] ?? false;
              return (
                <article className="card" key={c.systemId}>
                  <header className="card-head">
                    <span className={`cat cat-${meta?.category}`}>{meta?.category === 'chart' ? '命盘' : '卜卦'}</span>
                    <h3>{meta?.name ?? c.systemId}</h3>
                    <span className="engine" title={c.engineVersion}>v{c.engineVersion.split('@')[1]}</span>
                  </header>
                  <div className="card-body">
                    <SystemRenderer systemId={c.systemId} data={c.data} />
                  </div>
                  <InterpretationBlock data={c.interpretation} />
                  <footer className="card-foot">
                    <span className="hash" title={c.configHash}>hash {c.configHash.slice(0, 8)}</span>
                    <button className="link" onClick={() => setShowRaw((s) => ({ ...s, [c.systemId]: !open }))}>
                      {open ? '收起完整盘面' : '查看完整盘面 / 科普'}
                    </button>
                  </footer>
                  {open && (
                    <div className="card-detail">
                      <div className="detail-section">
                        <h4>科普 · {meta?.name}</h4>
                        <p>{meta?.summary}</p>
                        {meta?.knownDivergences?.length ? (
                          <><div className="sub">已知流派分歧</div><ul>{meta.knownDivergences.map((d, i) => <li key={i}>{d}</li>)}</ul></>
                        ) : null}
                        {meta?.limitations?.length ? (
                          <><div className="sub">诚实边界</div><ul>{meta.limitations.map((d, i) => <li key={i}>{d}</li>)}</ul></>
                        ) : null}
                      </div>
                      {c.warnings.length > 0 && (
                        <div className="detail-section">
                          <h4>本体系提示</h4>
                          {c.warnings.map((w, i) => <div className={`warn warn-${w.level}`} key={i}>[{w.level}] {w.message}</div>)}
                        </div>
                      )}
                      <div className="detail-section">
                        <h4>完整盘面数据（可溯源）</h4>
                        <JsonView data={c.data} />
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      )}

        </>
      )}

      {view === 'case' && <CaseStudy onBack={() => setView('divination')} />}

      {loading && (
        <div className="loading-veil">
          <div className="lv-inner">
            <TaijiRing size={104} spinning />
            <div className="lv-text">起卦中…</div>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
