#!/usr/bin/env node
/**
 * 文档数字门禁 —— 「手写的数量」必须与代码实际一致，对不上就让 CI 红。
 *
 * 为什么需要它：本项目反复出现同一类毛病——README / 注释里手写的
 * 「内核 42 项」「前端 24 项」「术语 38 条」随着代码增长悄悄漂了，
 * 而且是人眼扫不出来的（数字看着都合理）。凡是能从产物自动算的，就别手写。
 *
 * 覆盖：
 *   1. 内核用例数（packages/core/test/*.test.ts 里 test( 的个数）
 *   2. 前端用例数（src/*.test.ts(x) 里 it(/test( 的个数）
 *   3. 术语条数（src/glossary.ts 顶层键个数）
 *
 * 用法：node tools/check-docs.mjs   （对不上 exit 1）
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

/** 内核用例数：node:test 用 test('...') */
function countCoreTests() {
  const dir = path.join(ROOT, 'packages/core/test');
  let n = 0;
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.test.ts'))) {
    n += (read(`packages/core/test/${f}`).match(/(^|[^A-Za-z])test\(/g) || []).length;
  }
  return n;
}

/** 前端用例数：vitest 用 it(/test( */
function countUiTests() {
  const dir = path.join(ROOT, 'src');
  let n = 0;
  for (const f of fs.readdirSync(dir).filter((f) => /\.test\.tsx?$/.test(f))) {
    n += (read(`src/${f}`).match(/(^|[^A-Za-z])(it|test)\(/g) || []).length;
  }
  return n;
}

/** 术语条数：src/glossary.ts 里形如 `  词条: {` 的顶层键 */
function countGlossary() {
  return (read('src/glossary.ts').match(/^  [^ ].*: \{$/gm) || []).length;
}

const core = countCoreTests();
const ui = countUiTests();
const terms = countGlossary();

const failures = [];

/**
 * 断言：text 里所有匹配 regex 的「数字组」都等于 expectedArr 中对应的期望值。
 *
 * 两点讲究：
 *  1. 逐个检查，而不是只确认「正确值出现过一次」——否则同一文件里
 *     写对一处、写错一处也能蒙混过关。
 *  2. 正则要能吃到同一句话的所有变体：`内核 49 项` / `内核测试（49 项` /
 *     `内核回归测试（49 项` 都要覆盖，不然改了一处漏一处。
 */
function assertGroups(text, regex, expectedArr, label, file) {
  const hits = [...text.matchAll(regex)];
  if (hits.length === 0) {
    failures.push(`${file}：找不到「${label}」的表述（正则 ${regex}）—— 是被删了还是改了措辞？`);
    return;
  }
  for (const m of hits) {
    for (let i = 1; i < m.length; i++) {
      const got = Number(m[i]);
      const exp = expectedArr[i - 1];
      if (got !== exp) {
        failures.push(`${file}：${label} 第 ${i} 个数字是 ${got}，实际 ${exp}（片段：${m[0].trim()}）`);
      }
    }
  }
}

// ---- README ----
const readme = read('README.md');
assertGroups(readme, /内核[^0-9\n]{0,12}(\d+)\s*项/g, [core], '内核用例数', 'README.md');
assertGroups(readme, /前端[^0-9\n]{0,12}(\d+)\s*项/g, [ui], '前端用例数', 'README.md');
assertGroups(readme, /内核\s*(\d+)\s*\+\s*前端\s*(\d+)\s*=\s*(\d+)\s*项/g, [core, ui, core + ui], '用例分布', 'README.md');
assertGroups(readme, /=\s*(\d+)\s*项/g, [core + ui], '用例总数', 'README.md');
assertGroups(readme, /术语词典[（(]\s*(\d+)\s*条/g, [terms], '术语条数', 'README.md');
assertGroups(readme, /术语词典扩至\s*(\d+)\s*条/g, [terms], '术语条数（路线图）', 'README.md');

// ---- glossary.ts 自身注释 ----
assertGroups(read('src/glossary.ts'), /共\s*(\d+)\s*条/g, [terms], '术语条数', 'src/glossary.ts');

// ---- 汇总 ----
console.log(`实际值：内核 ${core} 项 / 前端 ${ui} 项 / 合计 ${core + ui} 项 / 术语 ${terms} 条`);
if (failures.length) {
  console.error(`\n❌ 文档数字与代码不一致（${failures.length} 处）：`);
  for (const f of failures) console.error('  - ' + f);
  console.error('\n修法：把上面这些数字改成「实际值」，或让文案从产物自动算。');
  process.exit(1);
}
console.log('✅ 文档数字与代码一致');
