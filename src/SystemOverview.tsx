import React, { useRef, useState } from 'react';
import type { CalculateResult, SystemId, Consensus } from './core';
import { SYSTEM_META } from './core';
import { SystemIcon, ACCENTS } from './systemIdentity';
import { SystemDetailView } from './SystemDetailView';
import type { AppForm } from '../features/form/DivinationForm';

interface SystemOverviewProps {
  result: CalculateResult;
  consensus: Consensus[];
  topic: import('./core').TopicId;
  form: AppForm;
  showRaw: Record<string, boolean>;
  setShowRaw: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
}

/**
 * 八大体系观点一览 —— 设计稿中的卡片墙。
 * 每张卡片按参考稿排版：上面图标、下面体系名，不放分类标签与详细描述。
 * 点击展开为完整详情面板（详情里仍保留完整解读与证据）。
 */
export function SystemOverview({ result, consensus, topic, form, showRaw, setShowRaw }: SystemOverviewProps) {
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
    <section className="sys-overview" id="sys-overview">
      <h3 className="so-head">
        八大体系综合一览 <span className="sec-en">· EIGHT SYSTEMS</span>
      </h3>
      <p className="so-hint">点击体系卡片可查看详细解读</p>

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

      {/* 展开详情面板：照 8 张参考图统一框架渲染 */}
      {activeChart && activeMeta && (
        <div ref={detailRef} className="sd-detail-anchor">
          <SystemDetailView
            chart={activeChart}
            meta={activeMeta}
            consensus={consensus}
            result={result}
            form={form}
            topic={topic}
            showRaw={showRaw}
            setShowRaw={setShowRaw}
            onClose={() => setActiveId(null)}
          />
        </div>
      )}
    </section>
  );
}
