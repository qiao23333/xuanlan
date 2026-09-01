// 前端对内核的统一再导出。内核位于 packages/core/src（带 .ts 扩展名）。
export * from '@core';
export { createSeededRandom } from 'mingyu-core/random';
