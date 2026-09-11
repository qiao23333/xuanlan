/**
 * 内核懒加载。
 *
 * 为什么要懒：内核（iztro + mingyu-core + 历法库）打包后约 1.6MB，
 * 占了整个应用体积的 ~87%。而首屏只是一张太极入场页 —— 用户还没点
 * 「开始推演」，就已经为八套算法买了单。动态 import 之后，内核只在
 * 真正要排盘时才下载，首屏体积随之降到三分之一左右。
 *
 * 为什么要缓存：多处（提交表单、回放历史、导出 Markdown）都会用到内核，
 * 各写一次 import() 虽然 Vite 会去重，但缓存 promise 能让调用点更干净，
 * 也保证「内核只加载一次」这件事在代码里显式可见。
 *
 * 注意：这里只导出类型安全的加载函数，**不**再导出内核成员，
 * 否则任何 `import { X } from './loadCore'` 都会让它退化成静态依赖。
 */
type CoreModule = typeof import('./core');

let pending: Promise<CoreModule> | null = null;

/** 首次调用会触发下载，之后复用同一个 promise */
export function loadCore(): Promise<CoreModule> {
  pending ??= import('./core');
  return pending;
}

/** 仅用于类型标注，避免各处重复写 Awaited<ReturnType<...>> */
export type Core = CoreModule;
