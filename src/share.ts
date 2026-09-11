/**
 * 分享模块：把一次推演「编码成只读链接」。
 *
 * 设计要点（也是产品的核心承诺）：链接里只放【输入】——生辰、所问、流派开关、
 * 起卦种子与问事时刻。接收方打开后，用同样的开源内核按相同种子确定性重算，
 * 必然得到逐字一致的结果。这样链接极短、可复现、可溯源，且不泄露任何服务端。
 *
 * 哈希格式：location.hash = "#/r=<base64url(json)>"
 */

export interface ShareDoc {
  v: 1;
  name?: string;
  gender: 'male' | 'female';
  calendarType: 'solar' | 'lunar';
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  useTimeIndex: boolean;
  timeIndex: number;
  locName: string;
  lng: number;
  lat: number;
  tz: number;
  useTrueSolarTime: boolean;
  applyChinaDst: boolean;
  topic: string;
  qtext: string;
  schools: Record<string, string>;
  seed: number;
  seedMode: 'question' | 'random';
  askedAt: { year: number; month: number; day: number; hour: number; minute: number; second: number };
}

const HASH_PREFIX = '#/r=';

function b64urlEncode(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(b64: string): string {
  const norm = b64.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(norm);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function encodeShare(doc: ShareDoc): string {
  return b64urlEncode(JSON.stringify(doc));
}

export function decodeShare(payload: string): ShareDoc | null {
  try {
    const obj = JSON.parse(b64urlDecode(payload));
    if (!obj || obj.v !== 1) return null;
    // 必要字段粗校验，缺则视为损坏。
    if (typeof obj.year !== 'number' || typeof obj.seed !== 'number') return null;
    return obj as ShareDoc;
  } catch {
    return null;
  }
}

/** 从当前 URL 哈希解析分享文档；无分享则返回 null。 */
export function parseShareFromHash(): ShareDoc | null {
  const h = window.location.hash || '';
  if (!h.startsWith(HASH_PREFIX)) return null;
  return decodeShare(h.slice(HASH_PREFIX.length));
}

/** 生成带分享哈希的完整链接（不修改当前页面哈希）。 */
export function buildShareUrl(doc: ShareDoc): string {
  const base = window.location.origin + window.location.pathname;
  return `${base}${HASH_PREFIX}${encodeShare(doc)}`;
}
