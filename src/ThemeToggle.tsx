import React, { useEffect, useState } from 'react';

const KEY = 'xuanlan.theme';

type Theme = 'light' | 'dark';

function getInitial(): Theme {
  const attr = document.documentElement.getAttribute('data-theme');
  if (attr === 'light' || attr === 'dark') return attr;
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    /* ignore */
  }
  return 'dark';
}

/**
 * 浅色 / 深色切换开关。
 * 状态写在 <html data-theme> 上，styles.css 据此切换双主题 token；
 * 选择持久化到 localStorage，刷新不丢。首屏防闪由 index.html 内联脚本保证。
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(getInitial);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem(KEY, theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  const toggle = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggle}
      aria-label={theme === 'dark' ? '切换到浅色模式' : '切换到深色模式'}
      title={theme === 'dark' ? '浅色模式' : '深色模式'}
    >
      {theme === 'dark' ? (
        <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
          <path
            d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
          <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <g stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <line x1="12" y1="2" x2="12" y2="4.6" />
            <line x1="12" y1="19.4" x2="12" y2="22" />
            <line x1="2" y1="12" x2="4.6" y2="12" />
            <line x1="19.4" y1="12" x2="22" y2="12" />
            <line x1="4.9" y1="4.9" x2="6.8" y2="6.8" />
            <line x1="17.2" y1="17.2" x2="19.1" y2="19.1" />
            <line x1="4.9" y1="19.1" x2="6.8" y2="17.2" />
            <line x1="17.2" y1="6.8" x2="19.1" y2="4.9" />
          </g>
        </svg>
      )}
      <span className="tt-label">{theme === 'dark' ? '浅色' : '深色'}</span>
    </button>
  );
}
