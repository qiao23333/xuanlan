import React, { useState, useMemo } from 'react';
import type {
  BirthProfile,
  Question,
  DateTimeParts,
  CalculateResult,
  Consensus,
} from './core';
import { loadCore, type Core } from './loadCore';
import { Landing, TaijiRing } from './Landing';
import { CaseStudy } from './CaseStudy';
import { HistoryPanel } from './HistoryPanel';
import DivinationForm, { type AppForm, defaultForm, buildSchoolConfig } from './features/form/DivinationForm';
import ResultsView from './features/results/ResultsView';
import { ShareCard } from './ShareCard';
import { parseShareFromHash, type ShareDoc } from './share';
import { ErrorBoundary } from './ErrorBoundary';
import { GlossaryModal } from './GlossaryModal';
import { ConsentGate, PrivacyModal, hasConsented } from './Legal';
import { Onboarding, hasOnboarded } from './Onboarding';
import { ThemeToggle } from './ThemeToggle';
import { MobileTabBar, type MobileTab } from './MobileTabBar';
import { useRevealOnScroll } from './useReveal';
import {
  loadHistory,
  saveReading,
  deleteReading,
  clearHistory,
  newReadingId,
  toggleFavorite,
  setOutcome,
  exportAllJson,
  importBackup,
  downloadText,
  TOPIC_LABELS,
  type SavedReading,
} from './history';

/** 表单 → 排盘用的 BirthProfile */
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

