/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// 内核位于 packages/core/src，使用 .ts 扩展名（Node 原生 style）。
// Vite/esbuild 原生支持带 .ts 扩展名的导入，无需额外插件。
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@core': fileURLToPath(new URL('./packages/core/src/index.ts', import.meta.url)),
    },
  },
  server: {
    host: true,
    port: 5173,
  },
  // 线上托管（workbuddy sites）通过反向代理访问，且只暴露一个 $PORT：
  // preview 必须监听 $PORT 并放行代理域名，否则会被 Vite 的 host 检查拦掉。
  preview: {
    host: true,
    port: Number(process.env.PORT) || 4173,
    strictPort: true,
    allowedHosts: true,
  },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1500,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    // 显式锁定 forks 池，规避 tinypool/threads 在 Windows + Node 22 下
    // 偶发的 "Worker exited unexpectedly" 原生崩溃（V8 在 worker 退出时崩）。
    pool: 'forks',
    poolOptions: {
      forks: {
        // 单 fork 复用进程，避免反复 spawn/teardown worker 触发崩溃。
        singleFork: true,
        execArgv: ['--max-old-space-size=2048'],
      },
    },
    teardownTimeout: 20000,
  },
});
