import log from 'electron-log';
import { app } from 'electron';
import path from 'path';
import fs from 'fs';

// 配置日志 - 使用 electron-log 5.4.3 最新 API
export function configureLogger(): void {
  // 设置日志文件路径 - 总是放在用户目录下的 .x-tools/logs
  const userHome = process.env.HOME || process.env.USERPROFILE || process.env.HOMEPATH;
  const logPath = path.join(userHome, '.x-tools', 'logs');
  
  // 确保日志目录存在
  if (!fs.existsSync(logPath)) {
    fs.mkdirSync(logPath, { recursive: true });
  }

  // 配置文件传输 - 使用最新的 resolvePathFn API
  log.transports.file.resolvePathFn = () => {
    return path.join(logPath, 'main.log');
  };

  // 设置日志级别
  log.transports.file.level = app.isPackaged ? 'info' : 'debug';
  
  // 打包后完全禁用控制台输出，避免闪现命令窗口
  if (app.isPackaged) {
    log.transports.console.level = false; // 完全禁用控制台输出
  } else {
    log.transports.console.level = 'debug'; // 开发环境显示所有日志
  }

  // 配置日志文件大小限制和轮转
  log.transports.file.maxSize = 10 * 1024 * 1024; // 10MB

  // 增强的格式化配置
  log.transports.file.format = '{y}-{m}-{d} {h}:{i}:{s}.{ms} [{level}] {text}';
  log.transports.console.format = '{h}:{i}:{s}.{ms} [{level}] {text}';

  // 记录启动信息
  log.info('应用程序启动 - 使用 electron-log 5.4.3', {
    version: app.getVersion(),
    platform: process.platform,
    arch: process.arch,
    nodeVersion: process.version,
    electronVersion: process.versions.electron,
    logPath: logPath,
    isPackaged: app.isPackaged,
    electronLogVersion: '5.4.3'
  });
}

// 创建作用域日志器
// export function createScopedLogger(scope: string) {
//   return log.scope(scope);
// }

// 导出配置好的日志实例
export default log;