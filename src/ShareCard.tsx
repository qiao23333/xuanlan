import React, { useMemo, useRef, useState } from 'react';
import { SYSTEM_META, type CalculateResult, type Consensus, type DateTimeParts, type SystemId } from './core';
import { overallAgreement } from './core-meta';
import type { AppForm } from './features/form/DivinationForm';
import type { SynthesisReport as Report } from './core';
import { TOPIC_LABELS } from './history';
import { buildShareUrl, type ShareDoc } from './share';
import { ACCENTS } from './systemIdentity';

/** 与 AdvisoryCouncil 保持一致的单字标识 */
const SYSTEM_GLYPH: Record<string, string> = {
  bazi: '八', ziwei: '紫', qimen: '奇', liuren: '壬',
  xiaoliuren: '小', meihua: '梅', astrolabe: '星', tarot: '塔',
};

const PALETTE = {
  bg0: '#14101c', bg1: '#1d1730', panel: '#221a36',
  gold: '#edc97c', jade: '#6cc591', red: '#e08585',
  ink: '#ebe6f4', soft: '#9a90b0', line: '#3a2e52',
};

function leanHex(lean: number): string {
  if (lean > 0.3) return PALETTE.jade;
  if (lean < -0.3) return PALETTE.red;
  return PALETTE.gold;
}

interface CardAdvisor {
  systemId: string; name: string; glyph: string; lean: number; isOutlier: boolean;
}

function buildAdvisors(result: CalculateResult, consensus: Consensus[]): CardAdvisor[] {
  const outliers = new Set<string>();
  for (const c of consensus) for (const o of c.outliers) outliers.add(o.systemId);
  return result.charts.map((c) => {
    const a = c.assertions ?? [];
    const w = a.reduce((s, x) => s + x.confidence, 0) || 1;
    const lean = a.reduce((s, x) => s + x.score * x.confidence, 0) / w;
    const meta = SYSTEM_META[c.systemId as SystemId];
    return {
      systemId: c.systemId,
      name: meta?.name ?? c.systemId,
      glyph: SYSTEM_GLYPH[c.systemId] ?? '?',
      lean,
      isOutlier: outliers.has(c.systemId),
    };
  });
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let cur = '';
  for (const ch of text) {
    if (ch === '\n') { lines.push(cur); cur = ''; continue; }
    const test = cur + ch;
    if (ctx.measureText(test).width > maxWidth && cur) { lines.push(cur); cur = ch; }
    else cur = test;
  }
  if (cur) lines.push(cur);
  return lines;
}

function drawCard(
  canvas: HTMLCanvasElement,
  opts: { advisors: CardAdvisor[]; overall: number; topicLabel: string; headline: string; name?: string; seed: number }
) {
  const W = 1080, H = 1440;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = W * dpr; canvas.height = H * dpr;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(dpr, dpr);

  // 背景
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, PALETTE.bg0); bg.addColorStop(1, PALETTE.bg1);
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  // 内描边
  ctx.strokeStyle = PALETTE.line; ctx.lineWidth = 2;
  ctx.strokeRect(28, 28, W - 56, H - 56);

  // 标题
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.gold;
  ctx.font = "700 30px 'PingFang SC','Microsoft YaHei',serif";
  ctx.fillText('玄览 · 八顾问合议卡', W / 2, 92);
  ctx.fillStyle = PALETTE.soft;
  ctx.font = "400 22px 'PingFang SC','Microsoft YaHei',sans-serif";
  const sub = `关于「${opts.topicLabel}」${opts.name ? ` · ${opts.name}` : ''}`;
  ctx.fillText(sub, W / 2, 128);
  ctx.fillText(`起卦数 ${opts.seed}（确定性可复现）`, W / 2, 158);

  // 中心共识环
  const cx = W / 2, cy = 470, ringR = 150;
  ctx.lineWidth = 26;
  ctx.strokeStyle = PALETTE.line;
  ctx.beginPath(); ctx.arc(cx, cy, ringR, 0, Math.PI * 2); ctx.stroke();
  const circ = 2 * Math.PI * ringR;
  ctx.strokeStyle = PALETTE.gold; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(cx, cy, ringR, -Math.PI / 2, -Math.PI / 2 + circ * opts.overall);
  ctx.stroke();
  ctx.fillStyle = PALETTE.gold;
  ctx.font = "700 78px 'PingFang SC',serif";
  ctx.fillText(`${Math.round(opts.overall * 100)}%`, cx, cy + 18);
  ctx.fillStyle = PALETTE.soft;
  ctx.font = "400 24px 'PingFang SC',sans-serif";
  ctx.fillText('总体共识度', cx, cy + 58);

  // 八顾问环绕
  const N = opts.advisors.length;
  const R = 330;
  opts.advisors.forEach((a, i) => {
    const ang = (-90 + (360 / N) * i) * (Math.PI / 180);
    const x = cx + R * Math.cos(ang);
    const y = cy + R * Math.sin(ang);
    const col = ACCENTS[a.systemId as SystemId] ?? leanHex(a.lean);
    ctx.fillStyle = PALETTE.panel;
    ctx.strokeStyle = col; ctx.lineWidth = a.isOutlier ? 4 : 3;
    if (a.isOutlier) ctx.setLineDash([7, 5]); else ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(x, y, 46, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = col;
    ctx.font = "700 40px 'PingFang SC',serif";
    ctx.fillText(a.glyph, x, y + 14);
    ctx.fillStyle = PALETTE.ink;
    ctx.font = "400 22px 'PingFang SC',sans-serif";
    ctx.fillText(a.name, x, y + 78);
    if (a.isOutlier) {
      ctx.fillStyle = PALETTE.red;
      ctx.font = "700 22px 'PingFang SC',sans-serif";
      ctx.fillText('异', x + 40, y - 34);
    }
  });

  // 综合判词
  ctx.textAlign = 'left';
  ctx.fillStyle = PALETTE.gold;
  ctx.font = "600 26px 'PingFang SC',sans-serif";
  ctx.fillText('综合判词', 70, 1080);
  ctx.fillStyle = PALETTE.ink;
  ctx.font = "400 26px 'PingFang SC',sans-serif";
  const lines = wrapText(ctx, opts.headline, W - 140);
  lines.slice(0, 3).forEach((ln, i) => ctx.fillText(ln, 70, 1124 + i * 40));

  // 页脚
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.soft;
  ctx.font = "400 20px 'PingFang SC',sans-serif";
  ctx.fillText('内核严肃 · 外壳科普 · 八大体系交叉验证 · 结果可解释可复现可溯源', W / 2, H - 60);
}

