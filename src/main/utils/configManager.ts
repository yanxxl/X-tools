import fs from 'node:fs';
import path from 'node:path';
import {app} from 'electron';
import {Config} from "@shared/utils/config";

// 配置文件路径 - 使用Electron提供的平台特定用户数据目录
const CONFIG_DIR = app.getPath('userData');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

// 默认配置
const DEFAULT_CONFIG: Config = {
    recentFolders: []
};

/**
 * 确保配置目录存在
 */
function ensureConfigDir() {
    if (!fs.existsSync(CONFIG_DIR)) {
        fs.mkdirSync(CONFIG_DIR, {recursive: true});
    }
}

export function loadConfig(): Config {
    ensureConfigDir();

    try {
        if (fs.existsSync(CONFIG_FILE)) {
            const data = fs.readFileSync(CONFIG_FILE, 'utf8');
            const config = JSON.parse(data) as Config;
            return config;
        }
    } catch (error) {
        console.error('读取配置文件失败:', error);
    }

    // 如果读取失败或文件不存在，返回默认配置
    return DEFAULT_CONFIG;
}

export function saveConfig(config: Config): void {
    ensureConfigDir();
    // console.log('save config to file', config)
    try {
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
    } catch (error) {
        console.error('写入配置文件失败:', error);
    }
}