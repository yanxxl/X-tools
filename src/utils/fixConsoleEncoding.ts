import iconv from 'iconv-lite';
import { spawnSync } from 'child_process';

export function fixWindowsConsoleEncoding() {
    if (process.platform !== 'win32') {
        return;
    }

    try {
        spawnSync('chcp', ['65001'], { stdio: 'inherit' });
    } catch (error) {
        console.error('设置控制台编码失败:', error);
    }

    const originalLog = console.log;
    const originalError = console.error;

    console.log = function (...args: any[]) {
        if (process.platform === 'win32') {
            const message = args.map(arg => {
                if (typeof arg === 'object') {
                    return JSON.stringify(arg, null, 2);
                }
                return String(arg);
            }).join(' ');

            process.stdout.write(iconv.encode(message + '\n', 'gbk'));
        } else {
            originalLog.apply(console, args);
        }
    };

    console.error = function (...args: any[]) {
        if (process.platform === 'win32') {
            const message = args.map(arg => {
                if (typeof arg === 'object') {
                    return JSON.stringify(arg, null, 2);
                }
                return String(arg);
            }).join(' ');

            process.stderr.write(iconv.encode(message + '\n', 'gbk'));
        } else {
            originalError.apply(console, args);
        }
    };
}
