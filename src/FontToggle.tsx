import React, { useEffect, useState } from 'react';

const KEY = 'xuanlan.font';

/** 两套字体：典雅（宋体标题） / 现代（无衬线） */
export type FontSet = 'serif' | 'sans';

const LABEL: Record<FontSet, string> = {
  serif: '典雅 · 宋',
  sans: '现代 · 黑',
};

function getInitial(): FontSet {
  const attr = document.documentElement.getAttribute('data-font');
  if (attr === 'serif' || attr === 'sans') return attr;
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'serif' || saved === 'sans') return saved;
  } catch {
    /* ignore */
  }
  return 'serif';
}

/**
 * 字体切换开关。
 * 写在 <html data-font> 上，styles.css 据此替换 --font-serif / --font-body，
 * 因此全站（含标题、数字、正文）一次切换，不用逐个组件改。
 * 选择存 localStorage；首屏防闪由 index.html 的内联脚本保证。
 */
export function FontToggle() {
  const [font, setFont] = useState<FontSet>(getInitial);

  useEffect(() => {
    document.documentElement.setAttribute('data-font', font);
    try {
      localStorage.setItem(KEY, font);
    } catch {
      /* ignore */
    }
  }, [font]);

  const next: FontSet = font === 'serif' ? 'sans' : 'serif';

  return (
    <button
      type="button"
      className="font-toggle"
      onClick={() => setFont(next)}
      aria-label={`切换字体，当前${LABEL[font]}`}
      title={`字体：${LABEL[font]}（点击切换为${LABEL[next]}）`}
    >
      {font === 'serif' ? '宋' : '黑'}
    </button>
  );
}
