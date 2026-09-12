import React, { useState } from 'react';
import {
  SYSTEM_META,
  listSystemMeta,
  type TopicId,
  type SystemId,
} from '../../core';

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
function buildSchoolConfig(flat: Record<string, string>): import('../../core').SchoolConfig {
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
  return cfg as import('../../core').SchoolConfig;
}

export type AppForm = {
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

export const defaultForm: AppForm = {
  name: '',
  gender: 'male',
  calendarType: 'solar',
  year: 1990, month: 5, day: 15, hour: 14, minute: 30,
  useTimeIndex: false, timeIndex: 7,
  city: '北京', locName: '北京市', lng: 116.41, lat: 39.9, tz: 8,
  useTrueSolarTime: false, applyChinaDst: false,
  topic: 'general', qtext: '',
};

export { CITIES, TOPICS, buildSchoolConfig };

interface DivinationFormProps {
  form: AppForm;
  setForm: (patch: Partial<AppForm>) => void;
  schools: Record<string, string>;
  setSchools: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  loading: boolean;
  error: string | null;
  onSubmit: (e: React.FormEvent) => void;
}

/** iOS 风格开关（参考图 Screen 02 的 toggle） */
function Toggle({ checked, onChange, label, hint }: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <label className="f2-switch-row">
      <span className="f2-switch-text">
        <span className="f2-switch-label">{label}</span>
        {hint && <span className="f2-switch-hint">{hint}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        className={`f2-switch${checked ? ' on' : ''}`}
        onClick={() => onChange(!checked)}
      >
        <span className="f2-switch-knob" />
      </button>
    </label>
  );
}

/**
 * 表单 V3 —— 照参考图 Screen 02：
 * 顶部步骤条 → 左表单卡 + 右山水格言卡（双栏）→ iOS 开关 → 蓝色主按钮。
 */
export default function DivinationForm({
  form,
  setForm,
  schools,
  setSchools,
  loading,
  error,
  onSubmit,
}: DivinationFormProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [stepErr, setStepErr] = useState<string | null>(null);
  const set = (patch: Partial<AppForm>) => setForm((f) => ({ ...f, ...patch }));

  const switchableSchools = listSystemMeta().flatMap((m) =>
    m.schools.filter((s) => s.switchable).map((s) => ({ systemId: m.id, ...s }))
  );

  const validateStep1 = (): boolean => {
    const { year, month, day } = form;
    if (!year || !month || !day) { setStepErr('请先填齐出生年 / 月 / 日'); return false; }
    if (year < 1900 || year > 2100) { setStepErr('出生年份请在 1900–2100 之间'); return false; }
    if (month < 1 || month > 12) { setStepErr('月份须在 1–12 之间'); return false; }
    if (day < 1 || day > 31) { setStepErr('日期须在 1–31 之间'); return false; }
    setStepErr(null); return true;
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (step === 1) { if (validateStep1()) setStep(2); return; }
    onSubmit(e);
  };

  return (
    <form className="form-v2" onSubmit={handleFormSubmit}>
      {/* ====== 背景层（AI 山水画） ====== */}
      <div className="f2-bg" aria-hidden="true" />

      {/* ====== 顶栏 ====== */}
      <header className="f2-header">
        <div className="f2-header-left">
          <span className="f2-page-num">{step === 1 ? '02' : '03'}</span>
          <span className="f2-logo">玄览</span>
        </div>
        <nav className="f2-nav" aria-label="主导航">
          <button type="button" className="f2-nav-link">探索</button>
          <span className="f2-nav-sep">·</span>
          <button type="button" className="f2-nav-link">推演</button>
          <span className="f2-nav-sep">·</span>
          <button type="button" className="f2-nav-link">认识自己</button>
        </nav>
        <div className="f2-header-right">
          <span className="f2-tagline-cn">古老的智慧 · 现代的视角 · 更完整的你</span>
          <span className="f2-tagline-en">ANCIENT WISDOM · A MORE COMPLETE YOU</span>
        </div>
      </header>

      {/* ====== 步骤条 ====== */}
      <div className="f2-stepper" aria-label="步骤">
        <span className={`f2-step${step === 1 ? ' active' : ' done'}`}>
          <i className="f2-step-num">1</i>输入信息
        </span>
        <span className="f2-step-line" />
        <span className={`f2-step${step === 2 ? ' active' : ''}`}>
          <i className="f2-step-num">2</i>所问之事
        </span>
      </div>

      {/* ====== 主内容 ====== */}
      <main className={`f2-main${step === 1 ? ' f2-two-col' : ''}`}>
        {step === 1 ? (
          <>
            {/* ---- 左：表单卡 ---- */}
            <div className="f2-card xl-card">
              <div className="f2-title-area">
                <h2 className="f2-title">输入你的出生信息</h2>
                <p className="f2-subtitle">精确的时间与地点，带来更可靠的推演结果</p>
              </div>

              {/* 历法切换 —— 胶囊组 + 滑动指示器 */}
              <div className={`f2-calendar-toggle${form.calendarType === 'lunar' ? ' l-slide-right' : ''}`}>
                <button
                  type="button"
                  className={`f2-toggle-btn${form.calendarType === 'solar' ? ' active' : ''}`}
                  onClick={() => set({ calendarType: 'solar' })}
                >
                  公历 <span className="f2-toggle-hint">(阳历)</span>
                </button>
                <button
                  type="button"
                  className={`f2-toggle-btn${form.calendarType === 'lunar' ? ' active' : ''}`}
                  onClick={() => set({ calendarType: 'lunar' })}
                >
                  农历 <span className="f2-toggle-hint">(阴历)</span>
                </button>
              </div>

              {/* 出生日期 */}
              <div className="f2-field-group">
                <label className="f2-label">出生日期</label>
                <div className="f2-row f2-date-row">
                  <input
                    type="number" className="f2-input f2-input-sm"
                    value={form.year}
                    onChange={(e) => set({ year: +e.target.value })}
                    placeholder="1995"
                    min={1900} max={2100}
                  />
                  <span className="f2-sep">-</span>
                  <input
                    type="number" className="f2-input f2-input-sm"
                    value={form.month}
                    onChange={(e) => set({ month: +e.target.value })}
                    placeholder="08"
                    min={1} max={12}
                  />
                  <span className="f2-sep">-</span>
                  <input
                    type="number" className="f2-input f2-input-sm"
                    value={form.day}
                    onChange={(e) => set({ day: +e.target.value })}
                    placeholder="17"
                    min={1} max={31}
                  />
                </div>
              </div>

              {/* 出生时间 */}
              <div className="f2-field-group">
                <label className="f2-label">出生时间</label>
                <div className="f2-row">
                  <div className="f2-time-wrap">
                    <input
                      type="number" className="f2-input f2-input-sm"
                      value={form.hour}
                      onChange={(e) => set({ hour: +e.target.value })}
                      placeholder="14"
                      min={0} max={23}
                      disabled={form.useTimeIndex}
                    />
                    <span className="f2-sep">:</span>
                    <input
                      type="number" className="f2-input f2-input-sm"
                      value={form.minute}
                      onChange={(e) => set({ minute: +e.target.value })}
                      placeholder="30"
                      min={0} max={59}
                      disabled={form.useTimeIndex}
                    />
                  </div>
                </div>
                <Toggle
                  checked={form.useTimeIndex}
                  onChange={(v) => set({ useTimeIndex: v })}
                  label="不确定出生时辰"
                  hint="若不确知，系统将按所选时辰推算"
                />
                {form.useTimeIndex && (
                  <div className="f2-sub-field">
                    <select className="f2-select" value={form.timeIndex} onChange={(e) => set({ timeIndex: +e.target.value })}>
                      {[...Array(12)].map((_, i) => (
                        <option key={i} value={i}>{['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'][i]}时</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* 性别 —— 胶囊组 + 滑动指示器 */}
              <div className="f2-field-group">
                <label className="f2-label">性别</label>
                <div className={`f2-gender-toggle${form.gender === 'female' ? ' l-slide-right' : ''}`}>
                  <button type="button" className={`f2-gender-btn${form.gender === 'male' ? ' active' : ''}`} onClick={() => set({ gender: 'male' })}>男</button>
                  <button type="button" className={`f2-gender-btn${form.gender === 'female' ? ' active' : ''}`} onClick={() => set({ gender: 'female' })}>女</button>
                </div>
              </div>


              {/* 出生地 */}
              <div className="f2-field-group">
                <label className="f2-label">出生地点</label>
                <div className="f2-row f2-loc-row">
                  <select className="f2-select f2-select-country" value="中国" disabled aria-label="国家">
                    <option>中国</option>
                  </select>
                  <select className="f2-select f2-select-lg" value={form.city} onChange={(e) => {
                    const c = CITIES.find((x) => x.name === e.target.value);
                    set({ city: e.target.value, locName: c ? `${c.name}市` : form.locName, lng: c?.longitude ?? form.lng, lat: c?.latitude ?? form.lat, tz: c?.timezone ?? form.tz });
                  }}>
                    {CITIES.map((c) => <option key={c.name} value={c.name}>{c.name}市</option>)}
                    <option value="__custom">自定义坐标</option>
                  </select>
                </div>
                {form.city === '__custom' ? (
                  <div className="f2-custom-coords">
                    <input className="f2-input" value={form.locName} onChange={(e) => set({ locName: e.target.value })} placeholder="地名" />
                    <input type="number" step="0.01" className="f2-input f2-input-sm" value={form.lng} onChange={(e) => set({ lng: +e.target.value })} placeholder="经度" />
                    <input type="number" step="0.01" className="f2-input f2-input-sm" value={form.lat} onChange={(e) => set({ lat: +e.target.value })} placeholder="纬度" />
                    <input type="number" className="f2-input f2-input-sm" value={form.tz} onChange={(e) => set({ tz: +e.target.value })} placeholder="时区" />
                  </div>
                ) : (
                  <input
                    className="f2-input f2-addr"
                    value={form.locName}
                    onChange={(e) => set({ locName: e.target.value })}
                    placeholder="详细地址（可选）"
                  />
                )}
              </div>

              {/* 真太阳时 */}
              <Toggle
                checked={form.useTrueSolarTime}
                onChange={(v) => set({ useTrueSolarTime: v })}
                label="使用真太阳时"
                hint="根据出生地点经纬度校正，更贴近真实星象"
              />

              {/* 高级选项 */}
              <details className="f2-advanced">
                <summary>高级选项</summary>
                <div className="f2-advanced-body">
                  <Toggle
                    checked={form.applyChinaDst}
                    onChange={(v) => set({ applyChinaDst: v })}
                    label="中国夏令时修正"
                    hint="仅 1986–1991 年出生需要"
                  />
                  {switchableSchools.length > 0 && (
                    <div className="f2-schools-grid">
                      {switchableSchools.map((sc) => (
                        <label key={sc.key + sc.systemId} className="f2-school-item">
                          <span className="f2-school-label">{SYSTEM_META[sc.systemId as SystemId]?.name} · {sc.label}</span>
                          <select className="f2-select f2-select-sm" value={schools[sc.key] ?? sc.default} onChange={(e) => setSchools((s) => ({ ...s, [sc.key]: e.target.value }))}>
                            {sc.options.map((o) => <option key={o.value} value={o.value}>{o.label}{o.note ? `（${o.note}）` : ''}</option>)}
                          </select>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </details>

              {stepErr && <div className="f2-error">{stepErr}</div>}

              <button className="f2-submit" type="submit" disabled={loading}>
                下一步 <span className="f2-arrow">→</span>
              </button>
            </div>

            {/* ---- 右：时间与地点信息卡（参考图 Screen 02） ---- */}
            <aside className="f2-side-card" aria-hidden="true">
              <div className="f2-side-header">
                <h3 className="f2-side-title">时间与地点</h3>
                <span className="f2-side-title-en">TIME AND PLACE</span>
              </div>
              <div className="f2-side-body">
                <p className="f2-side-para">每一个生命，都诞生于天地之间。</p>
                <p className="f2-side-para">精确的时间与地点，是连接你与宇宙的坐标，也是读懂命理的起点。</p>
              </div>
              <div className="f2-side-deco" />
            </aside>
          </>
        ) : (
          <div className="f2-card xl-card f2-card-solo">
            <div className="f2-title-area">
              <h2 className="f2-title">所问之事</h2>
              <p className="f2-subtitle">你问什么，八套体系就一起看什么</p>
            </div>

            <div className="f2-context-line">
              你将为 <b>{form.year}-{String(form.month).padStart(2,'0')}-{String(form.day).padStart(2,'0')}</b> 的命盘提问
            </div>

            <div className="f2-field-group">
              <label className="f2-label">问题方向</label>
              <div className="f2-topic-grid">
                {TOPICS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={`f2-topic-chip${form.topic === t.id ? ' active' : ''}`}
                    onClick={() => set({ topic: t.id })}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="f2-field-group">
              <label className="f2-label">具体问题</label>
              <textarea
                className="f2-textarea"
                value={form.qtext}
                onChange={(e) => set({ qtext: e.target.value })}
                placeholder="例如：今年适合换工作吗？"
                rows={3}
              />
              <p className="f2-field-hint">
                卜卦类体系的结果由「问题 + 时刻」共同决定；命盘类只吃生辰。
                留空则随机起卦。
              </p>
            </div>

            {error && <div className="f2-error">{error}</div>}

            <div className="f2-actions-row">
              <button className="f2-back" type="button" onClick={() => setStep(1)} disabled={loading}>
                ← 返回生辰
              </button>
              <button className="f2-submit f2-submit-primary" type="submit" disabled={loading}>
                {loading ? '推演中…' : '开始推演'}
              </button>
            </div>
          </div>
        )}
      </main>

      {/* ====== 底部特性卡（参考图 Screen 02 底部三栏） ====== */}
      {step === 1 && (
        <div className="f2-features" aria-hidden="true">
          <div className="f2-feat-card">
            <span className="f2-feat-icon" aria-hidden="true">&#8857;</span>
            <span className="f2-feat-label">精准输入</span>
            <span className="f2-feat-desc">越准确，越可靠</span>
          </div>
          <div className="f2-feat-card">
            <span className="f2-feat-icon" aria-hidden="true">&#9728;</span>
            <span className="f2-feat-label">真太阳时</span>
            <span className="f2-feat-desc">更贴近真实星象</span>
          </div>
          <div className="f2-feat-card">
            <span className="f2-feat-icon" aria-hidden="true">&#128274;</span>
            <span className="f2-feat-label">隐私安全</span>
            <span className="f2-feat-desc">信息仅用于推演</span>
          </div>
        </div>
      )}
    </form>
  );
}
