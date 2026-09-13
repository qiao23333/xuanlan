import React, { useMemo, useState } from 'react';
import {
  GLOSSARY,
  SYS_META,
  GLOSSARY_SYS,
  termsOfSys,
  type GlossarySys,
} from './glossary';
import { SystemIcon } from './systemIdentity';

type Cat = 'all' | GlossarySys;

/** 百科页太极装饰（与综合结论区同源风格） */
function TaijiDecor({ size = 92 }: { size?: number }) {
  const cx = 50, cy = 50, r = 42;
  return (
    <svg className="gl-taiji" viewBox="0 0 100 100" width={size} height={size} aria-hidden="true">
      <defs>
        <linearGradient id="glTjGold" x1="0" y1="0" x2="0.55" y2="1">
          <stop offset="0%" stopColor="var(--taiji-light, #f6e3ae)" />
          <stop offset="100%" stopColor="color-mix(in srgb, var(--taiji-light) 82%, var(--gold-soft))" />
        </linearGradient>
      </defs>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--gold)" strokeWidth="0.4" opacity=".25" />
      <circle cx={cx} cy={cy} r={r - 2} fill="none" stroke="var(--gold)" strokeWidth="0.2" opacity=".15" />
      <circle cx={cx} cy={cy} r={r * 0.48} fill="var(--taiji-ink, #2a1f15)" />
      <path d={`M${cx} ${cy - r * 0.48}A${r * 0.48} ${r * 0.48} 0 0 1 ${cx} ${cy + r * 0.48}Z`} fill="url(#glTjGold)" />
      {/* 朝向与参考稿一致：金鱼头在下、墨鱼头在上 */}
      <circle cx={cx} cy={cy + r * 0.24} r={r * 0.24} fill="url(#glTjGold)" />
      <circle cx={cx} cy={cy - r * 0.24} r={r * 0.24} fill="var(--taiji-ink, #2a1f15)" />
      <circle cx={cx} cy={cy + r * 0.24} r={r * 0.08} fill="var(--taiji-ink, #2a1f15)" />
      <circle cx={cx} cy={cy - r * 0.24} r={r * 0.08} fill="url(#glTjGold)" />
    </svg>
  );
}

/**
 * 术语百科全页（参考设计稿：搜索栏 + 左侧栏 全部/八大体系 + 主内容
 * 太极装饰 + 八大体系概览卡 + 基础概念卡）。取代旧的全屏弹层。
 */
export function GlossaryPage({ onBack }: { onBack: () => void }) {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<Cat>('all');

  const filtered = useMemo(() => {
    const entries = Object.entries(GLOSSARY).map(([key, v]) => ({
      key,
      title: v.title,
      text: v.text,
      sys: GLOSSARY_SYS[key] ?? 'bazi',
    }));
    const t = q.trim().toLowerCase();
    return entries
      .filter((e) => cat === 'all' || e.sys === cat)
      .filter(
        (e) =>
          !t ||
          e.title.toLowerCase().includes(t) ||
          e.text.toLowerCase().includes(t) ||
          e.key.includes(q.trim())
      );
  }, [q, cat]);

  const activeName =
    cat === 'all' ? '全部基础概念' : SYS_META.find((s) => s.id === cat)?.name ?? '基础概念';

  return (
    <section className="gl-page">
      <header className="gl-hero">
        <div className="gl-hero-top">
          <button className="gl-back" type="button" onClick={onBack}>
            ← 返回
          </button>
          <span className="gl-count">{Object.keys(GLOSSARY).length} 条术语</span>
        </div>

        <div className="gl-hero-main">
          <TaijiDecor />
          <div className="gl-hero-text">
            <h1 className="gl-title">术语百科</h1>
            <p className="gl-sub">GLOSSARY · 八大体系关键概念白话解读</p>
            <p className="gl-desc">
              只解释「这是什么」，不夸大「准不准」。点左侧体系可只看该领域的概念。
            </p>
          </div>
        </div>

        <input
          className="gl-search"
          placeholder="搜索术语，如：用神、大运、牌阵、分宫制…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="搜索术语"
        />
      </header>

      <div className="gl-layout">
        <aside className="gl-side" aria-label="按体系筛选">
          <button
            type="button"
            className={`gl-cat${cat === 'all' ? ' on' : ''}`}
            onClick={() => setCat('all')}
          >
            全部术语
            <span className="gl-cat-n">{Object.keys(GLOSSARY).length}</span>
          </button>
          {SYS_META.map((s) => {
            const n = termsOfSys(s.id).length;
            return (
              <button
                type="button"
                key={s.id}
                className={`gl-cat${cat === s.id ? ' on' : ''}`}
                onClick={() => setCat(s.id)}
              >
                {s.name}
                <span className="gl-cat-n">{n}</span>
              </button>
            );
          })}
        </aside>

        <main className="gl-main">
          {/* 八大体系概览卡 */}
          <div className="gl-syscards">
            {SYS_META.map((s) => (
              <button
                type="button"
                className="gl-syscard"
                key={s.id}
                onClick={() => setCat(s.id)}
              >
                {/* 参考稿：体系卡上方为体系图标 */}
                <SystemIcon id={s.id as never} size={56} className="gl-sysicon" />
                <div className="gl-sysname">{s.name}</div>
                <div className="gl-sysintro">{s.intro}</div>
                <div className="gl-syscount">查看 →</div>
              </button>
            ))}
          </div>

          <h2 className="gl-section-title">
            {activeName}
            <span className="gl-section-n">{filtered.length}</span>
          </h2>

          <div className="gl-terms">
            {filtered.map((e) => (
              <article className="gl-term-card" key={e.key}>
                <h3 className="gl-term-title">{e.title}</h3>
                <p className="gl-term-text">{e.text}</p>
              </article>
            ))}
            {filtered.length === 0 && (
              <div className="gl-empty">没有匹配「{q}」的术语，换个词试试。</div>
            )}
          </div>
        </main>
      </div>
    </section>
  );
}
