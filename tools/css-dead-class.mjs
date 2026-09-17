/**
 * 死类清单 + 清理器：CSS 里定义、但源码里永远不会出现的类名。
 *
 * 为什么需要它：css-coverage.mjs 是**浏览器跑出来的**（"这个选择器匹配到元素了吗"），
 * 本工具是**纯静态读代码**（"这个类名在源码里存在吗"）。两条路径互相独立，
 * 只有两边都指向同一批类名，才敢说它们真的死了。
 * 静态这条还能看见覆盖率看不见的：类名在 JSX 里有、但元素在某种状态才渲染。
 *
 * ⚠️ 五个必须避开的坑（前两个是第一版真实踩到的，都产生过错误的死类清单）：
 *
 * ① **绝对不要对整份 CSS 用正则剥字符串。** 本项目的样式表里有内联 data-URI SVG，
 *    内容是 `url("data:image/svg+xml,<svg … fill='url(%23n)'/>")` —— 双引号里套单引号。
 *    拿 `'[^']*'` 去全局剥字符串，会从这个游离的单引号一直吃到下一个单引号，
 *    **把中间几百条真选择器整段删掉**。实测后果：定义类名从 948 掉到 330，
 *    `.landing-title` / `.tl-title` / `.nav-spacer` 这些真类名凭空消失，死类清单漏报一大半。
 *    → 正确做法：**只在"选择器位置"抽类名**（`{` 之前那段），根本不用碰声明体。
 *
 * ② **注释会连进选择器里。** 扫描器跳过注释时不推进 segStart，于是规则前的注释
 *    会跟着选择器一起被切进来（形如 注释紧贴在 .l2-bg-mist 前面）。不剥的话注释里
 *    提到的文件名/类名（.mjs、.l2-fl-）会被当成"定义过的类名"混进清单。
 *
 * ③ **子串误命中**。`chk` 是 `f2-chk` 的子串。必须用词边界
 *    `(?<![\w-])名字(?![\w-])`。反过来裸 `chk` 匹配不到 `f2-chk` 才是对的。
 *
 * ④ **模板字面量拼出来的类名**。源码写的是 `` `warn-${w.level}` ``、`` `tag-${tone}` ``、
 *    `` `xlr-${j.tone}` ``、`` `syn-${a.direction}` ``、`` `cat-${meta.category}` ``，
 *    完整类名 `warn-info` / `tag-gold` / `xlr-good` / `syn-positive` / `cat-chart`
 *    在源码里**一次都不出现**，但它们是活的。必须先抽 `前缀-${` 模式，命中前缀算活。
 *    （实测：不做这步，"源码里找不到"的有 125 个；做了之后只剩 22 个 ——
 *      103 个都是动态拼的，差点被误删。）
 *
 * ⑤ **混合规则不能整条删**。`.chip, .so-cat, … { }` 里 `.so-cat` 死了、`.chip` 还活着，
 *    整条删会把活样式一起带走。所以按**选择器**（逗号分段）为单位判断，逐段摘除。
 *
 * 用法：
 *   node tools/css-dead-class.mjs                 # 只报告
 *   node tools/css-dead-class.mjs --prune         # 就地删掉死规则/死选择器（会改源文件）
 *   node tools/css-dead-class.mjs --check         # 门禁：可清理体积超预算就退出码 1
 *   node tools/css-dead-class.mjs --css <路径>     # 指定某份 CSS（比如构建产物）
 *   OUT=.probe/dead.json ...
 */
import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';

/* 门禁预算：清理干净后应接近 0。留 3.5KB 余量是为了不把"正在开发中的新样式"卡死，
   但足以拦住"又一整代旧界面留在包里"这种量级的回归（本轮清理前是 16.5KB）。 */
const BUDGET_BYTES = 3500;

const args = process.argv.slice(2);
const cssArg = args.includes('--css') ? args[args.indexOf('--css') + 1] : null;
const PRUNE = args.includes('--prune');
const CHECK = args.includes('--check');
const OUT = process.env.OUT || '';

const collect = (dir, re, out = []) => {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) collect(p, re, out);
    else if (re.test(p)) out.push(p);
  }
  return out;
};

