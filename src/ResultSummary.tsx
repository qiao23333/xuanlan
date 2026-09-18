import React from 'react';
import type { Consensus, TopicId } from './core';
import type { TopicVerdict } from './core-meta';
import { deriveVerdict, overallAgreement } from './core-meta';
import { TaoWheel } from './TaoWheel';

interface ResultSummaryProps {
  consensus: Consensus[];
  /** 用户选的主题。裁断层要按主题挑「主判轴」，《所以必须传进来》 */
  topic: TopicId;
  topicLabel: string;
}

/**
 * 档位徽章的文案。
 *
 * 必须同时看三件事：口径有多齐（stance）、这一条轴有没有方向
 * （hasDirection）、以及**到底有几家参与表态**（underSampled）。
 *
 * 只看 stance 会写出「有主调 · 非定论」配「吉凶 · 无明确方向」这种
 * 自相矛盾的组合 —— 实测健康那次就是这个组合：5 家判在中位，
 * 他们一致认同的恰恰是「看不出方向」。
 *
 * 只看 agreement 更危险：n=1 时它必然是 100%。实测事业题就这样输出过
 * 「口径一致：偏「避险」（1 家里 1 家同向，一致度 100%）」。
 */
function stanceWord(v: {
  stance: TopicVerdict['stance'];
  hasDirection: boolean;
  underSampled: boolean;
}): string {
  if (v.underSampled) return '样本太少';
  if (v.stance === 'split') return '没谈拢';
  if (!v.hasDirection) return v.stance === 'clear' ? '口径一致 · 无方向' : '多数判中位';
  return v.stance === 'clear' ? '口径一致' : '有主调 · 非定论';
}

/**
 * 结果页首屏 —— **裁断层**（v0.5 重做）。
 *
 * 改之前这里是什么样：一句写死的「你是一个思想缜密、意蕴丰富的人」——
 * 跟盘面零关系，所有人所有问题都出这两句；「当前在 change 维度上倾向最
 * 显著」里的 `change` 是英文轴 ID，因为 AXIS_LABELS 根本没有 .name 字段。
 *
 * 现在这里只回答一件事：**用户问的那句话，八家到底怎么说**。
 * 三条规则：
 *   1. 先给结论，再给依据；依据一律可展开、不占首屏。
 *   2. 术语后面必须挂「所以呢」。挂不上「所以」的内容不许进首屏。
 *   3. 打平就直说打平——但立刻交付「能确定的那部分」，不装神弄鬼，也不空手。
 */
export function ResultSummary({ consensus, topic, topicLabel }: ResultSummaryProps) {
  if (consensus.length === 0) return null;

  const v = deriveVerdict(consensus, topic);
  if (!v) return null;

  const overallPct = Math.round(overallAgreement(consensus) * 100);
  // 主判轴没结论时，「说得齐」那条已经写进 so 里了，下面不再重复一遍
  const yieldToConsensus = v.stance === 'split' || !v.hasDirection || v.underSampled;
  // 样本太少时不能借用「口径一致」的青色 —— 那是正面暗示，而这一档
  // 说的恰恰是「这家数不够，别当真」。
  const stanceKey = v.underSampled ? 'under' : v.stance;

  return (
    <section className="result-summary xl-card">
      <div className="rs-layout">
        {/* 左侧：太极轮（用户素材，按主题切换） */}
        <div className="rs-taiji-wrap">
          <TaoWheel size={180} />
        </div>

        {/* 中间：裁断 */}
        <div className="rs-body">
          <div className="rs-head">
            <span className="rs-kicker">关于「{topicLabel}」的裁断</span>
            <span className="rs-kicker-en">VERDICT</span>
          </div>

          <p className="rs-ask">{v.ask}</p>

          <div className={`rs-verdict rs-stance-${stanceKey}`}>
            <div className="rs-verdict-top">
              <span className="rs-stance">{stanceWord(v)}</span>
              {v.stance !== 'split' && (
                <span className="rs-lean">
                  {v.dimName} ·{' '}
                  {v.underSampled
                    ? `只有 ${v.sampleSize} 家表态`
                    : v.hasDirection
                    ? `偏「${v.lean}」`
                    : '无明确方向'}
                </span>
              )}
            </div>

            <p className="rs-call">{v.call}</p>
            <p className="rs-so">{v.so}</p>
          </div>

          {/* 除主判轴外，还有哪件事说得齐 / 哪件事最散。
              主判轴自己没结论时，「说得齐」那条已经写进上面的 so 里了，这里不再重复。 */}
          {(v.dissentItem || (v.consensusItem && !yieldToConsensus)) && (
            <div className="rs-aside">
              {v.consensusItem && !yieldToConsensus && (
                <div className="rs-aside-item rs-consensus">
                  <span className="rs-aside-tag">说得齐</span>
                  <span className="rs-aside-text">{v.consensusItem.text}</span>
                </div>
              )}
              {v.dissentItem && (
                <div className="rs-aside-item rs-dissent">
                  <span className="rs-aside-tag">最散</span>
                  <span className="rs-aside-text">
                    {v.dissentItem.dimName} · 只有 {Math.round(v.dissentItem.agreement * 100)}% 一致——这条别当结论用
                  </span>
                </div>
              )}
            </div>
          )}

          <p className="rs-boundary">{v.boundary}</p>

          <div className="rs-meta-row">
            <span className="rs-label">八家内部意见一致度</span>
            <strong className="rs-pct">{overallPct}%</strong>
            <span className="rs-hint">只表示八家分歧小，不代表结论更准，更不是你的分数</span>
          </div>

          <a
            className="rs-jump"
            href="#sec-axes"
            onClick={(e) => {
              e.preventDefault();
              document.getElementById('sec-axes')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
          >
            看依据：六大维度怎么分的 →
          </a>
        </div>

        {/* 右侧：竖排行动指引（参考图 Screen 03） */}
        <aside className="rs-sidebar" aria-hidden="true">
          <span className="rs-sb-item">知己</span>
          <span className="rs-sb-item">识己</span>
          <span className="rs-sb-item">解势</span>
          <span className="rs-sb-item">趋远</span>
        </aside>
      </div>
    </section>
  );
}
