/**
 * 工具窗口初始化脚本
 * 注册文件信息、文件访问历史、设置和字典工具窗口
 */

import {toolWindowManager} from './toolWindowManager';
import {fileInfoToolWindow} from './FileInfoToolWindow';
import {fileHistoryToolWindow} from './FileHistoryToolWindow';
import {settingsToolWindow} from './SettingsToolWindow';
import {dictionaryToolWindow} from './DictionaryToolWindow';

/**
 * 初始化并注册所有工具窗口
 * 这个函数只需要在应用启动时调用一次
 */
export const initializeToolWindows = () => {
    // 注册文件信息工具窗口
    toolWindowManager.register(fileInfoToolWindow);
    
    // 注册文件访问历史工具窗口
    toolWindowManager.register(fileHistoryToolWindow);   
    
    // 注册字典工具窗口
    toolWindowManager.register(dictionaryToolWindow);
    
    // 注册设置工具窗口
    toolWindowManager.register(settingsToolWindow);
    
    return {
        fileInfoWindow: fileInfoToolWindow,
        fileHistoryWindow: fileHistoryToolWindow,
        dictionaryWindow: dictionaryToolWindow,
        settingsWindow: settingsToolWindow,
    };
};

// 自动执行初始化
initializeToolWindows();