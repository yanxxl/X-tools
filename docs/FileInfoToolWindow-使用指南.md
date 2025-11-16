# 文件基本信息工具窗口 - 使用指南

## 🎯 任务完成总结

✅ **已成功创建文件基本信息工具窗口**，包含以下功能：

1. **独立的组件文件** - `/src/components/FileInfoToolWindow.tsx`
2. **完整的工具窗口实现** - 包含面板组件、图标、工厂函数
3. **导出的窗口实例** - `fileInfoToolWindow` 可直接使用
4. **系统集成** - 已集成到工具窗口管理器
5. **测试和验证** - 提供完整的测试页面和验证脚本

## 📁 创建的文件

| 文件路径 | 描述 |
|---------|------|
| `src/components/FileInfoToolWindow.tsx` | 主要的工具窗口组件文件 |
| `src/components/FileInfoTest.tsx` | 测试组件，提供功能验证 |
| `src/pages/FileInfoDemo.tsx` | 独立演示页面 |
| `src/pages/FileInfoIntegrationTest.tsx` | 完整的集成测试页面 |
| `src/utils/FileInfoToolWindowValidation.ts` | 验证脚本 |
| `docs/FileInfoToolWindow-README.md` | 详细文档 |

## 🚀 快速开始

### 1. 导入工具窗口

```typescript
import { fileInfoToolWindow } from './components/windows/FileInfoToolWindow';
```

### 2. 直接使用（已集成到系统）

工具窗口已经集成到 `ToolWindowInitializer.tsx` 中，应用启动时会自动注册。

### 3. 手动注册（如果需要）

```typescript
import { toolWindowManager } from './components/windows/toolWindowManager';
import { fileInfoToolWindow } from './components/windows/FileInfoToolWindow';

// 注册到管理器
toolWindowManager.register(fileInfoToolWindow);
```

## 🎮 使用方法

### 程序化控制

```typescript
// 获取工具窗口实例
const fileInfoWindow = toolWindowManager.get('file-info');

// 显示窗口
fileInfoWindow?.show();

// 隐藏窗口
fileInfoWindow?.hide();

// 切换显示状态
fileInfoWindow?.toggle();
```

### 快捷键

- **`Ctrl+Shift+I`** - 快速切换文件信息工具窗口显示状态

### 界面操作

1. 在文件浏览器中选择任意文件或文件夹
2. 文件信息工具窗口会自动显示选中项的详细信息
3. 支持复制文件路径、查看文件属性等功能

## 📊 显示的信息

### 基本信息
- 📁 **文件名** - 显示文件或文件夹的名称
- 🏷️ **文件类型** - 自动识别并用颜色标签显示
- 📂 **完整路径** - 支持一键复制

### 时间信息
- 📅 **修改时间** - 最后修改日期和时间
- 🏗️ **创建时间** - 文件创建日期和时间
- 👁️ **访问时间** - 最后访问日期和时间

### 属性信息
- 📏 **文件大小** - 格式化显示（如 1.5 MB）
- 📄 **扩展名** - 文件扩展名（仅文件）
- 📋 **包含项目数** - 子文件和文件夹数量（仅文件夹）

## 🧪 测试和验证

### 运行测试页面

在应用中导航到测试页面来验证功能：

1. **基础测试页面** - `FileInfoDemo.tsx`
2. **集成测试页面** - `FileInfoIntegrationTest.tsx`

### 验证脚本

```typescript
import { runFileInfoToolWindowValidation } from 'src/tests/FileInfoToolWindowValidation';
```
// 运行完整验证
const isValid = runFileInfoToolWindowValidation();
console.log('验证结果:', isValid);
```

## 🔧 技术特性

- **React 18+** - 使用现代 React Hooks
- **Ant Design 5+** - 美观的 UI 组件
- **TypeScript** - 完整的类型安全
- **Electron API** - 原生文件系统访问
- **响应式设计** - 适配不同窗口大小
- **错误处理** - 完善的异常处理机制

## 🎨 界面预览

工具窗口采用卡片式设计，包含：
- 清晰的信息分组
- 颜色编码的文件类型标签
- 一键复制路径功能
- 加载和错误状态提示
- 友好的空状态提示

## ⚡ 性能优化

- **懒加载** - 组件按需加载
- **缓存机制** - 文件信息智能缓存
- **防抖处理** - 避免频繁的文件系统调用
- **内存管理** - 及时清理不需要的数据

## 🔮 扩展建议

如果需要进一步扩展功能，可以考虑：

1. **文件预览** - 添加图片、文本等文件预览
2. **批量操作** - 支持多选文件信息查看
3. **历史记录** - 记录查看过的文件信息
4. **导出功能** - 导出文件信息为 CSV/JSON
5. **自定义字段** - 允许用户自定义显示的信息字段

## 📝 注意事项

1. **Electron 环境** - 需要在 Electron 环境下才能获取完整文件信息
2. **权限要求** - 确保应用有访问目标文件/文件夹的权限
3. **性能考虑** - 大型文件夹可能需要额外时间获取子项目数量
4. **路径格式** - 支持不同操作系统的路径格式

---

🎉 **恭喜！** 文件基本信息工具窗口已经成功创建并集成到您的应用中。现在您可以在应用中享受便捷的文件信息查看功能了！