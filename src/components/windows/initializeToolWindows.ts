/**
 * 工具窗口初始化脚本
 * 只注册文件信息工具窗口
 */

import { toolWindowManager } from './toolWindowManager';
import { fileInfoToolWindow } from './FileInfoToolWindow';

/**
 * 初始化并注册文件信息工具窗口
 * 这个函数只需要在应用启动时调用一次
 */
export const initializeToolWindows = () => {
    // 注册文件信息工具窗口
    toolWindowManager.register(fileInfoToolWindow);
    
    console.log('文件信息工具窗口已注册');
    
    return {
        fileInfoWindow: fileInfoToolWindow
    };
};

// 自动执行初始化
initializeToolWindows();