function seedFromQuestion(
  hashObject: (o: unknown) => string,
  text: string,
  topic: string,
  askedAt: DateTimeParts
): number {
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

const APP_VERSION = '0.4.0';

export default function App() {
  const [form, setForm] = useState<AppForm>(defaultForm);
  const [schools, setSchools] = useState<Record<string, string>>({});
  const [result, setResult] = useState<CalculateResult | null>(null);
  const [seed, setSeed] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState<Record<string, boolean>>({});
  const [history, setHistory] = useState<SavedReading[]>(() => loadHistory());
  const [toast, setToast] = useState<string | null>(null);
  const [view, setView] = useState<'landing' | 'divination' | 'case'>('landing');
  // 两段式流程：① 填写信息 → ② 推演结果。
  // 之前两者上下堆在同一页，算完还得自己往下翻，等于「没跳转」。
  // 现在算完自动切到结果段；表单仍在，点顶部「① 填写信息」随时回去改。
  const [stage, setStage] = useState<'form' | 'result'>('form');
  const [seedMode, setSeedMode] = useState<'question' | 'random'>('random');
  const [readOnly, setReadOnly] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  // 本次结果对应的问事时刻。分享链接必须携带它：时辰类体系（梅花/奇门等）
  // 依赖 askedAt 计算，缺了它「逐字一致回放」就会破功。
  const [askedAt, setAskedAt] = useState<DateTimeParts | null>(null);
  // 内核是懒加载的（见 src/loadCore.ts）。core 一旦就绪便常驻，
  // 供 consensus / report 派生与历史回放复用，避免重复下载。
  const [core, setCore] = useState<Core | null>(null);
  const [glossaryOpen, setGlossaryOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [consentDone, setConsentDone] = useState<boolean>(() => hasConsented());
  const [onboardOpen, setOnboardOpen] = useState<boolean>(() => !hasOnboarded());

  const flash = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast((t) => (t === msg ? null : t)), 2600);
  };

  const consensus: Consensus[] = useMemo(
    () => (result && core ? core.aggregateConsensus(result.charts.flatMap((c) => c.assertions)) : []),
    [result, core]
  );

  const report = useMemo(
    () => (result && core ? core.synthesizeReport(result, consensus, { topic: form.topic, question: form.qtext }) : null),
    [result, consensus, core, form.topic, form.qtext]
  );

  const runDivination = async (seedOverride?: number | null, save = true) => {
    setLoading(true);
    setError(null);
    setReadOnly(false);
    try {
      // 内核懒加载：首屏不背这 1.6MB，只有用户真正点「开始推演」才下载。
      const core = await loadCore();
      setCore(core);
      const profile: BirthProfile = buildProfile(form);
      const question: Question = {
        topicId: form.topic,
        text: form.qtext || undefined,
        askedAt: nowParts(),
      };
      setAskedAt(question.askedAt);
      const hasQuestion = form.qtext.trim().length > 0;
      const sd = seedOverride != null
        ? seedOverride
        : hasQuestion
          ? seedFromQuestion(core.hashObject, form.qtext, form.topic, question.askedAt)
          : Math.floor(Math.random() * 1e9);
      setSeed(sd);
      setSeedMode(seedOverride != null ? 'random' : hasQuestion ? 'question' : 'random');
      const random = core.createSeededRandom(sd) as any;
      // 关键：塔罗的种子走 config.tarot.seed（底层库契约），必须显式注入，
      // 否则所有人永远抽到同一副默认牌，「起卦数」就成了摆设。
      const schoolCfg = buildSchoolConfig(schools) as Record<string, unknown>;
      const res = await core.calculateAll(profile, {
        question,
        config: { ...schoolCfg, tarot: { ...(schoolCfg.tarot as object | undefined), seed: sd } },
        random,
      });
      setResult(res);
      // 算完就进结果页，不用手动往下翻
      setStage('result');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      if (save) {
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
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    runDivination(null, true);
  };

  // 换一卦：新的随机起卦数 + 当前问事时刻重算，视作一次新的卜问。
  // 命盘类体系（八字/紫微）依生辰而定，重抽不变属正常玄学行为；
  // 卜卦类（梅花/塔罗/六壬/奇门）随起卦数与时辰变化，会给出新的视角。
  const reroll = () => {
    runDivination(Math.floor(Math.random() * 1e9), false);
    flash('已换一卦 · 视作一次新的卜问');
  };

  const restoreReading = async (r: SavedReading) => {
    // 回放历史也需要内核来重算共识 / 综合报告，先把内核按需拉起来。
    const core = await loadCore();
    setCore(core);
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
      topic: (r.question?.topicId ?? 'general') as AppForm['topic'],
      qtext: r.question?.text ?? '',
    }));
    setSchools({ ...r.schools });
    setResult(r.result);
    setSeed(r.seed);
    setAskedAt(r.question?.askedAt ?? null);
    setShowRaw({});
    setStage('result');
    flash('已载入历史记录');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // 打开带 #/r= 的只读分享链接时：填充生辰与所问、按相同种子重算、进入只读模式。
  React.useEffect(() => {
    let cancelled = false;
    const doc = parseShareFromHash();
    if (!doc) return;
    (async () => {
      try {
        const core = await loadCore();
        if (cancelled) return;
        setCore(core);
        setForm((f) => ({
          ...f,
          name: doc.name ?? '',
          gender: doc.gender,
          calendarType: doc.calendarType,
          year: doc.year, month: doc.month, day: doc.day,
          hour: doc.hour, minute: doc.minute,
          useTimeIndex: doc.useTimeIndex, timeIndex: doc.timeIndex,
          city: doc.locName, locName: doc.locName,
          lng: doc.lng, lat: doc.lat, tz: doc.tz,
          useTrueSolarTime: !!doc.useTrueSolarTime,
          applyChinaDst: !!doc.applyChinaDst,
          topic: doc.topic as AppForm['topic'],
          qtext: doc.qtext,
        }));
        setSchools({ ...doc.schools });
        const profile = buildProfile({
          ...defaultForm,
          name: doc.name ?? '', gender: doc.gender, calendarType: doc.calendarType,
          year: doc.year, month: doc.month, day: doc.day,
          hour: doc.hour, minute: doc.minute,
          useTimeIndex: doc.useTimeIndex, timeIndex: doc.timeIndex,
          locName: doc.locName, lng: doc.lng, lat: doc.lat, tz: doc.tz,
          useTrueSolarTime: !!doc.useTrueSolarTime, applyChinaDst: !!doc.applyChinaDst,
          topic: doc.topic as AppForm['topic'], qtext: doc.qtext,
        } as AppForm);
        const question = { topicId: doc.topic as AppForm['topic'], text: doc.qtext || undefined, askedAt: doc.askedAt };
        const random = core.createSeededRandom(doc.seed) as any;
        // 与提交路径完全一致：种子必须注入 config.tarot.seed，保证回放逐字一致。
        const replayCfg = buildSchoolConfig(doc.schools || {}) as Record<string, unknown>;
        const res = await core.calculateAll(profile, {
          question,
          config: { ...replayCfg, tarot: { ...(replayCfg.tarot as object | undefined), seed: doc.seed } },
          random,
        });
        if (cancelled) return;
        setResult(res);
        setSeed(doc.seed);
        setSeedMode(doc.seedMode);
        setAskedAt(doc.askedAt);
        setReadOnly(true);
        setView('divination');
      } catch {
        /* 分享链接损坏：静默退回首页 */
      }
    })();
    return () => { cancelled = true; };
    // 仅挂载时执行一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const exitReadOnly = () => {
    // 清除哈希，避免刷新后再次进入只读
    history.replaceState(null, '', window.location.pathname + window.location.search);
    setReadOnly(false);
    setResult(null);
    setSeed(null);
    setStage('form');
    setView('landing');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ── 移动端底部导航：view ↔ tab 双向映射 ──
  const activeTab: MobileTab =
    view === 'landing' ? 'explore' : view === 'case' ? 'case' : 'divination';

  const handleTab = (t: MobileTab) => {
    if (t === 'history') {
      setView('divination');
      window.setTimeout(() => {
        document.querySelector('.history')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 80);
      return;
    }
    const next = t === 'explore' ? 'landing' : t === 'case' ? 'case' : 'divination';
    setView(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // 结果/详情区块进入视口时渐显
  useRevealOnScroll(result);

  return (
    <div className={`app${view !== 'landing' ? ' has-mtb' : ' is-landing'}`}>
      {/* 全局导航栏：所有页面统一显示（参考设计稿） */}
      <nav className="nav">
        <button className="nav-brand" type="button" onClick={() => setView('landing')}>
          玄览
        </button>
        <button
          className={`nav-item${view === 'landing' ? ' active' : ''}`}
          type="button"
          onClick={() => setView('landing')}
        >
          首页
        </button>
        <button
          className={`nav-item${view === 'case' ? ' active' : ''}`}
          type="button"
          onClick={() => setView('case')}
        >
          项目故事
        </button>
        <button className="nav-item" type="button" onClick={() => setGlossaryOpen(true)}>
          术语百科
        </button>
        <button className="nav-item" type="button" onClick={() => setOnboardOpen(true)}>
          使用指南
        </button>
        <button className="nav-item" type="button" onClick={() => flash('更新日志开发中…')}>
          更新日志
        </button>
        <button className="nav-item" type="button" onClick={() => flash('关于我们开发中…')}>
          关于我们
        </button>
        <div className="nav-spacer" />
        <ThemeToggle />
        <button
          className="nav-cta"
          type="button"
          onClick={() => { if (view === 'landing') { /* 由 Landing 内的 CTA 处理 */ } else { setView('divination'); setStage('form'); window.scrollTo({ top: 0, behavior: 'smooth' }); } }}
        >
          开始探索 <span className="nav-cta-arrow">→</span>
        </button>
      </nav>

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

          {readOnly && (
            <div className="readonly-banner">
              <span>📜 这是一份<strong>只读分享</strong>：由分享者的生辰与起卦种子确定性重算，结果逐字一致、可溯源。</span>
              <button className="btn-gold" type="button" onClick={exitReadOnly}>我也来算一卦</button>
            </div>
          )}

          {/* 两段式切换：有结果后才能在「填写信息 / 推演结果」之间跳 */}
          {!readOnly && result && (
            <div className="stage-tabs" role="tablist" aria-label="推演流程">
              <button
                type="button"
                role="tab"
                aria-selected={stage === 'form'}
                className={`stage-tab${stage === 'form' ? ' on' : ''}`}
                onClick={() => setStage('form')}
              >
                <span className="st-num">①</span> 填写信息
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={stage === 'result'}
                className={`stage-tab${stage === 'result' ? ' on' : ''}`}
                onClick={() => setStage('result')}
              >
                <span className="st-num">②</span> 推演结果
              </button>
            </div>
          )}

          {!readOnly && (stage === 'form' || !result) && (
            <DivinationForm
              form={form}
              setForm={setForm}
              schools={schools}
              setSchools={setSchools}
              loading={loading}
              error={error}
              onSubmit={handleSubmit}
            />
          )}

          {!readOnly && (stage === 'form' || !result) && (
            <HistoryPanel
              history={history}
              onRestore={restoreReading}
              onDelete={(id) => setHistory(deleteReading(id))}
              onClear={() => { setHistory(clearHistory()); flash('已清空历史记录'); }}
              onToggleFavorite={(id) => setHistory(toggleFavorite(id))}
              onSetOutcome={(id, outcome) => {
                setHistory(setOutcome(id, outcome));
                flash(outcome ? '已记下这条复盘（仅保存在本机）' : '已撤销复盘标注');
              }}
              onExportAll={() => {
                downloadText('玄览-历史备份.json', exportAllJson(history), 'application/json');
                flash('已导出全部历史（JSON 备份）');
              }}
              onImport={(file) => {
                file.text().then((text) => {
                  try {
                    const { added, skipped } = importBackup(text);
                    setHistory(loadHistory());
                    flash(`导入完成：新增 ${added} 条 / 跳过重复 ${skipped} 条`);
                  } catch {
                    flash('备份解析失败，请确认是玄览导出的 JSON');
                  }
                });
              }}
            />
          )}

          {result && (readOnly || stage === 'result') && (
            <ErrorBoundary label="结果墙">
              <ResultsView
                result={result}
                consensus={consensus}
                report={report}
                form={form}
                schools={schools}
                seed={seed}
                seedMode={seedMode}
                showRaw={showRaw}
                setShowRaw={setShowRaw}
                onFlash={flash}
                onShare={() => setShareOpen(true)}
                onReroll={reroll}
              />
            </ErrorBoundary>
          )}
        </>
      )}

      {view === 'case' && <CaseStudy onBack={() => setView('divination')} />}

      {/* 移动端底部导航（桌面端由 CSS 隐藏；入口页沉浸式，不显示） */}
      {view !== 'landing' && <MobileTabBar active={activeTab} onChange={handleTab} />}

      {loading && (
        <div className="loading-veil">
          <div className="lv-inner">
            <TaijiRing size={104} spinning />
            <div className="lv-text">起卦中…</div>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}

      {shareOpen && result && (
        <ShareCard
          result={result}
          consensus={consensus}
          report={report}
          form={form}
          schools={schools}
          seed={seed}
          seedMode={seedMode}
          askedAt={askedAt}
          onClose={() => setShareOpen(false)}
        />
      )}

      {/* 入口页自带 .l2-footer，这里再垫一个全局页脚会重复、还把首屏顶出 190px
          （实测 1440×900：scrollHeight 1090 vs 视口 900），所以入口页不渲染它。 */}
      {view !== 'landing' && (
        <footer className="app-foot">
          玄览 v{APP_VERSION} · 内核 iztro / mingyu-core · 文化体验，非预测
          <span className="foot-sep">·</span>
          <button className="link foot-link" type="button" onClick={() => setPrivacyOpen(true)}>
            隐私与数据说明
          </button>
        </footer>
      )}

      {!consentDone && <ConsentGate onClose={() => setConsentDone(true)} />}
      {consentDone && onboardOpen && <Onboarding onClose={() => setOnboardOpen(false)} />}
      {glossaryOpen && <GlossaryModal onClose={() => setGlossaryOpen(false)} />}
      {privacyOpen && <PrivacyModal onClose={() => setPrivacyOpen(false)} />}
    </div>
  );
}
