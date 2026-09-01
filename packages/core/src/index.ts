/**
 * 玄览 · 算法内核
 *
 * 纯函数层：无 IO、无网络、无 Date.now()、无 Math.random()。
 * AI 永远不参与排盘计算，只在下游做解读。
 */
export * from './types.ts';
export { normalizeBirth, InvalidBirthProfileError, PLACIDUS_LATITUDE_LIMIT } from './profile.ts';
export { hashObject, stableStringify } from './hash.ts';
export {
  calculateAll,
  ADAPTERS,
  ALL_SYSTEMS,
  ENGINE_VERSION,
  baziAdapter,
  ziweiAdapter,
  qimenAdapter,
  liurenAdapter,
  xiaoliurenAdapter,
  meihuaAdapter,
  astrolabeAdapter,
  tarotAdapter,
} from './adapters/index.ts';
export type { CalculateOptions, CalculateResult, Adapter, AdapterContext } from './adapters/index.ts';
export { SYSTEM_META, getSystemMeta, listSystemMeta } from './registry.ts';
export { aggregateConsensus, overallAgreement } from './consensus.ts';
export { synthesizeReport } from './report.ts';
export type { SynthesisReport, SynthesisByAxis, SynthesisPerSystem } from './report.ts';
export type { InterpretationData, InterpretationHighlight, InterpretationTimelineItem } from './types.ts';
