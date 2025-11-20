/**
 * 工具窗口初始化脚本
 * 注册文件信息和文件访问历史工具窗口
 */

import { toolWindowManager } from './toolWindowManager';
import { fileInfoToolWindow } from './FileInfoToolWindow';
import { fileHistoryToolWindow } from './FileHistoryToolWindow';

/**
 * 初始化并注册所有工具窗口
 * 这个函数只需要在应用启动时调用一次
 */
export const initializeToolWindows = () => {
    // 注册文件信息工具窗口
    toolWindowManager.register(fileInfoToolWindow);
    
    // 注册文件访问历史工具窗口
    toolWindowManager.register(fileHistoryToolWindow);
    
    return {
        fileInfoWindow: fileInfoToolWindow,
        fileHistoryWindow: fileHistoryToolWindow
    };
};

// 自动执行初始化
initializeToolWindows();