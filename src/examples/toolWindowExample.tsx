import React from 'react';
import { ToolWindow } from '../types/toolWindow';

// 示例React组件
const FileExplorerPanel: React.FC = () => {
    return (
        <div className="file-explorer-panel">
            <h3>文件浏览器</h3>
            <p>这里显示文件树结构</p>
        </div>
    );
};

const PropertiesPanel: React.FC = () => {
    return (
        <div className="properties-panel">
            <h3>属性面板</h3>
            <p>这里显示选中项的属性</p>
        </div>
    );
};

const SearchPanel: React.FC = () => {
    return (
        <div className="search-panel">
            <h3>搜索面板</h3>
            <p>这里显示搜索功能</p>
        </div>
    );
};

/**
 * 创建预定义的工具窗口
 */
export const createToolWindows = (): ToolWindow[] => {
    return [
        new ToolWindow({
            id: 'file-explorer',
            name: '文件浏览器',
            description: '浏览和管理文件系统',
            isVisible: true,
            view: <FileExplorerPanel />,
            icon: 'folder',
            shortcut: 'Ctrl+Shift+E',
            defaultWidth: 300,
            defaultHeight: 400
        }),
        new ToolWindow({
            id: 'properties',
            name: '属性',
            description: '显示选中文件或文件夹的属性',
            isVisible: false,
            view: <PropertiesPanel />,
            icon: 'info',
            shortcut: 'Ctrl+Shift+P',
            defaultWidth: 250,
            defaultHeight: 300
        }),
        new ToolWindow({
            id: 'search',
            name: '搜索',
            description: '搜索文件和内容',
            isVisible: false,
            view: <SearchPanel />,
            icon: 'search',
            shortcut: 'Ctrl+Shift+F',
            defaultWidth: 350,
            defaultHeight: 200
        })
    ];
};

/**
 * 使用示例
 */
export const exampleUsage = () => {
    // 创建工具窗口
    const toolWindows = createToolWindows();
    
    // 获取文件浏览器窗口
    const fileExplorer = toolWindows.find(w => w.id === 'file-explorer');
    
    if (fileExplorer) {
        console.log(`工具窗口名称: ${fileExplorer.name}`);
        console.log(`工具窗口描述: ${fileExplorer.description}`);
        console.log(`是否可见: ${fileExplorer.isVisible}`);
        
        // 切换可见性
        fileExplorer.toggle();
        console.log(`切换后是否可见: ${fileExplorer.isVisible}`);
        
        // 显示窗口
        fileExplorer.show();
        console.log(`显示后是否可见: ${fileExplorer.isVisible}`);
    }
    
    return toolWindows;
};