import { useEffect } from 'react';

/**
 * 滚动进入视口渐显（照参考图 3 的 Motion System）。
 *
 * 自动为结果页的顶层区块打上 `.reveal`，元素进入视口时加 `.is-in`
 * 触发淡入上浮；`prefers-reduced-motion` 下直接全部显示。
 *
 * 用 MutationObserver 兼顾后续动态插入的节点（如展开体系详情）。
 */
const AUTO_TARGETS = [
  '.results > *',
  '.so-detail',
  '.case > section',
  '.history > *',
].join(',');

export function useRevealOnScroll(dep?: unknown) {
  useEffect(() => {
    const root = document.documentElement;
    const nodesOf = () =>
      Array.from(document.querySelectorAll<HTMLElement>(`.reveal,${AUTO_TARGETS}`));

    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    if (reduce || typeof IntersectionObserver === 'undefined') {
      nodesOf().forEach((n) => n.classList.add('reveal', 'is-in'));
      return;
    }

    root.classList.add('js-reveal');

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add('is-in');
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: '0px 0px -6% 0px', threshold: 0.06 }
    );

    let queued = 0;
    const scan = () => {
      cancelAnimationFrame(queued);
      queued = requestAnimationFrame(() => {
        for (const n of nodesOf()) {
          if (n.classList.contains('is-in')) continue;
          n.classList.add('reveal');
          io.observe(n);
        }
      });
    };

    scan();

    const mo = new MutationObserver(scan);
    mo.observe(document.body, { childList: true, subtree: true });

    // 兜底：任何情况下 2.4s 后强制全显，避免动画异常导致内容不可见。
    const guard = window.setTimeout(() => {
      document
        .querySelectorAll<HTMLElement>('.reveal:not(.is-in)')
        .forEach((n) => n.classList.add('is-in'));
    }, 2400);

    return () => {
      cancelAnimationFrame(queued);
      window.clearTimeout(guard);
      io.disconnect();
      mo.disconnect();
      root.classList.remove('js-reveal');
    };
  }, [dep]);
}
