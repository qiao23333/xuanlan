/**
 * 历史记录 + 导出（纯前端，localStorage）
 *
 * 设计取舍：
 * - 存「完整 CalculateResult」而非只存 seed。原因：算法会演进，只存 seed 会导致旧记录重算后变形；
 *   存完整结果，历史记录永不变、可离线、可导出，符合"内核严肃"的溯源原则。
 * - 上限 50 条（localStorage ~5MB，单条结果约 50–200KB JSON）。
 * - 导出 Markdown 复用内核的 aggregateConsensus + synthesizeReport，保证"复制出去的东西"和屏幕上一致。
 */

import type { BirthProfile, CalculateResult, Question } from './core';
import { loadCore } from './loadCore';
import type { StoredOutcome } from './reflection';

export interface SavedReading {
  id: string;
  savedAt: string;
  profile: BirthProfile;
  schools: Record<string, string>;
  question: Question | null;
  seed: number;
  result: CalculateResult;
  topicLabel: string;
  /** 收藏标记（评审 P1：历史记录支持标签/收藏，便于高频用户快速定位）。 */
  favorite?: boolean;
  /**
   * 复盘结果。**仅本人可见**，随备份一起导出导入，平台不上传、不聚合。
   * 见 reflection.ts 顶部关于「为什么不叫准确率」的说明。
   */
  outcome?: StoredOutcome;
}

const KEY = 'xuanlan.history.v1';
const MAX = 50;
export const SCHEMA_VERSION = 1;

/**
 * 旧数据兼容：老版本没有 favorite 字段，缺失时补默认 false。
 * 评审曾指出 localStorage 无版本控制，未来 SavedReading 结构变化时，
 * 这里集中做字段迁移，保证旧记录不静默失效。
 */
export function migrate(list: unknown): SavedReading[] {
  if (!Array.isArray(list)) return [];
  return list.map((r: any) => ({ ...r, favorite: !!r?.favorite, outcome: r?.outcome ?? undefined }));
}

