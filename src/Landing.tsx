import React from 'react';

/** 入口页四个卖点（参考设计稿首页底部卡片行） */
const FEATURES: { icon: string; title: string; desc: string }[] = [
  { icon: '⊞', title: '多体系融合', desc: '八大体系并行推演\n看见更完整的自己' },
  { icon: '☯', title: 'AI 深度解读', desc: '结合古典智慧与现代算法\n提供个性化分析' },
  { icon: '📄', title: '结构化呈现', desc: '从命盘到结论\n清晰、易懂、可实践' },
  { icon: '🧭', title: '探索自我成长', desc: '不止是预测\n更是理解与选择' },
];

/** 先天八卦：1=阳爻，0=阴爻 */
const TRIGRAMS: number[][] = [
  [1, 1, 1], [1, 1, 0], [1, 0, 1], [1, 0, 0],
  [0, 1, 1], [0, 1, 0], [0, 0, 1], [0, 0, 0],
];

/**
 * 复杂星盘轮（参考设计稿：多层同心环 + 外环星点 + 中环八卦 +
 * 内环星座 + 中心小太极）。所有颜色用 var(--gold/--bg) 主题化。
 */
function CelestialWheel({ size = 360 }: { size?: number }) {
  const cx = 50, cy = 50;
  return (
    <svg
      className="taiji-ring wheel-slow"
      viewBox="0 0 100 100"
      width={size}
      height={size}
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="wheelGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--gold-hair)" />
          <stop offset="60%" stopColor="var(--gold-hair)" stopOpacity="0.25" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
        <linearGradient id="wheelGold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--gold)" />
          <stop offset="100%" stopColor="var(--gold-soft)" />
        </linearGradient>
        {/* 太极亮面（金鱼）专用渐变 —— 比 --gold 更亮，保证与墨面对比 */}
        <linearGradient id="taijiGold" x1="0" y1="0" x2="0.55" y2="1">
          <stop offset="0%" stopColor="var(--taiji-light)" />
          <stop offset="100%" stopColor="color-mix(in srgb, var(--taiji-light) 82%, var(--gold-soft))" />
        </linearGradient>
        <radialGradient id="wheelMystic" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="color-mix(in srgb, var(--primary) 24%, transparent)" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
      </defs>

      {/* 大范围光晕 */}
      <circle cx={cx} cy={cy} r="49" fill="url(#wheelGlow)" />
      {/* 内部蓝色玄光 */}
      <circle cx={cx} cy={cy} r="46" fill="url(#wheelMystic)" />

      {/* ====== 外层装饰圈 ====== */}
      <circle cx={cx} cy={cy} r="47" fill="none" stroke="var(--gold)" strokeOpacity="0.35" strokeWidth="0.18" />
      <circle cx={cx} cy={cy} r="44" fill="none" stroke="var(--gold)" strokeOpacity="0.22" strokeWidth="0.14" />
      <circle cx={cx} cy={cy} r="40" fill="none" stroke="var(--gold)" strokeOpacity="0.28" strokeWidth="0.16" />

      {/* ====== 24 星点（外环 r=44） ====== */}
      {Array.from({ length: 24 }).map((_, i) => {
        const a = (i / 24) * Math.PI * 2 - Math.PI / 2;
        const r = 44;
        const x = cx + r * Math.cos(a);
        const y = cy + r * Math.sin(a);
        const major = i % 3 === 0;
        return (
          <g key={`s${i}`}>
            {major ? (
              <>
                <line
                  x1={cx + (r - 0.6) * Math.cos(a)}
                  y1={cy + (r - 0.6) * Math.sin(a)}
                  x2={cx + (r + 0.6) * Math.cos(a)}
                  y2={cy + (r + 0.6) * Math.sin(a)}
                  stroke="var(--gold)"
                  strokeOpacity="0.6"
                  strokeWidth="0.25"
                />
                <circle cx={x} cy={y} r="0.5" fill="var(--gold)" />
              </>
            ) : (
              <circle cx={x} cy={y} r="0.25" fill="var(--gold)" fillOpacity="0.55" />
            )}
          </g>
        );
      })}

      {/* ====== 中环八卦（r=36） ====== */}
      <circle cx={cx} cy={cy} r="36" fill="none" stroke="var(--gold)" strokeOpacity="0.32" strokeWidth="0.14" />
      {TRIGRAMS.map((lines, i) => {
        const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
        const r = 36;
        const x = cx + r * Math.cos(a);
        const y = cy + r * Math.sin(a);
        const rot = (a * 180) / Math.PI + 90;
        return (
          <g key={`t${i}`} transform={`translate(${x} ${y}) rotate(${rot})`}>
            {lines.map((v, j) => {
              const yy = (j - 1) * 1.8;
              return v === 1 ? (
                <rect key={j} x="-2.4" y={yy} width="4.8" height="0.7" rx="0.3" fill="url(#wheelGold)" />
              ) : (
                <g key={j}>
                  <rect x="-2.4" y={yy} width="2" height="0.7" rx="0.3" fill="url(#wheelGold)" />
                  <rect x="0.4" y={yy} width="2" height="0.7" rx="0.3" fill="url(#wheelGold)" />
                </g>
              );
            })}
          </g>
        );
      })}

      {/* ====== 内环星座（r=24，12 点） ====== */}
      <circle cx={cx} cy={cy} r="24" fill="none" stroke="var(--gold)" strokeOpacity="0.25" strokeWidth="0.12" />
      <circle cx={cx} cy={cy} r="20" fill="none" stroke="var(--gold)" strokeOpacity="0.18" strokeWidth="0.1" />
      {Array.from({ length: 12 }).map((_, i) => {
        const a = (i / 12) * Math.PI * 2;
        const r = 24;
        const x = cx + r * Math.cos(a);
        const y = cy + r * Math.sin(a);
        return (
          <g key={`c${i}`}>
            <circle cx={x} cy={y} r="0.55" fill="var(--gold)" fillOpacity="0.85" />
            <circle
              cx={cx + 20 * Math.cos(a + 0.15)}
              cy={cy + 20 * Math.sin(a + 0.15)}
              r="0.3"
              fill="var(--gold)"
              fillOpacity="0.55"
            />
          </g>
        );
      })}

      {/* ====== 中心太极 ======
          构造顺序保证「两枚鱼眼必与所在鱼身反色」：
          ① 整圆铺墨（阴鱼底） ② 右半圆盘 + 上半圆盘铺金（阳鱼） ③ 下半圆盘回铺墨
          其余部分自然形成 S 曲线 → 金鱼头在上、墨鱼头在下，两鱼眼分别取反色。 */}
      <g className="taiji-core">
        {/* 底：整圆填「墨」 */}
        <circle cx={cx} cy={cy} r="14" fill="var(--taiji-ink)" />
        {/* 阳鱼：右半圆盘 + 上半圆盘 */}
        <path d={`M${cx} ${cy - 14} A14 14 0 0 1 ${cx} ${cy + 14} Z`} fill="url(#taijiGold)" />
        <circle cx={cx} cy={cy - 7} r="7" fill="url(#taijiGold)" />
        {/* 阴鱼：下半圆盘（切出 S 曲线） */}
        <circle cx={cx} cy={cy + 7} r="7" fill="var(--taiji-ink)" />
        {/* 金鱼之眼 = 墨；墨鱼之眼 = 金 */}
        <circle cx={cx} cy={cy - 7} r="2.5" fill="var(--taiji-ink)" />
        <circle cx={cx} cy={cy + 7} r="2.5" fill="url(#taijiGold)" />
        {/* 金鱼眼细环：在暗色底里也能看出眼位 */}
        <circle
          cx={cx}
          cy={cy - 7}
          r="2.5"
          fill="none"
          stroke="var(--taiji-light)"
          strokeOpacity="0.38"
          strokeWidth="0.16"
        />
        {/* 外描边 */}
        <circle cx={cx} cy={cy} r="14" fill="none" stroke="var(--taiji-light)" strokeOpacity="0.5" strokeWidth="0.28" />
      </g>

      {/* 月相提示（右上角小弧） */}
      <g transform={`translate(${cx + 32} ${cy - 32}) rotate(-30)`}>
        <path
          d="M0 -4 a4 4 0 1 0 0 8 a3 3 0 1 1 0 -8 z"
          fill="var(--gold)"
          fillOpacity="0.65"
        />
      </g>
    </svg>
  );
}

