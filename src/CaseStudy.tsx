import React from 'react';

const SYSTEMS = ['四柱八字', '紫微斗数', '奇门遁甲', '大六壬', '小六壬', '梅花易数', '西洋占星', '塔罗'];
const AXES = [
  { name: '行动', pos: '宜动', neg: '宜静' },
  { name: '时机', pos: '宜进', neg: '宜守' },
  { name: '人际', pos: '结盟', neg: '独处' },
  { name: '风险', pos: '进取', neg: '避险' },
  { name: '变化', pos: '求变', neg: '守常' },
  { name: '吉凶', pos: '吉', neg: '凶' },
];

/** 决策轴模型：八体系 → 投影 → 六轴（项目的核心建模决策） */
function AxisProjectionDiagram() {
  const L = { x: 76, y0: 28, step: 33 };
  const R = { x: 470, y0: 52, step: 40 };
  const ly = (i: number) => L.y0 + i * L.step;
  const ry = (j: number) => R.y0 + j * R.step;

  return (
    <svg className="axis-diagram" viewBox="0 0 680 310" role="img" aria-label="八体系投影到六决策轴">
      {/* 投影线（多对多） */}
      {SYSTEMS.map((_, i) =>
        AXES.map((__, j) => (
          <line
            key={`${i}-${j}`}
            x1={L.x + 6}
            y1={ly(i)}
            x2={R.x - 6}
            y2={ry(j)}
            stroke="#c39a4e"
            strokeWidth="0.8"
            opacity="0.13"
          />
        ))
      )}

      {/* 左：八体系 */}
      {SYSTEMS.map((s, i) => (
        <g key={s}>
          <circle cx={L.x} cy={ly(i)} r="3" fill="#edc97c" />
          <text x={L.x - 12} y={ly(i) + 4} textAnchor="end" className="ad-label">
            {s}
          </text>
        </g>
      ))}

      {/* 中：投影带 */}
      <text x="273" y="164" textAnchor="middle" className="ad-mid">
        各自用原生语言判断
      </text>
      <text x="273" y="182" textAnchor="middle" className="ad-mid dim">
        只输出轴上的倾向值 [-2, +2]
      </text>

      {/* 右：六轴 */}
      {AXES.map((a, j) => (
        <g key={a.name}>
          <circle cx={R.x} cy={ry(j)} r="3" fill="#7fd6b0" />
          <text x={R.x + 12} y={ry(j) + 4} className="ad-label">
            {a.name}
          </text>
          <text x={R.x + 52} y={ry(j) + 4} className="ad-axis">
            {a.pos} ↔ {a.neg}
          </text>
        </g>
      ))}
    </svg>
  );
}

const ITERATIONS = [
  {
    v: 'v1',
    title: 'MVP · 先解决「能算」',
    points: [
      '8 个 adapter 统一成 ChartResult 协议，接住 mingyu-core / iztro 的算法能力',
      '硬边界全啃：真太阳时、中国夏令时、极区 Placidus 失效、早晚子时换日',
      '对拍验证：八字 vs lunar-typescript、大六壬 vs liuren-ts-lib，21 项测试全过',
      '唯一差异（早晚子时换日）不是 bug，是流派口径 —— 固化为黄金用例，UI 显式开关',
    ],
  },
  {
    v: 'v2',
    title: '解释层 · 把结果翻译成人话',
    points: [
      '竞品拆解发现：问真八字的护城河是「大运 / 流年 / 用神 / 五行旺衰」，本质是解释力',
      '加两层：每体系自己的解读（总览 + 关键指标 + 大运流年时间轴）+ 跨体系共识度仪表盘',
      '共识度 = 置信加权均值 + 同向一致率 + 分歧体系标注 —— 这是单体系产品做不到的',
    ],
  },
  {
    v: 'v3',
    title: '闭环 · 历史与导出',
    points: [
      '存完整 CalculateResult 而非只存种子：算法会演进，只存种子会导致旧记录重算后变形',
      '一键导出 Markdown / JSON，报告可复制、可带走、可事后重放',
    ],
  },
  {
    v: 'v4',
    title: '视觉与动效 · 玄学质感',
    points: [
      '墨底 + 暗金 + 宋体标题 + 星尘噪点，动效克制（入场、悬停、共识条）',
      '入场仪式：太极八卦缓转，点「启」而入',
    ],
  },
  {
    v: 'v5',
    title: '差异化与传播 · 凭什么不用 AI 直接问',
    points: [
      '八顾问合议英雄视图：八体系化作八位顾问环坐一圈，中央共识环 + 「异」字分歧徽，分歧本身就是信息（竞品全是平铺罗列，没有「合议」叙事）',
      '首屏价值主张正面回答「为什么不用 AI」：八体系交叉验证 / 确定性可溯源 / 全本地零隐私上传',
      '两步引导输入：生辰 → 所问之事，首次使用零门槛，手机端尤甚',
      '合议卡分享 + 只读链接：链接只携「生辰+问题+起卦种子」，对方浏览器同内核确定性重算、逐字一致 —— 零后端即可传播与回放',
      '修掉真 bug：页面「起卦数」此前从未接入塔罗，所有人抽到同一副牌；改为注入 config.tarot.seed，并加端到端确定性回放测试守护',
      '分歧辩论视图：自动挑出八家分歧最大的一轴，把「主张动/吉」与「主张静/凶」两派摊开各自判词——AI 揉碎成一段自信叙事，玄览偏把分歧演给你看',
      'PWA：manifest + Service Worker 让全站（含 1.2MB 算法内核）可安装、可离线，兑现「全本地零服务器」的隐私卖点',
      '测试升级：核心 42 + UI 20 = 62 项，覆盖决策轴全覆盖与确定性复现护栏',
    ],
  },
];