export function loadHistory(): SavedReading[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    return migrate(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function saveReading(r: SavedReading): SavedReading[] {
  const list = loadHistory().filter((x) => x.id !== r.id);
  list.unshift(r);
  const trimmed = list.slice(0, MAX);
  try {
    localStorage.setItem(KEY, JSON.stringify(trimmed));
  } catch {
    /* 配额满或隐私模式：静默降级，不阻断主流程 */
  }
  return trimmed;
}

export function deleteReading(id: string): SavedReading[] {
  const list = loadHistory().filter((x) => x.id !== id);
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
  return list;
}

export function clearHistory(): SavedReading[] {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  return [];
}

export function newReadingId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `r-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  }
}

/** 切换收藏标记，返回更新后的列表（写入 localStorage）。 */
export function toggleFavorite(id: string): SavedReading[] {
  const list = loadHistory().map((r) => (r.id === id ? { ...r, favorite: !r.favorite } : r));
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
  return list;
}

/**
 * 写入 / 清除一条复盘。传 null 表示撤销标注。
 *
 * 注意 resolvedAt 由调用方传入而非内部 new Date()：内核禁 Date.now 是为了
 * 可复现，这里是为了让「多久之后回来复盘」这件事可被测试与回放。
 */
export function setOutcome(id: string, outcome: StoredOutcome | null): SavedReading[] {
  const list = loadHistory().map((r) => (r.id === id ? { ...r, outcome: outcome ?? undefined } : r));
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
  return list;
}

/** 全量导出为 JSON 备份（含 schemaVersion，便于跨设备/跨版本恢复）。 */
export function exportAllJson(history: SavedReading[]): string {
  return JSON.stringify(
    { schemaVersion: SCHEMA_VERSION, exportedAt: new Date().toISOString(), readings: history },
    null,
    2
  );
}

/**
 * 导入备份 JSON，与现有记录按 id 去重合并。
 * 返回合并后的完整列表与统计，供 UI 提示「新增 N / 跳过 M」。
 */
export function importBackup(json: string): { list: SavedReading[]; added: number; skipped: number } {
  const data = JSON.parse(json);
  const incoming: SavedReading[] = Array.isArray(data) ? data : (data?.readings ?? []);
  if (!Array.isArray(incoming)) throw new Error('备份格式无法识别');
  const existing = loadHistory();
  const seen = new Set(existing.map((r) => r.id));
  const merged = [...existing];
  let added = 0;
  let skipped = 0;
  for (const r of incoming) {
    if (!r?.id) continue;
    if (seen.has(r.id)) {
      skipped++;
      continue;
    }
    const m = migrate([r])[0];
    if (!m) continue;
    merged.push(m);
    added++;
  }
  const trimmed = merged.slice(0, MAX);
  try {
    localStorage.setItem(KEY, JSON.stringify(trimmed));
  } catch {
    /* ignore */
  }
  return { list: trimmed, added, skipped };
}

const TOPIC_LABELS: Record<string, string> = {
  general: '综合',
  career: '事业',
  romance: '感情',
  money: '财运',
  move: '出行/搬迁',
  study: '学业',
  health: '健康',
  relationship: '人际',
  timing: '择时',
};

/**
 * 把一条记录渲染成自包含的 Markdown 长文（含共识 + 综合解读 + 各体系要点 + 诚实边界）。
 *
 * 异步：合成报告要用到内核，而内核是懒加载的。导出是低频操作，
 * 等一次动态 import 完全可接受 —— 换来的是首屏不背这 1.6MB。
 */
export async function readingToMarkdown(r: SavedReading): Promise<string> {
  const { aggregateConsensus, synthesizeReport } = await loadCore();
  const consensus = aggregateConsensus(r.result.charts.flatMap((c) => c.assertions));
  const report = synthesizeReport(r.result, consensus, { topic: r.question?.topicId, question: r.question?.text });

  const lines: string[] = [];
  lines.push(`# 玄览 · 综合解读报告`);
  lines.push('');
  lines.push(`- 问事主题：${r.topicLabel || '综合'}`);
  lines.push(`- 当事人：${r.profile.name || '（未署名）'} · ${r.profile.gender === 'male' ? '男' : '女'}`);
  lines.push(
    `- 生辰：${r.profile.year}-${String(r.profile.month).padStart(2, '0')}-${String(r.profile.day).padStart(2, '0')} ` +
      `${r.profile.hour != null ? `${String(r.profile.hour).padStart(2, '0')}:${String(r.profile.minute ?? 0).padStart(2, '0')}` : `第${r.profile.timeIndex ?? '?'}时辰`}`
  );
  if (r.question?.text) lines.push(`- 所问：${r.question.text}`);
  lines.push(`- 排盘时间：${r.savedAt}`);
  lines.push(`- 随机种子：${r.seed}`);
  lines.push('');
  lines.push(report.headline);
  lines.push('');
  lines.push('## 各维度共识');
  for (const a of report.byAxis) lines.push(`- ${a.text}`);
  lines.push('');
  lines.push('## 各体系要点');
  for (const s of report.perSystem) {
    lines.push(`### ${s.name}`);
    for (const p of s.points) lines.push(`- ${p}`);
  }
  lines.push('');
  lines.push('## 诚实边界');
  for (const c of report.caveats) lines.push(`- ${c}`);
  lines.push('');
  lines.push('---');
  lines.push('*本结果由开源术数算法按古籍规则确定性计算，仅供文化体验与学习，不构成任何人生、医疗、法律、投资建议。*');

  return lines.join('\n');
}

export function downloadText(filename: string, text: string, mime = 'text/markdown;charset=utf-8'): void {
  try {
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch {
    /* 忽略下载失败 */
  }
}

export function safeFileName(s: string): string {
  return (s || '玄览').replace(/[\\/:*?"<>|]/g, '_').slice(0, 40);
}

export { TOPIC_LABELS };
