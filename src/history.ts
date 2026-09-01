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
import { aggregateConsensus, synthesizeReport } from './core';

export interface SavedReading {
  id: string;
  savedAt: string;
  profile: BirthProfile;
  schools: Record<string, string>;
  question: Question | null;
  seed: number;
  result: CalculateResult;
  topicLabel: string;
}

const KEY = 'xuanlan.history.v1';
const MAX = 50;

export function loadHistory(): SavedReading[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? (arr as SavedReading[]) : [];
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

const TOPIC_LABELS: Record<string, string> = {
  general: '综合',
  career: '事业',
  romance: '感情',
  money: '财运',
  move: '出行/搬迁',
  study: '学业',
  health: '健康',
  relationship: '人际',
};

/** 把一条记录渲染成自包含的 Markdown 长文（含共识 + 综合解读 + 各体系要点 + 诚实边界） */
export function readingToMarkdown(r: SavedReading): string {
  const consensus = aggregateConsensus(r.result.charts.flatMap((c) => c.assertions));
  const report = synthesizeReport(r.result, consensus, (r.question?.topicId as any) ?? 'general');

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