const SKILLS = [
  { area: '产品', items: '竞品拆解 · 需求取舍 · 路线图 · 诚实边界 · 免责与合规判断' },
  { area: '建模', items: '决策轴抽象 · 断言协议 · 共识聚合 · 可复现性设计（禁 IO/时间/随机）' },
  { area: '工程', items: 'TypeScript strict · 纯函数内核 · Vite/React · 分层与别名 · 扁平架构取舍' },
  { area: '质量', items: '黄金用例 · 对拍权威库 · 边界告警 · 62 项测试（内核 42 + UI 20）' },
  { area: '设计', items: '暗色设计系统 · 玄学视觉语言 · SVG 图形（太极/八卦）· 入场动效' },
  { area: '数据', items: 'configHash 溯源 · randomTrace 重放 · 快照不可变 · 结构化导出' },
];

/**
 * 项目故事页 —— 面向招聘官的案例展示。
 * 讲清楚：我解决什么问题、怎么想的、怎么迭代、做了哪些原型与取舍。
 */
export function CaseStudy({ onBack }: { onBack: () => void }) {
  return (
    <section className="case">
      <button className="link case-back" type="button" onClick={onBack}>
        ← 返回推演
      </button>

      <header className="case-hero">
        <div className="case-kicker">个人项目 · 产品设计 + 全栈实现</div>
        <h2>玄览 · 术数聚合平台</h2>
        <p className="case-lede">
          把八套互不兼容的术数体系，放进同一套可验证的工程框架里。
          <br />
          不是"又一个算命 App"，而是一次<b>「如何让不可验证的东西变得可解释」</b>的产品实验。
        </p>
      </header>

      <div className="case-section">
        <h3>一、我看到的问题</h3>
        <div className="case-cards">
          <div className="cc">
            <div className="cc-t">单体系，无法交叉验证</div>
            <p>八字是八字、塔罗是塔罗。没有人回答那个真问题：<b>它们结论打架时，我该信谁？</b></p>
          </div>
          <div className="cc">
            <div className="cc-t">黑盒，不敢信</div>
            <p>丢给你一串术语就结束了。依据是什么？换个时间再排会不会变？用户无从建立信任。</p>
          </div>
          <div className="cc">
            <div className="cc-t">不可复现，无法复盘</div>
            <p>没有种子、没有快照、没有配置指纹，算完即散，谈不上任何验证与迭代。</p>
          </div>
        </div>
      </div>

      <div className="case-section">
        <h3>二、三个关键设计决策</h3>

        <div className="decision">
          <div className="dec-n">01</div>
          <div>
            <h4>内核严肃，外壳科普</h4>
            <p>
              算法层严格按古籍规则确定性计算，<b>AI 绝不参与计算</b>；AI 只可能出现在下游做口语化解读，且默认关闭。
              前端负责把术语翻译成白话，并明确标注「命理预测之有效性尚无科学共识」。
            </p>
          </div>
        </div>

        <div className="decision">
          <div className="dec-n">02</div>
          <div>
            <h4>决策轴模型（本项目的核心建模）</h4>
            <p>
              不强行统一「五行 / 行星 / 牌义」这些互不相通的本体 —— 那既不可能也不必要。
              改为：让每个体系<b>用自己的原生语言判断</b>，只对外输出 6 条决策轴上的倾向值。
            </p>
            <p className="dec-hl">
              于是「八字身强，喜金水」和「塔罗抽到战车正位」第一次可以放在同一张表里比较。
            </p>
          </div>
        </div>

        <div className="axis-wrap">
          <AxisProjectionDiagram />
        </div>

        <div className="decision">
          <div className="dec-n">03</div>
          <div>
            <h4>可复现优先于一切</h4>
            <p>
              算法内核是纯函数：<b>禁 IO、禁 Date.now()、禁 Math.random()</b>。
              时间与随机数全部由调用方注入，配合 <code>configHash</code> 与 <code>randomTrace</code>，
              任何一次排盘都能被精确重放。
            </p>
          </div>
        </div>
      </div>

      <div className="case-section">
        <h3>三、迭代过程</h3>
        <ol className="timeline">
          {ITERATIONS.map((it) => (
            <li key={it.v}>
              <div className="tl-v">{it.v}</div>
              <div className="tl-body">
                <div className="tl-title">{it.title}</div>
                <ul>
                  {it.points.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <div className="case-section">
        <h3>四、架构与数据流</h3>
        <div className="flow">
          <div className="flow-node">输入（生辰 / 地点 / 所问之事）</div>
          <div className="flow-arrow">↓</div>
          <div className="flow-node">归一化（历法 · 时区 · 真太阳时 · 夏令时修正）</div>
          <div className="flow-arrow">↓</div>
          <div className="flow-node flow-multi">8 个 Adapter（各按古籍规则排盘，统一 ChartResult 协议）</div>
          <div className="flow-arrow">↓</div>
          <div className="flow-node">断言投影（原生结论 → 6 决策轴）</div>
          <div className="flow-arrow">↓</div>
          <div className="flow-node">共识聚合（加权均值 · 一致率 · 分歧标注）</div>
          <div className="flow-arrow">↓</div>
          <div className="flow-node">解释层（确定性生成，非 AI）</div>
          <div className="flow-arrow">↓</div>
          <div className="flow-node flow-out">共识仪表盘 · 综合报告 · 各体系卡（可展开溯源）</div>
        </div>
      </div>

      <div className="case-section">
        <h3>五、诚实边界（我认为这是加分项）</h3>
        <div className="case-cards">
          <div className="cc">
            <div className="cc-t">不装作支持</div>
            <p>星盘分宫制底层硬编码 Placidus 不可切换；紫微四化飞星 / 自化底层不支持；梅花易数仅开放时间卦 —— 全部在 UI 置灰说明。</p>
          </div>
          <div className="cc">
            <div className="cc-t">不宣称准确</div>
            <p>共识度是"体系间一致性"，不是预测概率。这句话在每处结论旁反复出现。</p>
          </div>
          <div className="cc">
            <div className="cc-t">不替用户下决定</div>
            <p>全局免责：不构成人生 / 医疗 / 法律 / 投资建议。命盘（长期趋势）与卜卦（当下信号）明确区分，不许混谈。</p>
          </div>
        </div>
        <p className="case-quote">
          产品经理最难的不是加功能，是克制地标注「这个我做不到」。
        </p>
      </div>

      <div className="case-section">
        <h3>六、能力矩阵</h3>
        <div className="skills">
          {SKILLS.map((s) => (
            <div className="skill" key={s.area}>
              <div className="skill-area">{s.area}</div>
              <div className="skill-items">{s.items}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="case-section">
        <h3>七、数字</h3>
        <div className="metrics">
          <div className="metric">
            <div className="m-v">8</div>
            <div className="m-l">术数体系并排</div>
          </div>
          <div className="metric">
            <div className="m-v">6</div>
            <div className="m-l">决策轴抽象</div>
          </div>
          <div className="metric">
            <div className="m-v">42</div>
            <div className="m-l">内核测试（含对拍 / 决策轴 / 确定性回放）</div>
          </div>
          <div className="metric">
            <div className="m-v">18</div>
            <div className="m-l">前端组件测试</div>
          </div>
          <div className="metric">
            <div className="m-v">0</div>
            <div className="m-l">AI 参与计算</div>
          </div>
        </div>
      </div>

      <footer className="case-foot">
        所有结果由开源术数算法确定性计算，仅供文化体验与学习，不构成任何人生建议。
      </footer>
    </section>
  );
}
