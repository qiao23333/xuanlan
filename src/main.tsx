import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
import './mobile.css';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// 注册 Service Worker：让产品可安装、可离线（仅生产构建，开发态不干扰 HMR）。
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      /* 注册失败不影响主流程 */
    });
  });
}