export function ShareCard({
  result, consensus, report, form, schools, seed, seedMode, askedAt, onClose,
}: {
  result: CalculateResult;
  consensus: Consensus[];
  report: Report | null;
  form: AppForm;
  schools: Record<string, string>;
  seed: number | null;
  seedMode: 'question' | 'random';
  askedAt: DateTimeParts | null;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const advisors = useMemo(() => buildAdvisors(result, consensus), [result, consensus]);
  const overall = overallAgreement(consensus);
  const topicLabel = TOPIC_LABELS[form.topic] ?? form.topic;
  const headline = report?.headline ?? '八大体系已完成并排推演。';

  const shareDoc: ShareDoc = useMemo(() => ({
    v: 1,
    name: form.name || undefined,
    gender: form.gender,
    calendarType: form.calendarType,
    year: Number(form.year), month: Number(form.month), day: Number(form.day),
    hour: form.useTimeIndex ? 0 : Number(form.hour),
    minute: form.useTimeIndex ? 0 : Number(form.minute),
    useTimeIndex: form.useTimeIndex, timeIndex: Number(form.timeIndex),
    locName: form.locName, lng: Number(form.lng), lat: Number(form.lat), tz: Number(form.tz),
    useTrueSolarTime: form.useTrueSolarTime, applyChinaDst: form.applyChinaDst,
    topic: form.topic, qtext: form.qtext,
    // 关键：必须携带真实流派配置与问事时刻，否则回放结果与原结果不一致。
    schools: { ...schools },
    seed: seed ?? 0,
    seedMode,
    askedAt: askedAt ?? {
      year: new Date().getFullYear(), month: new Date().getMonth() + 1, day: new Date().getDate(),
      hour: new Date().getHours(), minute: new Date().getMinutes(), second: new Date().getSeconds(),
    },
  }), [form, schools, seed, seedMode, askedAt]);

  const copyLink = async () => {
    const url = buildShareUrl(shareDoc);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // 剪贴板不可用时回退为选中提示
      window.prompt('复制此只读链接分享：', url);
    }
  };

  const downloadPng = () => {
    const cv = canvasRef.current;
    if (!cv) return;
    drawCard(cv, { advisors, overall, topicLabel, headline, name: form.name || undefined, seed: seed ?? 0 });
    const a = document.createElement('a');
    a.download = `玄览合议卡-${seed ?? 0}.png`;
    a.href = cv.toDataURL('image/png');
    a.click();
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  return (
    <div className="modal-veil" onClick={onClose}>
      <div className="share-card" onClick={(e) => e.stopPropagation()}>
        <div className="sc-head">
          <h3>八顾问合议卡</h3>
          <button className="link" type="button" onClick={onClose}>✕</button>
        </div>

        <div className="sc-preview">
          <div className="sc-ring" style={{ ['--p' as string]: Math.round(overall * 100) } as React.CSSProperties}>
            <span className="sc-pct">{Math.round(overall * 100)}%</span>
            <span className="sc-pl">总体共识度</span>
          </div>
          <div className="sc-adv">
            {advisors.map((a) => (
              <span
                key={a.systemId}
                className={`sc-chip${a.isOutlier ? ' out' : ''}`}
                style={{ borderColor: leanHex(a.lean), color: leanHex(a.lean) }}
                title={a.name}
              >
                {a.glyph}
              </span>
            ))}
          </div>
          <p className="sc-headline">{headline}</p>
          <p className="sc-meta">关于「{topicLabel}」{form.name ? ` · ${form.name}` : ''} · 起卦数 {seed ?? 0}</p>
        </div>

        {/* 隐藏画布，仅用于导出 PNG */}
        <canvas ref={canvasRef} style={{ display: 'none' }} />

        <div className="sc-actions">
          <button className="submit" type="button" onClick={copyLink}>
            {copied ? '已复制链接 ✓' : '复制只读链接'}
          </button>
          <button className="ghost" type="button" onClick={downloadPng}>
            {saved ? '已保存图片 ✓' : '下载分享图 (PNG)'}
          </button>
        </div>
        <p className="sc-note">
          只读链接只携带「生辰 + 所问 + 起卦种子」，对方打开后由同一内核确定性重算，结果逐字一致、可溯源、不依赖任何服务器。
        </p>
      </div>
    </div>
  );
}
