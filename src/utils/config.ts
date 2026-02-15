import { RecentFolder } from '../types';
import { basename } from './fileCommonUtil';

// 配置类型定义
export interface Config {
    recentFolders: RecentFolder[];
}

export function updateFolderPath(config: Config, folderPath: string): Config {

    removeFolderPath(config, folderPath);

    config.recentFolders.unshift({
        path: folderPath,
        name: basename(folderPath),
        timestamp: Date.now(),
    });

    // 限制数量，只保留最近的10个
    if (config.recentFolders.length > 10) {
        config.recentFolders = config.recentFolders.slice(0, 10);
    }
    return {...config}
}

export function removeFolderPath(config: Config, folderPath: string): Config {
    // 找到并更新recentFolders中的对应文件夹
    const folderIndex = config.recentFolders.findIndex(folder => folder.path === folderPath);
    if (folderIndex !== -1) {
        config.recentFolders.splice(folderIndex, 1);
    }
    return {...config}
}