/** 远山剪影（备用，当前背景为 AI 山水画） */
export function Landing({
  onEnter,
  onCase,
}: {
  onEnter: () => void;
  onCase: () => void;
}) {
  return (
    <section className="landing-v2">
      {/* ====== 背景层（AI 山水画） ====== */}
      <div className="l2-bg" aria-hidden="true" />

      {/* ====== 三栏布局：左侧标语 | 中央主角 | 右侧竖文 ====== */}
      <div className="l2-stage">

        {/* ── 左侧：品牌标语 ── */}
        <aside className="l2-left" aria-hidden="true">
          <p className="l2-left-zh">古老的智慧</p>
          <p className="l2-left-zh-sub">在现代与你相遇</p>
          <p className="l2-left-en">ANCIENT WISDOM</p>
          <p className="l2-left-en-sub">A MORE COMPLETE YOU</p>
        </aside>

        {/* ── 中央：太极轮 + 主标题 + CTA ── */}
        <main className="l2-hero">
          <div className="l2-wheel-wrap">
            {/* 天地人 标签 */}
            <span className="l2-label l2-label-top">天</span>
            <span className="l2-label l2-label-bottom">地</span>
            <span className="l2-label l2-label-left">人</span>
            <CelestialWheel size={380} />
          </div>

          <h1 className="l2-title">玄 览</h1>
          <p className="l2-title-en">XUANLAN</p>
          <span className="l2-seal" aria-hidden="true">印</span>

          <p className="l2-tagline">汇聚东方与西方的智慧</p>
          <p className="l2-subtitle">让更多维度，看见更真实的你</p>

          <button className="l2-enter-btn" type="button" onClick={onEnter}>
            开始探索 <span className="l2-arrow">→</span>
          </button>

          <p className="l2-action-hint">一次输入，八大体系并排推演 · 内核严谨，外壳科普</p>

          <button className="l2-case-link" type="button" onClick={onCase}>
            这个项目是怎么做出来的 →
          </button>
        </main>

        {/* ── 右侧：竖排文字 ── */}
        <aside className="l2-right" aria-hidden="true">
          <p className="l2-right-cn">观天识人心未来</p>
          <p className="l2-right-en1">SEE FURTHER</p>
          <p className="l2-right-en2">LIVE DEEPER</p>
        </aside>
      </div>

      {/* ── 底部卖点卡片行（参考设计稿） ── */}
      <ul className="l2-features">
        {FEATURES.map((f) => (
          <li className="l2-feat" key={f.title}>
            <span className="l2-feat-icon" aria-hidden="true">{f.icon}</span>
            <span className="l2-feat-title">{f.title}</span>
            <span className="l2-feat-desc">{f.desc}</span>
          </li>
        ))}
      </ul>

      {/* ── 页脚（参考设计稿） ── */}
      <footer className="l2-footer">
        <div className="l2-fl-left">
          <span className="l2-fl-brand">玄览 XUANLAN</span>
          <span className="l2-fl-slogan">让东方智慧，照亮现代生活</span>
        </div>
        <nav className="l2-fl-links" aria-label="页脚导航">
          <span>知命</span><span className="l2-fl-sep">·</span>
          <span>识己</span><span className="l2-fl-sep">·</span>
          <span>顺势</span><span className="l2-fl-sep">·</span>
          <span>致远</span>
        </nav>
        <div className="l2-fl-right">
          <span>V0.4.0</span>
          <span className="l2-fl-sep">|</span>
          <span>文化体验，非预测</span>
          <span className="l2-fl-sep">|</span>
          <span>隐私与数据说明</span>
        </div>
      </footer>
    </section>
  );
}

