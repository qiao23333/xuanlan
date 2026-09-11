import '@testing-library/jest-dom';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// 显式清理：singleFork 复用同一 worker，@testing-library 的自动清理
// 在某些 globals 组合下不触发，会导致多个测试文件间的 DOM 残留、
// 同名文本被 getByText 判为「多个元素」而误报失败。这里强制清理。
afterEach(() => {
  cleanup();
});
