import React from 'react';
import type { TopicId, SystemId, AxisId } from './core';
import { SYSTEM_META } from './core';
import { AXIS_LABELS } from './core-meta';
import { TOPIC_LABELS } from './history';

/**
 * 主题化阅读路径（评审⑧）。
 * 用户选了主题，就应该告诉他「这一步该先看什么、重点读哪条轴」，
 * 而不是把八张卡和六条轴一股脑丢给他。点击体系 chip 直接滚动到对应卡片，
 * 把「阅读顺序」和「实际盘面」锚定在一起。
 */
const PATH: Record<TopicId, { lead: string; systems: SystemId[]; axes: AxisId[] }> = {
  general: {
    lead: '未指定主题：建议从「共识度最高的轴」读起，再看分歧最大的轴，自己取舍。命盘类体系看长期趋势，卜卦类体系看当下信号。',
    systems: ['bazi', 'ziwei', 'astrolabe'],
    axes: ['auspicious', 'action'],
  },
  career: {
    lead: '事业决策：重点看「进取 ↔ 避险」与「宜进 ↔ 宜守」，并留意大运 / 流年对事业宫的提示。',
    systems: ['ziwei', 'bazi', 'qimen'],
    axes: ['risk', 'timing'],
  },
  romance: {
    lead: '感情：重点看「结盟 ↔ 独处」与「吉 ↔ 凶」，参考夫妻宫与西洋占星的金星 / 七宫。',
    systems: ['ziwei', 'astrolabe', 'bazi'],
    axes: ['social', 'auspicious'],
  },
  money: {
    lead: '财运：重点看「吉 ↔ 凶」与「进取 ↔ 避险」，关注财帛宫与流年财星。',
    systems: ['ziwei', 'bazi', 'astrolabe'],
    axes: ['auspicious', 'risk'],
  },
  move: {
    lead: '变动 / 搬迁：重点看「宜动 ↔ 宜静」与「宜进 ↔ 宜守」，留意迁移宫与驿马星。',
    systems: ['ziwei', 'bazi', 'liuren'],
    axes: ['action', 'timing'],
  },
  study: {
    lead: '学业：重点看「宜进 ↔ 宜守」与「吉 ↔ 凶」，关注文昌星与流年文曲。',
    systems: ['ziwei', 'bazi', 'astrolabe'],
    axes: ['timing', 'auspicious'],
  },
  health: {
    lead: '健康：重点看「吉 ↔ 凶」——并请务必以现代医学为准，本平台不构成任何医疗建议。',
    systems: ['ziwei', 'bazi'],
    axes: ['auspicious'],
  },
  relationship: {
    lead: '人际：重点看「结盟 ↔ 独处」与「求变 ↔ 守常」，注意合作关系的流年变化。',
    systems: ['ziwei', 'astrolabe', 'xiaoliuren'],
    axes: ['social', 'change'],
  },
};

export function TopicPath({ topic, qtext }: { topic: TopicId; qtext: string }) {
  const p = PATH[topic] ?? PATH.general;
  const scrollTo = (id: string) => {
    const el = document.getElementById(`card-${id}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };
  return (
    <section className="topic-path" aria-label="主题阅读路径">
      <div className="tp-head">
        <span className="tp-kicker">阅读路径</span>
        <h3>
          {TOPIC_LABELS[topic] ?? topic}
          {qtext ? ` · ${qtext}` : ''}
        </h3>
      </div>
      <p className="tp-lead">{p.lead}</p>
      <div className="tp-rows">
        <div className="tp-row">
          <span className="tp-label">优先看</span>
          <div className="tp-chips">
            {p.systems.map((s) => (
              <button key={s} className="tp-chip" type="button" onClick={() => scrollTo(s)}>
                {SYSTEM_META[s]?.name ?? s} ↘
              </button>
            ))}
          </div>
        </div>
        <div className="tp-row">
          <span className="tp-label">重点轴</span>
          <div className="tp-chips">
            {p.axes.map((a) => (
              <span key={a} className="tp-axis">
                {AXIS_LABELS[a].positive} ↔ {AXIS_LABELS[a].negative}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