const cssFiles = cssArg ? [cssArg] : collect('src', /\.css$/);
if (!cssFiles.length) throw new Error('没找到任何 CSS 文件');
const perFile = cssFiles.map((f) => ({ f, text: readFileSync(f, 'utf8') }));
const fileText = new Map(perFile.map((p) => [p.f, p.text]));
const cssBytes = perFile.reduce((s, p) => s + Buffer.byteLength(p.text, 'utf8'), 0);

/* ---------- 结构切分：跳过注释与字符串（后者保证 data-URI 里的 {} ; 不破坏结构） ----------
   ⚠️ `seg`（段起点）必须在**遇到 `{` 的那一刻**连同选择器一起压栈保存。
   早先的写法是在 `}` 处读当时的 segStart —— 那时 segStart 已经被 `{` 改成"规则体的起点"了，
   于是 seg 指向的是声明体的开头。后果：删一条死规则变成"删掉声明体、留下 `选择器 {`"，
   149 条删完 css 里全是悬空的 `{`（实测残留形如 `@media (…) { .landing-title {`）。
   这类错误编译器不一定报，靠肉眼看 diff 也容易漏 —— 只有像素比对/构建产物校验才抓得到。 */
const scan = (text) => {
  const rules = [];
  const stack = [];
  let segStart = 0, i = 0;
  const n = text.length;
  while (i < n) {
    const c = text[i];
    if (c === '/' && text[i + 1] === '*') { const e = text.indexOf('*/', i + 2); i = e < 0 ? n : e + 2; continue; }
    if (c === '"' || c === "'") { const q = c; i++; while (i < n && text[i] !== q) { if (text[i] === '\\') i++; i++; } i++; continue; }
    if (c === '{') {
      const seg = text.slice(segStart, i);
      const lead = (seg.match(/^[\s;]*/) || [''])[0].length;
      const selStart = segStart + lead;
      const sel = text.slice(selStart, i).trim();
      stack.push({ sel, selStart, selEnd: i, seg: segStart, isAt: sel.startsWith('@') });
      segStart = i + 1; i++; continue;
    }
    if (c === '}') {
      const open = stack.pop();
      if (open && !open.isAt) rules.push({ selStart: open.selStart, selEnd: open.selEnd, end: i + 1, seg: open.seg, sel: open.sel, parents: stack.map((s) => s.sel) });
      segStart = i + 1; i++; continue;
    }
    i++;
  }
  return rules;
};

