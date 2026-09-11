import React, { useState } from 'react';
import { useModalA11y } from './useModalA11y';

const CONSENT_KEY = 'xuanlan.consent.v1';

function hasConsented(): boolean {
  try {
    return localStorage.getItem(CONSENT_KEY) === '1';
  } catch {
    return false;
  }
}
function markConsented() {
  try {
    localStorage.setItem(CONSENT_KEY, '1');
  } catch {
    /* ignore */
  }
}

const PRIVACY_BODY = `本平台《隐私与数据说明》

一、我们收集什么
· 你主动填写的生辰（精确到分钟）、性别、出生地、所问问题。
· 这些仅用于当次推演计算，属于敏感个人信息。

二、数据存在哪里
· 全部数据仅保存在你当前浏览器的 localStorage 中。
· 本产品没有后端服务器，不联网上传，不用于任何训练或商业分析。

三、你的权利
· 随时可在「历史记录」中单条删除、清空，或一键导出全部数据后自行删除浏览器存储。
· 我们不会、也无法访问你在其他设备或我们这里的任何数据。

四、责任边界
· 所有结果由开源术数算法按古籍规则确定性计算，仅供文化体验与学习。
· 不构成任何人生、医疗、法律、财务建议。涉及重大决定请咨询持证专业人士。`;

/**
 * 使用前须知弹层（评审合规 P0）。
 * 首次进入必须点击「我已了解」方可使用——尽到充分提示义务。
 */
export function ConsentGate({ onClose }: { onClose: () => void }) {
  // 须知弹层：必须显式点击「我已了解」，故 Esc / 点遮罩均不可关闭（closeOnEscape=false）。
  const modalRef = useModalA11y(onClose, { closeOnEscape: false });
  return (
    <div className="modal-veil" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="使用前须知">
      <div className="modal consent-modal" ref={modalRef} tabIndex={-1} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>使用前须知</h3>
        </div>
        <div className="consent-body">
          <p>
            <b>玄览</b> 是一个把八套术数体系并排推演、做<strong>可解释性对比</strong>的
            <strong>文化体验与科普工具</strong>，不是算命、不算预测。
          </p>
          <ul>
            <li>所有结果由开源算法按古籍规则<strong>确定性计算</strong>，其有效性在科学上尚无共识。</li>
            <li>命理类（八字/紫微）看长期趋势；卜卦类（奇门/六壬/梅花/塔罗）针对你此问的当下信号。</li>
            <li>你的生辰与问题<strong>只存在本机浏览器</strong>，不上传任何服务器。</li>
            <li>任何人生、医疗、法律、财务决定，请咨询持证专业人士。</li>
          </ul>
        </div>
        <button
          className="btn-gold consent-ok"
          type="button"
          onClick={() => {
            markConsented();
            onClose();
          }}
        >
          我已了解，开始体验
        </button>
      </div>
    </div>
  );
}

/** 隐私政策弹层（评审合规 P0：纯前端也需就位数据说明）。 */
export function PrivacyModal({ onClose }: { onClose: () => void }) {
  const [showFull, setShowFull] = useState(false);
  const modalRef = useModalA11y(onClose);
  return (
    <div className="modal-veil" onClick={onClose} role="dialog" aria-modal="true" aria-label="隐私与数据说明">
      <div className="modal privacy-modal" ref={modalRef} tabIndex={-1} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>隐私与数据说明</h3>
          <button className="modal-x" type="button" onClick={onClose} aria-label="关闭">
            ✕
          </button>
        </div>
        <div className="privacy-body">
          <p className="privacy-abstract">
            本产品<strong>没有后端服务器</strong>：你填写的生辰、问题与所有推演结果，
            <strong>仅保存在你当前浏览器的本地存储中</strong>，不上传、不收集、不用于训练。
          </p>
          <button className="link" type="button" onClick={() => setShowFull((s) => !s)}>
            {showFull ? '收起完整条款 ▲' : '查看完整条款 ▼'}
          </button>
          {showFull && <pre className="privacy-full">{PRIVACY_BODY}</pre>}
        </div>
      </div>
    </div>
  );
}

export { hasConsented };
