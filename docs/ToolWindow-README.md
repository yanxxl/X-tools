# ToolWindow 类使用指南

## 概述

`ToolWindow` 类是一个用于管理应用中工具窗口面板的基础类。它提供了完整的工具窗口生命周期管理，包括显示、隐藏、切换状态等功能。

## 主要特性

- **唯一标识符**: 每个工具窗口都有唯一的 ID
- **可见性控制**: 支持显示、隐藏和切换状态
- **React 组件集成**: 支持传入 React 函数组件作为视图
- **丰富的配置选项**: 支持图标、快捷键、默认尺寸等配置
- **序列化支持**: 支持 JSON 序列化和反序列化
- **克隆功能**: 支持创建工具窗口的副本

## 基本用法

### 创建工具窗口

```typescript
import { ToolWindow } from './types/toolWindow';
import React from 'react';

const MyPanel: React.FC = () => {
    return <div>我的面板内容</div>;
};

const toolWindow = new ToolWindow({
    id: 'my-panel',
    name: '我的面板',
    description: '这是一个示例面板',
    isVisible: false,
    view: <MyPanel />,
    icon: 'panel-icon',
    shortcut: 'Ctrl+Shift+M',
    defaultWidth: 300,
    defaultHeight: 400
});
```

### 使用工具窗口管理器

```typescript
import { toolWindowManager } from './utils/toolWindowManager';

// 注册工具窗口
toolWindowManager.register(toolWindow);

// 显示工具窗口
toolWindowManager.show('my-panel');

// 隐藏工具窗口
toolWindowManager.hide('my-panel');

// 切换可见性
toolWindowManager.toggle('my-panel');

// 获取所有可见的工具窗口
const visibleWindows = toolWindowManager.getVisible();
```

## API 参考

### ToolWindow 构造函数选项

| 属性 | 类型 | 必需 | 默认值 | 描述 |
|------|------|------|--------|------|
| `id` | `string` | ✓ | - | 工具窗口唯一标识符 |
| `name` | `string` | ✓ | - | 工具窗口名称 |
| `description` | `string` | ✓ | - | 工具窗口描述 |
| `isVisible` | `boolean` | ✗ | `false` | 是否可见 |
| `view` | `ReactNode` | ✓ | - | React 组件视图 |
| `icon` | `string` | ✗ | - | 图标名称或路径 |
| `shortcut` | `string` | ✗ | - | 快捷键 |
| `isResizable` | `boolean` | ✗ | `true` | 是否可调整大小 |
| `defaultWidth` | `number` | ✗ | - | 默认宽度 |
| `defaultHeight` | `number` | ✗ | - | 默认高度 |

### ToolWindow 实例方法

- `show()`: 显示工具窗口
- `hide()`: 隐藏工具窗口
- `toggle()`: 切换工具窗口可见性
- `clone()`: 克隆工具窗口
- `toJSON()`: 转换为 JSON 对象

### ToolWindowManager 接口

- `register(toolWindow)`: 注册工具窗口
- `unregister(id)`: 注销工具窗口
- `get(id)`: 获取指定 ID 的工具窗口
- `getAll()`: 获取所有工具窗口
- `show(id)`: 显示指定工具窗口
- `hide(id)`: 隐藏指定工具窗口
- `toggle(id)`: 切换指定工具窗口可见性
- `getVisible()`: 获取所有可见的工具窗口

## 示例项目

在 `src/examples/toolWindowExample.tsx` 中提供了完整的使用示例，包括：

- 创建多个工具窗口
- 使用管理器进行批量操作
- React 组件集成示例

## 注意事项

1. **唯一 ID**: 确保每个工具窗口的 ID 是唯一的
2. **React 组件**: view 属性必须是有效的 ReactNode
3. **内存管理**: 使用完毕后记得调用 `unregister` 清理不需要的工具窗口
4. **类型安全**: 充分利用 TypeScript 的类型检查功能

## 扩展

你可以基于 `ToolWindow` 类创建更具体的工具窗口子类，例如：

```typescript
class FileExplorerWindow extends ToolWindow {
    constructor(rootPath: string) {
        super({
            id: 'file-explorer',
            name: '文件浏览器',
            description: `浏览 ${rootPath}`,
            isVisible: true,
            view: <FileExplorerView rootPath={rootPath} />
        });
    }
    
    refresh() {
        // 刷新文件列表逻辑
    }
}
```