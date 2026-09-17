#!/usr/bin/env node
/**
 * 图片体积台账 + 门禁 —— 「全站图片从 X 降到 Y」这句话必须能当场算出来。
 *
 * 为什么需要它：本项目已经栽过三次「手写数字悄悄漂」（前端用例数、术语条数、
 * 覆盖率），每次都是文案里的数字看着挺合理、但产物早就不是那个数了。
 * 这一次轮到图片体积：更新日志里写着「5.2MB → 0.65MB（省 87%）」，
 * 而实际把两幅山水背景也转 WebP 之后（2026-09-17 那次）是 5.55MB → 931KB（省 83.6%）。
 * 数字不重新算，就永远是错的；而人眼扫不出来。
 *
 * 为什么原始体积要**固化常量**而不是从 git 现取：
 *   tools/img-optimize.py --clean 会删掉原图，之后磁盘上再也量不到；
 *   走 git 历史则在 CI 里不可靠（actions/checkout 默认浅克隆，没有历史）。
 *   所以这里是「转换那一刻从 git 历史量得」的一次性记录，不再变动。
 *
 * 用法：
 *   node tools/img-weight.mjs           # 只打印台账
 *   node tools/img-weight.mjs --check   # 顺带校验 src/changelog.ts 里的数字（对不上 exit 1）
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

/**
 * 转换前的原始素材体积（字节），量自 git 历史。
 * 键 = 转换前的文件路径；原图已被 --clean 删除，只能靠这张表追溯。
 * 注意：public/icons/system/<主题>/sys-0X.png 那 16 个是更早一版命名，早已下线，
 * **不计入** —— 把它们算进来会把"原图总量"虚增 1.5MB，省幅虚高到 84.7%。
 */
const BASELINE = {
  'src/assets/taiji-dark.png': 2128501,
  'src/assets/taiji-light.png': 1877248,
  'src/assets/bg-scene-dark.jpg': 261583,
  'src/assets/bg-scene-light.jpg': 223892,
  'public/icons/system/dark/astrolabe.png': 97001,
  'public/icons/system/dark/bazi.png': 89525,
  'public/icons/system/dark/liuren.png': 80591,
  'public/icons/system/dark/meihua.png': 48408,
  'public/icons/system/dark/qimen.png': 56810,
  'public/icons/system/dark/tarot.png': 108730,
  'public/icons/system/dark/xiaoliuren.png': 110198,
  'public/icons/system/dark/ziwei.png': 95016,
  'public/icons/system/light/astrolabe.png': 95854,
  'public/icons/system/light/bazi.png': 73543,
  'public/icons/system/light/liuren.png': 82419,
  'public/icons/system/light/meihua.png': 46874,
  'public/icons/system/light/qimen.png': 56571,
  'public/icons/system/light/tarot.png': 82446,
  'public/icons/system/light/xiaoliuren.png': 104760,
  'public/icons/system/light/ziwei.png': 99096,
};

const CATEGORY = [
  ['太极图', (p) => p.includes('taiji')],
  ['体系图标', (p) => p.includes('/icons/')],
  ['背景山水', (p) => p.includes('bg-scene')],
];

/** 现在磁盘上真正会被打包/部署的位图（WebP） */
function currentFiles() {
  const out = [];
  for (const dir of ['src/assets']) {
    for (const f of fs.readdirSync(path.join(ROOT, dir))) {
      if (f.endsWith('.webp')) out.push(`${dir}/${f}`);
    }
  }
  const sysDir = path.join(ROOT, 'public/icons/system');
  for (const theme of fs.readdirSync(sysDir)) {
    const d = path.join(sysDir, theme);
    if (!fs.statSync(d).isDirectory()) continue;
    for (const f of fs.readdirSync(d)) {
      if (f.endsWith('.webp')) out.push(`public/icons/system/${theme}/${f}`);
    }
  }
  return out.sort();
}

const catOf = (p) => CATEGORY.find(([, hit]) => hit(p))?.[0] ?? '其他';

