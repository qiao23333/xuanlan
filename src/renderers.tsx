import React from 'react';

/* ───────────────────────── 通用小工具 ───────────────────────── */

const s = (v: unknown): string => (v == null ? '' : String(v));

/** 把任意结构渲染成可折叠的树，用于「查看完整盘面」。 */
export function JsonView({ data }: { data: unknown }) {
  return <pre className="jsonview">{JSON.stringify(data, null, 2)}</pre>;
}

function Tag({ children, tone = 'default' }: { children: React.ReactNode; tone?: string }) {
  return <span className={`tag tag-${tone}`}>{children}</span>;
}

/* ───────────────────────── 四柱八字 ───────────────────────── */

export function BaziView({ data }: { data: any }) {
  const pillars = data?.pillars ?? {};
  const order: Array<['year' | 'month' | 'day' | 'hour', string]> = [
    ['year', '年柱'],
    ['month', '月柱'],
    ['day', '日柱'],
    ['hour', '时柱'],
  ];
  const dm = data?.dayMaster;
  const lunar = data?.lunarDate;
  const solar = data?.solarDate;
  const ws = data?.wuxingStrength;
  return (
    <div className="sys bazi">
      <div className="pillar-row">
        {order.map(([k, label]) => {
          const p = pillars[k] ?? {};
          return (
            <div className="pillar" key={k}>
              <div className="pillar-label">{label}</div>
              <div className="pillar-gan">{s(p.gan)}</div>
              <div className="pillar-zhi">{s(p.zhi)}</div>
              <div className="pillar-gz">{s(p.ganZhi)}</div>
            </div>
          );
        })}
      </div>
      <div className="kv-row">
        {dm && <Tag tone="gold">日主 {s(dm.gan)}{s(dm.element)}{s(dm.yinYang)}</Tag>}
        {data?.zodiac && <Tag>生肖 {s(data.zodiac)}</Tag>}
        {solar && <Tag>公历 {s(solar.year)}-{s(solar.month)}-{s(solar.day)}</Tag>}
        {lunar && <Tag>农历 {s(lunar.year)}年{s(lunar.monthName)}{s(lunar.dayName)}</Tag>}
      </div>
      {ws && typeof ws === 'object' && (
        <div className="kv-row">
          {Object.entries(ws).slice(0, 5).map(([k, v]) => (
            <Tag key={k} tone="jade">{s(k)} {s(v)}</Tag>
          ))}
        </div>
      )}
      {data?.analysis && <p className="note">{s(data.analysis).slice(0, 80)}</p>}
    </div>
  );
}

/* ───────────────────────── 紫微斗数 ───────────────────────── */

