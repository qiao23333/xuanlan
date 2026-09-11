import React, { useState } from 'react';
import { useModalA11y } from './useModalA11y';

const KEY = 'xuanlan.onboard.v1';
export function hasOnboarded(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}
function markOnboarded() {
  try {
    localStorage.setItem(KEY, '1');
  } catch {
    /* ignore */
  }
}

const STEPS = [
  {
    glyph: '☯',
    title: '欢迎来到玄览',
    body: '玄览把八字、紫微、奇门、大六壬、小六壬、梅花易数、西洋占星、塔罗八套体系「并排」推演，再把它们聚合起来——让你看见「哪里达成一致、哪里吵起来了」，而不是只听一个自信的答案。',
    tip: '内核按古籍规则确定性计算，同一生辰 + 同一问题，结果永远一致、可溯源。',
  },
  {
    glyph: '✎',
    title: '怎么用：填两项就够了',
    body: '第一步填生辰（精确到分钟、选出生地）；第二步写下你此刻想问的事。什么也不填也能算，但填了问题，起卦会由「问题 + 问事时刻」决定，更贴合你当下的处境。',
    tip: '点「开始推演」后，八套体系的卡片会一次性铺开。',
  },
  {
    glyph: '◎',
    title: '共识度 ≠ 预测准确率',
    body: '共识度仪表盘只回答一件事：八体系在同一维度上「是否想到一块去」。一致度高，说明它们罕见地达成共识；分歧点才是信息量所在——玄览专门把最大的分歧摆出来给你看两派理由。',
    tip: '把它当成「八位顾问合议」，而不是「神谕」。',
  },
  {
    glyph: '⛨',
    title: '你的数据只属于你',
    body: '全部计算在浏览器本地完成，生辰与所问之事只存在你这台设备上，不上传、不收集、不用于训练。你可以随时导出全部记录或一键清空。',
    tip: '玄览是文化体验与科普工具，不构成任何人生、医疗、法律、财务建议。',
  },
];

/**
 * 首访新手引导（评审⑦）。分步卡片式 tour：可靠、不依赖测量 DOM，
 * 同时给出进度与「重看」入口。目标是消除「从哪看起」的茫然，
 * 并正面把「确定性 / 共识≠预测 / 本地隐私」三件事讲在前头。
 */
export function Onboarding({ onClose }: { onClose: () => void }) {
  const [i, setI] = useState(0);
  const modalRef = useModalA11y(onClose);
  const total = STEPS.length;
  const step = STEPS[i];
  const last = i === total - 1;

  const finish = () => {
    markOnboarded();
    onClose();
  };

  return (
    <div className="modal-veil" onClick={onClose} role="dialog" aria-modal="true" aria-label="新手引导">
      <div className="modal onboard" ref={modalRef} tabIndex={-1} onClick={(e) => e.stopPropagation()}>
        <div className="ob-glyph" aria-hidden="true">{step.glyph}</div>
        <h3 className="ob-title">{step.title}</h3>
        <p className="ob-body">{step.body}</p>
        <p className="ob-tip">{step.tip}</p>

        <div className="ob-dots" aria-hidden="true">
          {STEPS.map((_, k) => (
            <span key={k} className={`ob-dot${k === i ? ' on' : ''}`} />
          ))}
        </div>

        <div className="ob-actions">
          <button className="ghost" type="button" onClick={finish}>
            跳过
          </button>
          {i > 0 && (
            <button className="ghost" type="button" onClick={() => setI((v) => v - 1)}>
              上一步
            </button>
          )}
          <button className="btn-gold" type="button" onClick={last ? finish : () => setI((v) => v + 1)}>
            {last ? '开始体验' : '下一步'}
          </button>
        </div>
      </div>
    </div>
  );
}
