# 文件基本信息工具窗口

## 概述

文件基本信息工具窗口是一个用于显示选中文件或文件夹详细信息的 React 组件。它集成了 Electron 的文件系统 API，可以实时获取并显示文件的各项属性。

## 功能特性

- 📁 **支持文件和文件夹**：自动识别并显示不同类型的信息
- 🏷️ **文件类型识别**：根据扩展名自动分类并用颜色标签显示
- 📊 **详细信息展示**：包括文件大小、修改时间、创建时间、访问时间等
- 🔄 **实时更新**：当选中不同文件时自动更新显示内容
- 🎨 **美观界面**：使用 Ant Design 组件库，界面简洁美观
- ⌨️ **快捷键支持**：支持 `Ctrl+Shift+I` 快捷键切换显示状态

## 使用方法

### 1. 导入工具窗口

```typescript
import { fileInfoToolWindow } from './components/FileInfoToolWindow';
```

### 2. 注册到工具窗口管理器

```typescript
import { toolWindowManager } from './utils/toolWindowManager';

// 注册工具窗口
toolWindowManager.register(fileInfoToolWindow);
```

### 3. 或者使用初始化脚本

```typescript
// 工具窗口会在应用启动时自动注册
// 初始化脚本位于: src/scripts/initializeToolWindows.ts
```

### 4. 程序化控制

```typescript
// 获取工具窗口实例
const fileInfoWindow = toolWindowManager.get('file-info');

// 显示工具窗口
fileInfoWindow?.show();

// 隐藏工具窗口
fileInfoWindow?.hide();

// 切换显示状态
fileInfoWindow?.toggle();
```

## 组件结构

### FileInfoPanel

主要的 React 组件，负责显示文件信息：

- **状态管理**：使用 `useState` 和 `useEffect` 管理文件信息状态
- **Context 集成**：通过 `useAppContext` 获取当前选中的文件/文件夹
- **API 调用**：通过 `window.electronAPI.getFileInfo()` 获取文件信息
- **UI 渲染**：使用 Ant Design 的 Card、Descriptions 等组件展示信息

### 显示的信息包括

1. **基本信息**
   - 文件名
   - 文件类型（带颜色标签）
   - 完整路径（支持复制）

2. **时间信息**
   - 修改时间
   - 创建时间  
   - 访问时间

3. **属性信息**
   - 文件大小（格式化显示）
   - 扩展名（文件）
   - 包含项目数（文件夹）

## 样式和布局

- 使用 Ant Design 的 Card 组件作为容器
- Descriptions 组件展示键值对信息
- 响应式设计，支持不同窗口大小
- 滚动条优化，适合长路径显示

## 错误处理

- **加载状态**：显示 Spin 组件提示正在加载
- **错误状态**：显示 Alert 组件提示错误信息
- **空状态**：未选中文件时显示友好的提示信息

## 扩展性

组件设计具有良好的扩展性：

1. **自定义图标**：可以通过修改 `FileInfoIcon` 组件更改图标
2. **快捷键配置**：通过 `shortcut` 属性修改快捷键
3. **默认尺寸**：通过 `defaultWidth` 和 `defaultHeight` 调整窗口大小
4. **信息扩展**：可以轻松添加更多文件属性显示

## 依赖项

- React 18+
- Ant Design 5+
- Electron API
- 项目内部的工具函数（format.ts, fileType.ts）

## 示例代码

完整的使用示例可以参考 `src/pages/FileInfoDemo.tsx` 和 `src/pages/FileInfoIntegrationTest.tsx` 文件。

## 注意事项

1. 需要在 Electron 环境下运行才能获取完整的文件信息
2. 浏览器环境下会显示相应的提示信息
3. 文件路径复制功能需要现代浏览器支持
4. 大型文件夹可能需要一些时间来获取子项目数量