/* ---------- 类名只从选择器抽（①②：不碰声明体，就碰不到 url 和数据 URI） ---------- */
const cleanSel = (sel) => sel.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\s+/g, ' ').trim();
const classesOf = (sel) => [...cleanSel(sel).replace(/"[^"]*"|'[^']*'/g, '').matchAll(/\.(-?[A-Za-z_][\w-]*)/g)].map((m) => m[1]);

const rules = perFile.flatMap((p) => scan(p.text).map((r) => ({ ...r, file: p.f })));
const defined = new Set();
for (const r of rules) for (const c of classesOf(r.sel)) defined.add(c);

/* ---------- 源码侧：字面量 + 模板前缀（③④） ---------- */
const srcText = collect('src', /\.(tsx|ts)$/).concat(['index.html']).map((f) => readFileSync(f, 'utf8')).join('\n');
const PREFIXES = new Set();
for (const tf of srcText.matchAll(/`[^`]*`/g)) for (const m of tf[0].matchAll(/([\w-]+-)\$\{/g)) PREFIXES.add(m[1]);
for (const m of srcText.matchAll(/(['"])([\w-]+-)\1\s*\+/g)) PREFIXES.add(m[2]);

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const alive = [], dead = [];
for (const c of defined) {
  if (new RegExp(`(?<![\\w-])${esc(c)}(?![\\w-])`).test(srcText)) alive.push(c);
  else if ([...PREFIXES].some((p) => c.startsWith(p))) alive.push(c);
  else dead.push(c);
}
const deadSet = new Set(dead);

/* ---------- 选择器分段（顶层逗号，尊重括号/引号） ---------- */
const splitTopLevel = (selText) => {
  const parts = [];
  let depth = 0, start = 0, i = 0;
  const n = selText.length;
  while (i < n) {
    const c = selText[i];
    if (c === '/' && selText[i + 1] === '*') { const e = selText.indexOf('*/', i + 2); i = e < 0 ? n : e + 2; continue; }
    if (c === '"' || c === "'") { const q = c; i++; while (i < n && selText[i] !== q) { if (selText[i] === '\\') i++; i++; } i++; continue; }
    if (c === '(' || c === '[') depth++;
    else if (c === ')' || c === ']') depth--;
    else if (c === ',' && depth === 0) { parts.push({ text: selText.slice(start, i), start, end: i }); start = i + 1; }
    i++;
  }
  parts.push({ text: selText.slice(start), start, end: n });
  return parts;
};

/* ---------- 判定一段选择器能不能匹配到东西 ----------
   `:not(...)` 里的类名是"必须**不**存在"，不能算作"必须存在"：
   `.a:not(.b)` 在 .b 恰好不存在时**恰恰是活的**，把它当"含死类名"删掉就删错了。先整段摘掉。
   （目前样式表里的 :not() 只用到 .is-landing / .active / :disabled / :focus-visible，都活着；
     但判定逻辑必须对"以后 .b 真的被删掉"这种情况也成立。） */
const stripNot = (s) => {
  let out = '', i = 0;
  while (i < s.length) {
    if (s.startsWith(':not(', i)) {
      let d = 0, j = i + 4;
      for (; j < s.length; j++) { if (s[j] === '(') d++; else if (s[j] === ')') { d--; if (!d) { j++; break; } } }
      i = j; continue;
    }
    out += s[i++];
  }
  return out;
};
/* 一段选择器要能匹配，段里**每个**类名都得在某个元素上真实出现过；
   所以只要有一个是死的，这一段就永远匹配不到。注意是 `some` 不是 `every` ——
   `.detail-section .sub` 里 `.sub` 活着，但祖先 `.detail-section` 不存在于任何元素上，
   整段照样匹配不到（实测有 8 条这种规则，用 every 会全部漏掉）。 */
const isDeadPart = (p) => { const cs = classesOf(stripNot(p.text)); return cs.length > 0 && cs.some((c) => deadSet.has(c)); };

/* ---------- 上面这套推断的地基：类名只能来自字面量或 `前缀-${}` 模板 ----------
   若有人开始写 `className={xxx}`（裸变量）或 `classList.add(dynamic)`，
   "源码里找不到 ⇒ 不会被应用"就不成立了，工具会开始**误判并误删**。
   检出这种写法就报警 —— 一个地基不成立的门禁比没有门禁更危险。 */
const RISK = [
  { re: /className=\{\s*[A-Za-z_$][\w$]*\s*\}/, why: 'className 直接给裸变量' },
  { re: /classList\.(?:add|remove|toggle)\(\s*[A-Za-z_$]/, why: 'classList 直接给变量' },
  { re: /className=\{`\$\{/, why: 'className 模板里只有变量、没有固定前缀' },
];
const risks = [];
for (const f of collect('src', /\.(tsx|ts)$/)) {
  const t = readFileSync(f, 'utf8');
  for (const { re, why } of RISK) if (re.test(t)) risks.push(`${f}：${why}`);
}

/* ---------- 逐规则判断：整段死 / 部分段死 ---------- */
let prunableBytes = 0;
const wholeDead = [], partialDead = [];
for (const r of rules) {
  const bytes = Buffer.byteLength(fileText.get(r.file).slice(r.selStart, r.end), 'utf8');
  const parts = splitTopLevel(r.sel);
  const bad = parts.filter(isDeadPart);
  if (!bad.length) continue;
  const ok = parts.filter((p) => !isDeadPart(p));
  prunableBytes += bytes;   // 整段死算全部；部分死按整条算（实际只摘选择器，这算是上界）
  const inMedia = r.parents.some((p) => cleanSel(p).startsWith('@media'));
  if (!ok.length) wholeDead.push({ ...r, bytes, inMedia });
  else partialDead.push({ file: r.file, sel: cleanSel(r.sel).slice(0, 92), bytes, inMedia, drop: bad.map((p) => cleanSel(p.text)), keep: ok.map((p) => cleanSel(p.text).slice(0, 26)) });
}

/* ---------- 报告 ---------- */
console.log(`样式来源：${cssFiles.join('、')}  ${(cssBytes / 1024).toFixed(1)}KB（源文件口径，含注释）`);
console.log(`规则 ${rules.length} 条；定义类名 ${defined.size} 个 → 存活 ${alive.length}、死 ${dead.length}（${((dead.length / defined.size) * 100).toFixed(1)}%）`);
console.log(`动态前缀 ${PREFIXES.size} 个：${[...PREFIXES].join(' ')}`);
console.log(`\n可整条删除 ${wholeDead.length} 条 ${(wholeDead.reduce((s, r) => s + r.bytes, 0) / 1024).toFixed(1)}KB；` +
  `只需摘选择器 ${partialDead.length} 条 ${(partialDead.reduce((s, r) => s + r.bytes, 0) / 1024).toFixed(1)}KB`);
console.log(`可清理体积合计（上界）${(prunableBytes / 1024).toFixed(1)}KB / ${(cssBytes / 1024).toFixed(1)}KB`);

const byNs = new Map();
for (const r of wholeDead) {
  const m = (classesOf(r.sel)[0] || '').match(/^([a-z]+\d*)-/);   // 允许数字：.l2-* / .f2-* 是主力命名空间
  const ns = m ? m[1] : '(无前缀)';
  byNs.set(ns, (byNs.get(ns) || 0) + r.bytes);
}
console.log(`\n按命名空间（整条可删部分）：`);
for (const [ns, b] of [...byNs.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${(b / 1024).toFixed(1).padStart(6)}KB  ${ns}`);

console.log(`\n体量最大的 15 条"整条可删"：`);
for (const r of [...wholeDead].sort((a, b) => b.bytes - a.bytes).slice(0, 15)) {
  console.log(`  ${String(r.bytes).padStart(5)}B ${r.inMedia ? '[media]' : '       '} ${cleanSel(r.sel).slice(0, 80)}`);
}
if (partialDead.length) {
  console.log(`\n只需摘选择器（别整条删）：`);
  for (const r of partialDead.sort((a, b) => b.bytes - a.bytes).slice(0, 10)) {
    console.log(`  ${String(r.bytes).padStart(5)}B  摘[${r.drop.join(', ')}]  留[${r.keep.join(', ')}]`);
  }
}
console.log(`\n死类名全清单（${dead.length}）：`);
console.log('  ' + dead.join(', '));

if (risks.length) {
  console.log(`\n⚠️ 检测到 ${risks.length} 处"类名可能来自运行时变量"的写法，本工具的前提（源码里找不到 ⇒ 不会被应用）不再成立：`);
  for (const x of risks) console.log(`    ${x}`);
  console.log(`    请把类名写成字面量或 \`前缀-\${值}\` 模板，否则死类判定会误删活样式。`);
}

/* ---------- 就地清理 ---------- */
if (PRUNE) {
  let removedRules = 0, removedParts = 0;
  for (const { f } of perFile) {
    let text = fileText.get(f);
    const local = rules.filter((r) => r.file === f);
    // 收集要删的区间（每条规则至多一处），最后按位置从后往前施加
    const cuts = [];
    for (const r of local) {
      const parts = splitTopLevel(r.sel);
      const bad = parts.filter(isDeadPart);
      if (!bad.length) continue;
      if (bad.length === parts.length) {
        // 整条删：从 seg 开始（连规则前的注释和空行一起带走），保留文件头注释
        let s = r.seg;
        if (s === 0) { const m = text.match(/^\s*(\/\*[\s\S]*?\*\/\s*)?/); s = m ? m[0].length : r.selStart; }
        cuts.push({ a: s, b: r.end, repl: '' });
        removedRules++;
      } else {
        /* 摘选择器：**整条选择器一次替换掉**，不要逐段删偏移。
           逐段删踩过两个坑，任何一个都会让规则静默失效（CSS 里选择器列表只要有一个
           非法项，整条规则就被丢弃）：
             ① 各段区间可能重叠：`P1, P2, P3` 删 P2 与 P3 时，P2 的"尾逗号"落在 P3 的
                删除区间内，按原偏移先后施加就把文本切坏了 —— 实测把
                `.l2-bg::before, .l2-bg-mist, .l2-bg-overlay{display:none}` 切成
                `.l2-bg::before,{display:none}`：**一个尾逗号让整条规则失效**，
                于是 `.l2-bg::before` 不再被隐藏、盖住了落地页背景（像素比对当场抓到）。
             ② 即使区间不重叠，删掉末尾那些段之后，前一段的尾逗号还在，同样是非法选择器。
           所以这里按"保留段"重建选择器，整条替换，一条规则只产生一处 cut。 */
        const keep = parts.filter((p) => !isDeadPart(p));
        cuts.push({ a: r.selStart, b: r.selEnd, repl: keep.map((p) => p.text.trim()).join(',\n') });
        removedParts++;
      }
    }
    cuts.sort((x, y) => y.a - x.a);
    for (const { a, b, repl } of cuts) text = text.slice(0, a) + repl + text.slice(b);
    // 清掉被掏空的 @media 块（可能嵌套，循环到稳定）
    let guard = 0;
    for (;;) {
      const next = text.replace(/@media[^{]*\{\s*\}/g, '');
      if (next === text || ++guard > 12) break;
      text = next;
    }
    text = text.replace(/\n{3,}/g, '\n\n');
    // 自检：只允许"变短"、花括号必须仍然配平，且不能出现悬空逗号。
    // 悬空逗号（`, {` / `{ ,`）会让**整条规则**被浏览器丢弃，而 CSS 解析器不会报错、
    // 肉眼扫 diff 也极易放过 —— 实测就是它把落地页背景盖掉了，靠像素比对才发现。
    const bal = (s) => { let d = 0; for (const ch of s) { if (ch === '{') d++; else if (ch === '}') d--; } return d; };
    const before = bal(fileText.get(f)), after = bal(text);
    if (Buffer.byteLength(text, 'utf8') > Buffer.byteLength(fileText.get(f), 'utf8')) throw new Error(`${f}: --prune 后反而变长了，拒绝写入`);
    if (after !== before) throw new Error(`${f}: 花括号不平衡（${before} → ${after}），拒绝写入 —— 清理逻辑有 bug`);
    const dangling = text.match(/,\s*\{|\{\s*,/g);
    if (dangling) throw new Error(`${f}: --prune 后出现悬空逗号（${[...new Set(dangling)].join(' ')}），拒绝写入 —— 会让整条规则失效`);
    writeFileSync(f, text);
    const saved = Buffer.byteLength(fileText.get(f), 'utf8') - Buffer.byteLength(text, 'utf8');
    console.log(`  ${f}：删 ${local.length ? '' : ''}${(saved / 1024).toFixed(1)}KB`);
  }
  console.log(`\n--prune 完成：整条删 ${removedRules} 条、摘选择器 ${removedParts} 段。请重跑一次确认剩余为 0。`);
}

/* ---------- 门禁 ---------- */
if (CHECK) {
  // 前提不成立时门禁必须红：一个地基不对却报"✓"的门禁比没有门禁更危险。
  if (risks.length) {
    console.error(`\n✗ CSS 死类判定的前提不成立（存在运行时构造的类名），请先按上面的提示改回字面量/固定前缀模板`);
    process.exit(1);
  }
  if (prunableBytes > BUDGET_BYTES) {
    console.error(`\n✗ CSS 死代码超预算：${(prunableBytes / 1024).toFixed(1)}KB > 预算 ${(BUDGET_BYTES / 1024).toFixed(1)}KB`);
    console.error(`  跑 \`node tools/css-dead-class.mjs --prune\` 清理，或确认这些类名是否真的废弃。`);
    process.exit(1);
  }
  console.log(`\n✓ CSS 死代码在预算内：${(prunableBytes / 1024).toFixed(1)}KB ≤ ${(BUDGET_BYTES / 1024).toFixed(1)}KB`);
}

if (OUT) {
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify({ cssFiles, defined: [...defined], dead, prefixes: [...PREFIXES], wholeDead, partialDead }, null, 1));
  console.log(`\n清单已写入 ${OUT}`);
}
