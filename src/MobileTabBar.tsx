import React from 'react';

/**
 * 移动端底部主导航（照占星 App 的信息架构）。
 *
 * 桌面端隐藏，仅在 <768px 显示。四个 tab 覆盖产品的核心去向：
 * 探索（入口页）/ 推演（表单 + 结果）/ 历史 / 项目故事。
 */
export type MobileTab = 'explore' | 'divination' | 'history' | 'case';

const svgProps = {
  width: 21,
  height: 21,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

interface TabDef {
  id: MobileTab;
  label: string;
  icon: React.ReactElement;
}

const TABS: TabDef[] = [
  {
    id: 'explore',
    label: '探索',
    icon: (
      <svg {...svgProps}>
        <circle cx="12" cy="12" r="9" />
        <path d="M15.6 8.4 13.2 13.2 8.4 15.6l2.4-4.8z" />
      </svg>
    ),
  },
  {
    id: 'divination',
    label: '推演',
    icon: (
      <svg {...svgProps}>
        <path d="M12 3l7.5 4.4v9.2L12 21l-7.5-4.4V7.4z" />
        <circle cx="12" cy="12" r="2.9" />
      </svg>
    ),
  },
  {
    id: 'history',
    label: '历史',
    icon: (
      <svg {...svgProps}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7.4V12l3.1 1.9" />
      </svg>
    ),
  },
  {
    id: 'case',
    label: '故事',
    icon: (
      <svg {...svgProps}>
        <path d="M4 6a2 2 0 0 1 2-2h5v16H6a2 2 0 0 0-2 2z" />
        <path d="M20 6a2 2 0 0 0-2-2h-5v16h5a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
];

interface MobileTabBarProps {
  active: MobileTab;
  onChange: (tab: MobileTab) => void;
}

export function MobileTabBar({ active, onChange }: MobileTabBarProps) {
  return (
    <nav className="mtb" aria-label="主导航">
      <div className="mtb-inner">
        {TABS.map((t) => {
          const on = t.id === active;
          return (
            <button
              key={t.id}
              type="button"
              className={`mtb-item${on ? ' is-active' : ''}`}
              onClick={() => onChange(t.id)}
              aria-current={on ? 'page' : undefined}
            >
              <span className="mtb-ico">{t.icon}</span>
              <span className="mtb-txt">{t.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
