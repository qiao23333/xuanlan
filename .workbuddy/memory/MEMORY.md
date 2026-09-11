# 玄览 (Xuanlan) · 项目长期记忆

## 项目本质
术数聚合平台（Vite + React + TS，纯前端、无后端、全本地计算）。八大体系：八字/紫微/奇门/大六壬/小六壬/梅花/西洋占星/塔罗。核心差异化「八顾问合议 + 分歧辩论 + 确定性可复现可溯源」。定位作品集 + 开源(GitHub 1162393961@qq.com) + 展示视频 + 商业化。

## 环境工作流（沙箱必读，每次先读）
- **node 调用**：`npm` 报 `Could not determine Node.js install directory`。改用绝对路径：
  `NODE="/c/Users/11623/.workbuddy/binaries/node/versions/22.22.2-2/node.exe"`
  驱动：`"$NODE" node_modules/typescript/bin/tsc --noEmit -p tsconfig.json` /
  `"$NODE" node_modules/vite/bin/vite.js build` /
  `"$NODE" node_modules/vitest/vitest.mjs run src` /
  `"$NODE" --experimental-strip-types --test packages/core/test/*.test.ts`
- **build**：`rm -rf node_modules/.vite .vite dist` 后首跑易 `esbuild ENOMEM` 崩溃 → 重跑一次即过。
- **core 测试**：首跑可能只 21 项且 5 失败（type-strip 预热），重跑即 42/42。稳定结论以复现计。
- **UI 测试**：`vitest` 用 `--pool=forks`（默认 threads 偶发 tinypool 崩溃）。
- **预览**：vite dev 在沙箱崩；用 `/tmp/serve.mjs` 静态伺服 dist:8080。agent-browser Chromium 下载因内存失败 → 无法自动截图，靠用户实时预览 + 代码核查。

## 产品迭代阶段（已交付）
- v5.1 质感地基（令牌/玻璃拟态/宋体），v5.2 八体系独立视觉身份（sigil+accent，`src/systemIdentity.tsx`），v5.3 动效仪式感（keyframes + 合议装配 + 共识环生长 + reduced-motion 降级）。下一步 v6 内容深度 + 出街 Checklist。

## 关键文件
- `src/systemIdentity.tsx` 八体系席纹/配色；`src/councilData.ts` buildAdvisors/leanColor；`src/AdvisoryCouncil.tsx` 八顾问合议；`src/DissentView.tsx` 分歧辩论；`src/ShareCard.tsx`+`share.ts` 分享卡/回放；`玄览-产品规划方案v2.md` 完整产品规划。
- 勿动 `D:\codex\个人`（SnapSort 项目，用户明令禁止修改）。

## 已知约束
- 唯一可移植性待评估：公司产出的「合规卫士」、为前老板剪的视频能否入作品集（离职争议中，未签合同未缴社保）。
