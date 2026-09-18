import React, { useEffect, useState } from 'react';

export interface ResultSection {
  id: string;
  label: string;
  /** 三段式阅读层级，用于分组显示 */
  level: 1 | 2 | 3;
}

/**
 * 顺序 = 结果页真实顺序，改一个必须改另一个。
 *
 * 翻转的理由：原先 Level 2 放的是「共识与分歧 / 分层 / 两派对峙」——
 * 这三块讲的全是**平台自己**（八家一致不一致、两层方法论），用户的问题
 * 反而被挤到 Level 3。现在 Level 2 只留与问题直接相关的两块（六维度怎么分、
 * 该先看什么），方法论一律降级进深读。
 */
export const RESULT_SECTIONS: ResultSection[] = [
  { id: 'sec-summary', label: '结论', level: 1 },
  { id: 'sec-axes', label: '六大维度', level: 2 },
  { id: 'sec-path', label: '该先看什么', level: 2 },
  { id: 'sec-systems', label: '八大体系', level: 3 },
  { id: 'sec-align', label: '共识与分歧', level: 3 },
  { id: 'sec-layers', label: '命盘 / 卜卦分层', level: 3 },
  { id: 'sec-dissent', label: '两派对峙', level: 3 },
  { id: 'sec-report', label: '综合研判', level: 3 },
];

const LEVEL_LABEL: Record<number, string> = {
  1: '10 秒',
  2: '1 分钟',
  3: '深读',
};

/**
 * 结果页章节导航（仅桌面端显示）。
 * 结果页纵向很长，桌面端有大片左右空白，与其空着不如放一条粘性目录：
 * 既能一眼看清「这份结果有哪些部分」，也能一键跳到想看的那一段。
 * 当前所在章节用 IntersectionObserver 自动高亮。
 */
export function ResultNav({ extra }: { extra?: React.ReactNode }) {
  const [active, setActive] = useState<string>(RESULT_SECTIONS[0]?.id ?? '');

  useEffect(() => {
    const els = RESULT_SECTIONS.map((s) => document.getElementById(s.id)).filter(
      (e): e is HTMLElement => !!e
    );
    if (els.length === 0) return;

    const io = new IntersectionObserver(
      (entries) => {
        // 取当前可见度最高的那个区块
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: '-15% 0px -60% 0px', threshold: [0.05, 0.25, 0.5] }
    );
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, []);

  const jump = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  };

  let lastLevel = 0;

  return (
    <nav className="result-nav" aria-label="结果章节导航">
      <div className="rn-title">本页结构</div>
      <ul className="rn-list">
        {RESULT_SECTIONS.map((s) => {
          const showLevel = s.level !== lastLevel;
          lastLevel = s.level;
          return (
            <li key={s.id}>
              {showLevel && <div className="rn-level">{LEVEL_LABEL[s.level]}</div>}
              <button
                type="button"
                className={`rn-item${active === s.id ? ' on' : ''}`}
                onClick={() => jump(s.id)}
                aria-current={active === s.id ? 'true' : undefined}
              >
                {s.label}
              </button>
            </li>
          );
        })}
      </ul>
      {extra}
    </nav>
  );
}
