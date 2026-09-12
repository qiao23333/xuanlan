import React, { useRef, useState } from 'react';
import type { CalculateResult, SystemId } from './core';
import { SYSTEM_META } from './core';
import { SystemIcon, ACCENTS } from './systemIdentity';
import { SystemRenderer } from './renderers';
import { InterpretationBlock } from './Interpretation';
import { SystemEvidence } from './SystemEvidence';
import type { AppForm } from '../features/form/DivinationForm';

interface SystemOverviewProps {
  result: CalculateResult;
  showRaw: Record<string, boolean>;
  setShowRaw: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
}

/**
 * 八大体系观点一览 —— 设计稿中的卡片墙。
 * 每张卡片按参考稿排版：上面图标、下面体系名，不放分类标签与详细描述。
 * 点击展开为完整详情面板（详情里仍保留完整解读与证据）。
 */
export function SystemOverview({ result, showRaw, setShowRaw }: SystemOverviewProps) {
  const [activeId, setActiveId] = useState<SystemId | null>(null);
  const detailRef = useRef<HTMLElement>(null);

  // 找到当前激活的 chart
  const activeChart = activeId ? result.charts.find((c) => c.systemId === activeId) : null;
  const activeMeta = activeId ? SYSTEM_META[activeId] : null;

  /** 选中卡片后把详情带进视野，避免"点了没反应、要自己往下找" */
  const pick = (id: SystemId) => {
    const next = activeId === id ? null : id;
    setActiveId(next);
    if (!next) return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    requestAnimationFrame(() => {
      detailRef.current?.scrollIntoView({
        behavior: reduced ? 'auto' : 'smooth',
        block: 'start',
      });
    });
  };

  return (
    <section className="sys-overview">
      <h3 className="so-head">八大体系观点一览</h3>
      <p className="so-hint">点击任意卡片查看完整解读</p>

      {/* 网格而非横排：8 个一次看全，不需要左右拖，也不会被裁掉一半 */}
      <div className="so-grid">
        {result.charts.map((c) => {
          const meta = SYSTEM_META[c.systemId as SystemId];
          const isActive = activeId === c.systemId;

          return (
            <button
              type="button"
              className={`so-card${isActive ? ' so-active' : ''}`}
              key={c.systemId}
              onClick={() => pick(c.systemId as SystemId)}
              style={{ '--so-accent': ACCENTS[c.systemId as SystemId] } as React.CSSProperties}
              aria-pressed={isActive}
            >
              <span className="so-icon">
                {/* 用户指定的标准图标素材（透明底 PNG，深浅两套），见 systemIdentity.tsx 的 SystemIcon */}
                <SystemIcon id={c.systemId as SystemId} size={40} />
              </span>
              {/* 参考稿排版：上面图标、下面名字，不放分类标签与详细描述 */}
              <span className="so-name">{meta?.name ?? c.systemId}</span>
            </button>
          );
        })}
      </div>

      {/* 展开详情面板 */}
      {activeChart && activeMeta && (
        <article
          className="so-detail"
          ref={detailRef}
          style={{ '--accent': ACCENTS[activeChart.systemId as SystemId] } as React.CSSProperties}
        >
          <header className="so-detail-head">
            <SystemIcon id={activeChart.systemId as SystemId} size={30} />
            <h4>{activeMeta.name}</h4>
            <span className={`cat cat-${activeMeta.category}`}>{activeMeta.category === 'chart' ? '命盘类 · 长期结构' : '卜卦类 · 当前事件'}</span>
            <button className="so-close" type="button" onClick={() => setActiveId(null)} aria-label="关闭详情">✕</button>
          </header>

          <div className="so-detail-body">
            <div className="so-render">
              <SystemRenderer systemId={activeChart.systemId} data={activeChart.data} />
            </div>
            <InterpretationBlock data={activeChart.interpretation} />
            {/* 证据层：每条断言的依据 + 生效参数 + 流派分歧 + 诚实边界 */}
            <SystemEvidence chart={activeChart} meta={activeMeta} />
          </div>

          <footer className="so-detail-foot">
            <span className="hash" title={activeChart.configHash}>hash {activeChart.configHash.slice(0, 8)}</span>
            <button
              className="link"
              type="button"
              onClick={() => setShowRaw((s) => ({ ...s, [activeChart.systemId]: !s[activeChart.systemId] }))}
            >
              {showRaw[activeChart.systemId] ? '收起原始数据' : '查看原始数据'}
            </button>
          </footer>

          {showRaw[activeChart.systemId] && (
            <div className="so-raw">
              <pre>{JSON.stringify(activeChart.data, null, 2)}</pre>
            </div>
          )}

          {activeMeta.summary && (
            <div className="so-meta">
              <div className="sub">关于 {activeMeta.name}</div>
              <p>{activeMeta.summary}</p>
            </div>
          )}
        </article>
      )}
    </section>
  );
}
