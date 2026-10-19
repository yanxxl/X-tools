/**
 * This file will automatically be loaded by vite and run in the "renderer" context.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import {Home} from './Home';
import {applyThemeMode, getInitialThemeMode} from './contexts/ThemeContext';

// 导入工具窗口初始化脚本（自动执行）
import './components/windows/initializeToolWindows';

// 在 React 挂载前先应用主题，避免首屏出现浅色闪烁
applyThemeMode(getInitialThemeMode());

// 创建根节点并渲染应用
const root = ReactDOM.createRoot(
  document.getElementById('root') || document.body
);

root.render(
  <React.StrictMode>
      <Home/>
  </React.StrictMode>
);