export function ZiweiView({ data }: { data: any }) {
  const palaces: any[] = data?.astrolabe?.palaces ?? [];
  if (!palaces.length) return <p className="note">暂无十二宫数据</p>;
  return (
    <div className="sys ziwei">
      <div className="ziwei-grid">
        {palaces.map((p) => (
          <div
            className={`ziwei-cell${p.isBodyPalace ? ' body' : ''}${p.isOriginalPalace ? ' original' : ''}`}
            key={p.index}
          >
            <div className="zp-name">{s(p.name)}</div>
            <div className="zp-branch">[{s(p.earthlyBranch)}]</div>
            <div className="zp-stars">
              {(p.majorStars ?? []).map((st: any, i: number) => (
                <span className="star major" key={i}>
                  {s(st.name)}
                  {st.brightness ? <em className="bright">{s(st.brightness)}</em> : null}
                </span>
              ))}
              {(p.minorStars ?? []).map((st: any, i: number) => (
                <span className="star minor" key={`m${i}`}>{s(st.name)}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className="note">命宫 / 身宫已高亮；完整星曜、四化与流年详见展开。</p>
    </div>
  );
}

/* ───────────────────────── 奇门遁甲（九宫格） ───────────────────────── */

// 洛书九宫显示顺序（3×3）：四绿/九紫/二黑 / 三碧/五黄/七赤 / 八白/一白/六白
const LUOSHU: number[][] = [
  [4, 9, 2],
  [3, 5, 7],
  [8, 1, 6],
];

export function QimenView({ data }: { data: any }) {
  const grid: any[] = data?.jiuGongGe ?? [];
  if (!grid.length) return <p className="note">暂无九宫数据</p>;
  const byGong: Record<number, any> = {};
  for (const g of grid) byGong[g.gong] = g;
  return (
    <div className="sys qimen">
      <div className="qimen-grid">
        {LUOSHU.map((row, ri) => (
          <React.Fragment key={ri}>
            {row.map((gong) => {
              const g = byGong[gong];
              if (!g) return <div className="qg empty" key={gong} />;
              return (
                <div className="qg" key={gong}>
                  <div className="qg-name">{s(g.name)}</div>
                  <div className="qg-line"><span className="q-tian">天 {s(g.tianPan?.star)}</span><span className="q-stem">{s(g.tianPan?.stem)}</span></div>
                  <div className="qg-line"><span className="q-di">地 {s(g.diPan?.stem)}</span></div>
                  <div className="qg-line"><span className="q-ren">门 {s(g.renPan?.door)}</span><span className="q-shen">神 {s(g.shenPan?.god)}</span></div>
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

/* ───────────────────────── 大六壬 ───────────────────────── */

export function LiurenView({ data }: { data: any }) {
  const four: any[] = data?.fourLessons ?? [];
  const three: any[] = data?.threeTransmissions ?? [];
  const heaven: any[] = data?.heavenlyPlate ?? [];
  const earth: any[] = data?.earthlyPlate ?? [];
  return (
    <div className="sys liuren">
      <div className="lr-block">
        <div className="lr-title">四课</div>
        {four.map((c, i) => (
          <div className="lr-lesson" key={i}>
            <span className="lr-ke">{s(c.name)}</span>
            <span className="lr-up">{s(c.upper)}</span>
            <span className="lr-rel">{s(c.relation)}</span>
            <span className="lr-low">{s(c.lower)}</span>
            <span className="lr-god">{s(c.god)}</span>
          </div>
        ))}
      </div>
      <div className="lr-block">
        <div className="lr-title">三传</div>
        {three.map((c, i) => (
          <div className="lr-trans" key={i}>
            <span className="lr-stage">{s(c.stage)}</span>
            <span className="lr-branch">{s(c.branch)}</span>
            <span className="lr-god">{s(c.god)}</span>
            <span className="lr-rel">{s(c.relation)}</span>
          </div>
        ))}
      </div>
      <div className="lr-block">
        <div className="lr-title">天地盘（顺时针十二支）</div>
        <div className="lr-plate">
          <div className="lr-row-label">地盘</div>
          <div className="lr-branches">{earth.map((b: string, i: number) => <span key={i}>{s(b)}</span>)}</div>
        </div>
        <div className="lr-plate">
          <div className="lr-row-label">天盘</div>
          <div className="lr-branches">{heaven.map((h: any, i: number) => <span key={i} title={s(h.god)}>{s(h.branch)}<em>{s(h.god)}</em></span>)}</div>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── 小六壬 ───────────────────────── */

/** 六神吉凶判定（通行掌诀歌诀的基调） */
const XLR_JUDGE: Record<string, { tone: 'good' | 'bad' | 'neutral'; tag: string }> = {
  大安: { tone: 'good', tag: '吉 · 安稳' },
  速喜: { tone: 'good', tag: '吉 · 速至' },
  小吉: { tone: 'good', tag: '吉 · 和合' },
  留连: { tone: 'bad', tag: '凶 · 迟滞' },
  赤口: { tone: 'bad', tag: '凶 · 口舌' },
  空亡: { tone: 'neutral', tag: '空 · 虚无' },
};

export function XiaoliurenView({ data }: { data: any }) {
  const seq: any = data?.sequence ?? {};
  const order = ['month', 'day', 'hour'] as const;
  const labels: Record<string, string> = { month: '月', day: '日', hour: '时' };
  const verdict = data?.primary ?? seq?.hour ?? {};
  const judge = XLR_JUDGE[verdict?.name] ?? { tone: 'neutral', tag: '' };
  const gz = data?.ganzhi ?? {};
  const gzText = [gz.year, gz.month, gz.day, gz.hour].filter(Boolean).join(' ');
  return (
    <div className="sys xiaoliuren">
      <div className="xlr-row">
        {order.map((k) => {
          const cell = seq[k] ?? {};
          const j = XLR_JUDGE[cell?.name];
          return (
            <div className={`xlr-cell${k === 'hour' ? ' focus' : ''}`} key={k}>
              <div className="xlr-label">{labels[k]}宫</div>
              <div className="xlr-name">{s(cell.name)}</div>
              {j && <div className={`xlr-judge xlr-${j.tone}`}>{j.tag}</div>}
              <div className="xlr-verse">{s(cell.verse)}</div>
            </div>
          );
        })}
      </div>
      <div className="xlr-verdict">
        <span className={`xlr-verdict-tag xlr-${judge.tone}`}>断：{s(verdict.name)}（{judge.tag}）</span>
        {gzText && <span className="xlr-gz">占时干支 {gzText}</span>}
      </div>
      <p className="note">{s(data?.methodLabel)} · 月日起数、时宫为占；以上为掌诀歌谣的直译，非预测。</p>
    </div>
  );
}

/* ───────────────────────── 梅花易数 ───────────────────────── */

const YAO_NAME: Record<number, string> = { 1: '初爻', 2: '二爻', 3: '三爻', 4: '四爻', 5: '五爻', 6: '上爻' };

export function MeihuaView({ data }: { data: any }) {
  const an = data?.analysis ?? {};
  const main = data?.mainHexagram ?? {};
  const inter = data?.interHexagram ?? {};
  const changed = data?.changedHexagram ?? {};
  const calc = data?.calculation ?? {};
  const gz = data?.ganzhi ?? {};
  const moving = data?.movingYao ?? {};
  const yaos: any[] = Array.isArray(data?.yaosDetail) ? data.yaosDetail : [];
  const yingQi: string[] = Array.isArray(an.yingQi) ? an.yingQi : [];
  const steps: any[] = data?.evidenceAnalysis?.calculationFact?.steps ?? [];

  const gua = (g: any, label: string, hint: string) =>
    g?.name ? (
      <div className="mh-gua">
        <div className="mh-gua-label">{label}</div>
        <div className="mh-symbol">{s(g.symbol)}</div>
        <div className="mh-name">{s(g.name)}</div>
        <div className="mh-upperlower">
          上{s(g.upper)} · 下{s(g.lower)}
        </div>
        <div className="mh-desc">{s(g.description)}</div>
        <div className="mh-hint">{hint}</div>
      </div>
    ) : null;

  return (
    <div className="sys meihua">
      {/* 起卦依据：把"为什么是这一卦"摊开给用户看 */}
      <div className="mh-block">
        <div className="mh-title">起卦法 · {s(calc.method)}</div>
        {steps.length > 0 ? (
          <div className="mh-steps">
            {steps.map((st: any, i: number) => (
              <div className="mh-step" key={i}>
                <b>{s(st.target)}</b>
                {s(st.promptText ?? `${st.expression} 除 ${st.modulus} 取余 = ${st.result}`)}
              </div>
            ))}
          </div>
        ) : (
          <div className="mh-sub">
            年支 {s(calc.yearZhi)} · 农历 {s(calc.month)} 月 {s(calc.day)} 日 · 时支 {s(calc.timeZhi)}
          </div>
        )}
      </div>

      {/* 三卦：本（现状）→ 互（过程）→ 变（结局） */}
      <div className="mh-row">
        {gua(main, '本卦', '现状')}
        <div className="mh-arrow">→</div>
        {gua(inter, '互卦', '过程')}
        <div className="mh-arrow">→</div>
        {gua(changed, '变卦', '结局')}
      </div>

      {/* 六爻：自下而上，动爻高亮 */}
      {yaos.length > 0 && (
        <div className="mh-block">
          <div className="mh-title">六爻（自下而上）</div>
          <div className="mh-yaos">
            {[...yaos].reverse().map((y: any) => (
              <div className={`mh-yao${y.isChanging ? ' changing' : ''}`} key={s(y.position)}>
                <div className="yao-line">{y.yaoType === '阳' ? '━━━━━' : '━━ ━━'}</div>
                <div className="yao-meta">
                  {YAO_NAME[Number(y.position)] ?? `第${s(y.position)}爻`} · {s(y.yaoType)} · {s(y.tiYong)}
                </div>
              </div>
            ))}
          </div>
          {main.movingYaoCi && (
            <div className="mh-moving">
              <span className="mh-label">动爻辞</span>
              <b>{s(moving.yaoName ?? moving.description)}</b>
              <span className="mh-yaoci">{s(main.movingYaoCi)}</span>
            </div>
          )}
        </div>
      )}

      {/* 体用 + 旺衰 */}
      <div className="mh-block">
        <div className="mh-title">体用与旺衰</div>
        <div className="mh-tiyong">
          {data?.tiGua && (
            <Tag tone="gold">
              体卦 {s(data.tiGua.name)}（{s(data.tiGua.element)}·{s(data.tiGua.nature)}）
            </Tag>
          )}
          {data?.yongGua && (
            <Tag tone="jade">
              用卦 {s(data.yongGua.name)}（{s(data.yongGua.element)}·{s(data.yongGua.nature)}）
            </Tag>
          )}
          <Tag>本卦体用 {s(an.tiYongRelation)}</Tag>
          <Tag>变卦体用 {s(an.changedRelation)}</Tag>
          <Tag>体卦 {s(an.tiSeasonState)}</Tag>
          <Tag>用卦 {s(an.yongSeasonState)}</Tag>
        </div>
        <div className="mh-sub">
          时令 {s(an.season)}（月支 {s(an.monthBranch)} · 月五行 {s(an.monthElement)}）· 互卦 {s(an.inter1Relation)} /{' '}
          {s(an.inter2Relation)}
        </div>
      </div>

      {/* 应期 */}
      {yingQi.length > 0 && (
        <div className="mh-block">
          <div className="mh-title">应期参考</div>
          <ul className="mh-yingqi">
            {yingQi.map((t: string, i: number) => (
              <li key={i}>{s(t)}</li>
            ))}
          </ul>
        </div>
      )}

      {/* 起卦干支 */}
      {gz && Object.keys(gz).length > 0 && (
        <div className="mh-block">
          <div className="mh-title">起卦干支</div>
          <div className="mh-ganzhi">
            <span>
              <i>年</i>
              {s(gz.year)}
            </span>
            <span>
              <i>月</i>
              {s(gz.month)}
            </span>
            <span>
              <i>日</i>
              {s(gz.day)}
            </span>
            <span>
              <i>时</i>
              {s(gz.hour)}
            </span>
          </div>
        </div>
      )}

      {/* 本卦六爻辞（折叠，避免撑爆卡片） */}
      {Array.isArray(main.yaoCi) && main.yaoCi.length > 0 && (
        <details className="mh-fold">
          <summary>本卦六爻辞</summary>
          <ol>
            {main.yaoCi.map((c: string, i: number) => (
              <li key={i}>{s(c)}</li>
            ))}
          </ol>
        </details>
      )}
    </div>
  );
}

/* ───────────────────────── 西洋本命占星 ───────────────────────── */

export function AstrolabeView({ data }: { data: any }) {
  const planets: any[] = data?.planets ?? [];
  const angles: any[] = data?.angles ?? [];
  return (
    <div className="sys astrolabe">
      <div className="astro-angles">
        {angles.map((a, i) => (
          <Tag key={i} tone="gold">{s(a.label)} {s(a.formatted)}</Tag>
        ))}
      </div>
      <table className="astro-table">
        <thead>
          <tr><th>行星</th><th>位置</th><th>宫</th><th></th></tr>
        </thead>
        <tbody>
          {planets.map((p, i) => (
            <tr key={i}>
              <td>{s(p.label)}</td>
              <td>{s(p.formatted)}</td>
              <td>第{s(p.house)}宫</td>
              <td>{p.retrograde ? <span className="tag tag-red">逆行</span> : null}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ───────────────────────── 塔罗 ───────────────────────── */

export function TarotView({ data }: { data: any }) {
  const cards: any[] = data?.cards ?? [];
  return (
    <div className="sys tarot">
      <div className="tarot-spread">{s(data?.spreadName)}</div>
      <div className="tarot-row">
        {cards.map((c, i) => (
          <div className={`tarot-card${c.reversed ? ' reversed' : ''}`} key={i}>
            <div className="tc-pos">{s(c.position)}</div>
            <div className="tc-name">{s(c.name)}</div>
            {c.reversed && <div className="tc-rev">逆位</div>}
            <div className="tc-kw">{(c.keywords ?? []).slice(0, 3).join(' · ')}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ───────────────────────── 分发 ───────────────────────── */

export function SystemRenderer({ systemId, data }: { systemId: string; data: any }) {
  switch (systemId) {
    case 'bazi': return <BaziView data={data} />;
    case 'ziwei': return <ZiweiView data={data} />;
    case 'qimen': return <QimenView data={data} />;
    case 'liuren': return <LiurenView data={data} />;
    case 'xiaoliuren': return <XiaoliurenView data={data} />;
    case 'meihua': return <MeihuaView data={data} />;
    case 'astrolabe': return <AstrolabeView data={data} />;
    case 'tarot': return <TarotView data={data} />;
    default: return <JsonView data={data} />;
  }
}
