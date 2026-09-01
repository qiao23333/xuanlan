/**
 * 稳定序列化：对象键排序后 JSON 化，避免字段顺序变化导致 hash 漂移。
 * 这是「快照不可变 + 缓存命中」的基础。
 */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value ?? null);
  }
  if (Array.isArray(value)) {
    return '[' + value.map(stableStringify).join(',') + ']';
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + stableStringify(obj[k])).join(',') + '}';
}

/**
 * 纯 JS 同步哈希（FNV-1a 双种子）。
 *
 * 为什么不用 node:crypto / Web Crypto：内核需在 Node（测试）与浏览器（Web 应用）
 * 两套环境用同一份代码跑，而 createHash 在浏览器不可用、Web Crypto 又是异步的。
 * configHash 只用于「快照可溯源 + 缓存命中」，不要求密码学强度，
 * 双种子 FNV-1a 足以保证跨环境一致、对输入敏感、碰撞概率极低。
 * 固定输出 16 位十六进制。
 */
function fnv1a(str: string, seed: number): number {
  let h = seed >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function hashObject(...parts: unknown[]): string {
  const s = parts.map(stableStringify).join('§');
  const a = fnv1a(s, 0x811c9dc5);
  const b = fnv1a(s, 0x9e3779b9);
  return a.toString(16).padStart(8, '0') + b.toString(16).padStart(8, '0');
}