/** 加载/结果页用的小太极（保留兼容） */
function TaijiRing({ size = 104, spinning = false }: { size?: number; spinning?: boolean }) {
  return (
    <svg
      className={`taiji-ring${spinning ? ' spinning' : ''}`}
      viewBox="0 0 100 100"
      width={size}
      height={size}
      aria-hidden="true"
    >
      <circle cx="50" cy="50" r="48" fill="none" stroke="var(--gold)" strokeOpacity="0.3" strokeWidth="0.5" />
      {/* 同样用「铺底 → 半圆盘 → 对侧圆盘」构造，保证鱼眼取反色 */}
      <g className="taiji-core">
        <circle cx="50" cy="50" r="16" fill="var(--taiji-ink)" />
        <path d="M50 34 A16 16 0 0 1 50 66 Z" fill="var(--taiji-light)" />
        <circle cx="50" cy="42" r="8" fill="var(--taiji-light)" />
        <circle cx="50" cy="58" r="8" fill="var(--taiji-ink)" />
        <circle cx="50" cy="42" r="3" fill="var(--taiji-ink)" />
        <circle cx="50" cy="58" r="3" fill="var(--taiji-light)" />
        <circle cx="50" cy="50" r="16" fill="none" stroke="var(--gold)" strokeWidth="0.9" strokeOpacity="0.7" />
      </g>
    </svg>
  );
}

export { TaijiRing };