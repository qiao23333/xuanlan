import React from 'react';
import { useModalA11y } from './useModalA11y';
import { RELEASES } from './changelog';

/**
 * 更新日志弹层。内容取自 src/changelog.ts 的里程碑数据，非实时渲染 git log。
 * 复用与 PrivacyModal 相同的弹层骨架（.modal-veil / .modal / useModalA11y），
 * 保证 Esc 关闭、焦点陷阱、遮罩点击关闭等无障碍行为一致。
 */
export function ChangelogModal({ onClose }: { onClose: () => void }) {
  const modalRef = useModalA11y(onClose);
  return (
    <div className="modal-veil" onClick={onClose} role="dialog" aria-modal="true" aria-label="更新日志">
      <div className="modal changelog-modal" ref={modalRef} tabIndex={-1} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>更新日志</h3>
          <button className="modal-x" type="button" onClick={onClose} aria-label="关闭">
            ✕
          </button>
        </div>
        <div className="changelog-body">
          {RELEASES.map((r) => (
            <section className={`cl-item${r.latest ? ' is-latest' : ''}`} key={r.version}>
              <div className="cl-head">
                <span className="cl-ver">v{r.version}</span>
                {r.latest && <span className="cl-badge">最新</span>}
                <span className="cl-date">{r.date}</span>
              </div>
              <h4 className="cl-title">{r.title}</h4>
              <ul className="cl-list">
                {r.items.map((it, i) => (
                  <li key={i}>{it}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
