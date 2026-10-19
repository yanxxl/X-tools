import fs from 'node:fs';
import chardet from 'chardet';
import iconv from 'iconv-lite';

/**
 * 编码检测采样大小（字节）
 * 编码检测不需要全量扫描，几 MB 的文件全量检测会明显拖慢读取速度
 */
export const ENCODING_SAMPLE_SIZE = 64 * 1024;

/**
 * 检测文件编码（只取前 64KB 采样）
 * @param buffer 文件内容
 */
export function detectEncoding(buffer: Buffer): string | null {
    const sample = buffer.length > ENCODING_SAMPLE_SIZE ? buffer.subarray(0, ENCODING_SAMPLE_SIZE) : buffer;
    return chardet.detect(sample);
}

/**
 * 按检测到的编码把 buffer 解码为字符串
 * @param buffer 文件内容
 * @param encoding 已检测到的编码
 */
export function decodeBuffer(buffer: Buffer, encoding?: string | null): string {
    if (encoding && iconv.encodingExists(encoding)) {
        return iconv.decode(buffer, encoding);
    }

    try {
        return buffer.toString('utf-8');
    } catch (e) {
        // utf-8 解码失败时回退到 gbk
        return iconv.decode(buffer, 'gbk');
    }
}

/**
 * 读取文本文件并自动按编码解码为字符串
 * 该实现不依赖界面环境，可在主进程线程池中使用
 * @param filePath 文件路径
 */
export async function readTextFile(filePath: string): Promise<string> {
    const buffer = await fs.promises.readFile(filePath);
    return decodeBuffer(buffer, detectEncoding(buffer));
}