const orig = {};
for (const [p, s] of Object.entries(BASELINE)) orig[catOf(p)] = (orig[catOf(p)] ?? 0) + s;
const files = currentFiles();
const cur = {};
for (const p of files) cur[catOf(p)] = (cur[catOf(p)] ?? 0) + fs.statSync(path.join(ROOT, p)).size;

const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);
const O = sum(orig);
const C = sum(cur);
const mb = (n) => `${(n / 1024 / 1024).toFixed(2)}MB`;
const kb = (n) => `${Math.round(n / 1024)}KB`;
const pct = (n) => `${n.toFixed(1)}%`;
const saved = (1 - C / O) * 100;

console.log('类别        原图        现文件      文件数');
for (const [name] of CATEGORY) {
  const n = files.filter((p) => catOf(p) === name).length;
  console.log(
    `${name.padEnd(10)}${mb(orig[name] ?? 0).padStart(9)}${kb(cur[name] ?? 0).padStart(12)}${String(n).padStart(9)}`,
  );
}
console.log(`合计        ${mb(O).padStart(9)}${kb(C).padStart(12)}  省 ${pct(saved)}`);

if (!process.argv.includes('--check')) process.exit(0);

const failures = [];

// 1) 不许再混进位图原图 —— 有了原图就意味着有人绕开了 img-optimize.py
const strays = [];
for (const root of ['src/assets', 'public/icons']) {
  const walk = (d) => {
    for (const e of fs.readdirSync(path.join(ROOT, d), { withFileTypes: true })) {
      const rel = `${d}/${e.name}`;
      if (e.isDirectory()) walk(rel);
      else if (/\.(png|jpe?g)$/i.test(e.name)) strays.push(rel);
    }
  };
  walk(root);
}
if (strays.length) {
  failures.push(
    `又混进了 ${strays.length} 个位图原图（应全部是 .webp）：${strays.slice(0, 5).join('、')}`
    + '；跑 node tools/img-optimize.py（或 python tools/img-optimize.py）重转',
  );
}

// 2) 更新日志里那句体积话，数字必须是算出来的
const changelog = read('src/changelog.ts');
/* 只认**最新一条**更新日志（数组约定最新在前）。
   历史条目里的数字是"当时是这样"，拿今天的产物去校验它，等于逼着人把历史改成现在
   —— 那不是校验，是篡改。实测踩点：0.4.1 写着 931KB，本轮把背景图再压一档后
   总量变 859KB，若全文件一起校验，就会要求回头去改 0.4.1 那句实话。 */
const firstBlock = (() => {
  const start = changelog.indexOf('{', changelog.indexOf('RELEASES'));
  if (start < 0) return '';
  let depth = 0;
  for (let j = start; j < changelog.length; j++) {
    if (changelog[j] === '{') depth++;
    else if (changelog[j] === '}' && --depth === 0) return changelog.slice(start, j + 1);
  }
  return '';
})();
const claim = /全站图片\s*([\d.]+)\s*MB\s*→\s*(\d+)\s*KB（省\s*([\d.]+)%）/g;
const hits = [...firstBlock.matchAll(claim)];
if (!hits.length) {
  failures.push('最新一条更新日志里找不到「全站图片 X MB → Y KB（省 Z%）」的表述 —— 是被删了还是改了措辞？'
    + '（台账这一行约定放在**最新**那条里；历史条目保留当时的数字，不参与校验）');
}
for (const m of hits) {
  const want = [Number((O / 1024 / 1024).toFixed(2)), Math.round(C / 1024), Number(saved.toFixed(1))];
  const got = [Number(m[1]), Number(m[2]), Number(m[3])];
  got.forEach((g, i) => {
    if (g !== want[i]) {
      failures.push(`src/changelog.ts：图片体积第 ${i + 1} 个数字是 ${g}，实际 ${want[i]}（片段：${m[0]}）`);
    }
  });
}

if (failures.length) {
  console.error(`\n❌ 图片体积台账不一致（${failures.length} 处）：`);
  for (const f of failures) console.error('  - ' + f);
  console.error('\n修法：把文案改成上面的实际值，或先跑 img-optimize.py 再决定要不要改文案。');
  process.exit(1);
}
console.log('✅ 图片体积文案与磁盘产物一致');
