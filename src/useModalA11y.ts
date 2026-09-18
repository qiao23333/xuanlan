import { useEffect, useRef } from 'react';

/**
 * 弹层无障碍三件套：
 *  1) Esc 关闭（closeOnEscape=false 时不绑，用于「必须显式同意」的须知弹层）
 *  2) 打开时把焦点移到弹层内第一个可聚焦元素，关闭后把焦点还给触发者
 *  3) Tab 焦点陷阱，避免用键盘「跑出」弹层
 *
 * 用法：把返回的 ref 挂到 .modal 根节点上，并给它 tabIndex={-1} 作为兜底焦点。
 * 这直接回应评审「缺无障碍 / 键盘可达性」这条——也是 WCAG 2.1 AA 的硬要求。
 */
export function useModalA11y(onClose: () => void, opts?: { closeOnEscape?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const closeOnEscape = opts?.closeOnEscape ?? true;

  useEffect(() => {
    const prevActive = document.activeElement as HTMLElement | null;
    const el = ref.current;

    if (el) {
      const focusables = el.querySelectorAll<HTMLElement>(
        'a[href],button:not([disabled]),input,select,textarea,[tabindex]:not([tabindex="-1"])'
      );
      (focusables[0] ?? el).focus();
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && closeOnEscape) {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key === 'Tab' && el) {
        const f = el.querySelectorAll<HTMLElement>(
          'a[href],button:not([disabled]),input,select,textarea,[tabindex]:not([tabindex="-1"])'
        );
        if (f.length === 0) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (!first || !last) return;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', onKey, true);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.body.style.overflow = prevOverflow;
      prevActive?.focus?.();
    };
  }, [onClose, closeOnEscape]);

  return ref;
}
