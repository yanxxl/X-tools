// =======================================
// 类型定义
// =======================================

import { FileNode } from '../types';
import { getExtension, dirname, nameWithoutExtension, join, isVideoFile, isAudioFile } from './fileCommonUtil';

// =======================================
// 字幕文件相关功能
// =======================================

/**
 * 支持的字幕文件扩展名
 */
const SUBTITLE_EXTENSIONS = new Set([
  'srt', 'ass', 'ssa', 'sub', 'vtt'
]);

/**
 * 字幕时间行正则表达式
 * 匹配格式：时间 --> 时间（如 "00:01:30,000 --> 00:01:35,000"）
 */
const SUBTITLE_TIME_LINE_REGEX = /^(.*?) --> (.*?)$/;

/**
 * 判断是否为字幕文件
 * @param name 文件名或路径
 */
export function isSubtitleFile(name: string): boolean {
  const ext = getExtension(name);
  return SUBTITLE_EXTENSIONS.has(ext);
}

/**
 * 根据视频文件名查找对应的字幕文件
 * @param videoPath 视频文件路径
 * @returns 字幕文件路径数组
 */
export async function findSubtitleFiles(videoPath: string): Promise<string[]> {
  try {
    const videoDir = dirname(videoPath);
    const videoName = nameWithoutExtension(videoPath);
    
    // 项目仅在 Electron 环境下运行，直接使用 electronAPI
    const children = await window.electronAPI.getDirectoryChildren(videoDir);
    return children
      .filter((child: FileNode) => {
        // 只处理文件，不处理目录
        if (child.isDirectory) return false;
        
        const fileName = child.name;
        const fileExt = getExtension(fileName);
        
        // 检查是否为字幕文件
        if (!SUBTITLE_EXTENSIONS.has(fileExt)) return false;
        
        // 处理带有语言扩展的字幕文件（如 video.en.srt）
        const subtitleBaseName = nameWithoutExtension(fileName);
        
        // 情况1：完全匹配（video.srt）
        if (subtitleBaseName === videoName) return true;
        
        // 情况2：带有语言扩展（video.en.srt）
        return subtitleBaseName.startsWith(`${videoName}.`);
      })
      .map((child: FileNode) => join(videoDir, child.name));
  } catch (error) {
    console.error('查找字幕文件失败:', error);
    return [];
  }
}

/**
 * 根据字幕文件名查找对应的视频或音频文件
 * @param subtitlePath 字幕文件路径
 * @returns 视频或音频文件路径数组
 */
export async function findVideoFiles(subtitlePath: string): Promise<string[]> {
  try {
    const subtitleDir = dirname(subtitlePath);
    const subtitleName = nameWithoutExtension(subtitlePath);
    
    // 项目仅在 Electron 环境下运行，直接使用 electronAPI
    const children = await window.electronAPI.getDirectoryChildren(subtitleDir);
    return children
      .filter((child: FileNode) => {
        // 只处理文件，不处理目录
        if (child.isDirectory) return false;
        
        const fileName = child.name;
        
        // 检查是否为视频或音频文件
        if (!isVideoFile(fileName) && !isAudioFile(fileName)) return false;
        
        const videoBaseName = nameWithoutExtension(fileName);
        
        // 情况1：完全匹配（video.mp4 对应 video.srt）
        if (videoBaseName === subtitleName) return true;
        
        // 情况2：字幕文件带有语言扩展（video.en.srt 对应 video.mp4）
        // 检查字幕文件名是否以视频文件名开头
        return subtitleName.startsWith(`${videoBaseName}.`);
      })
      .map((child: FileNode) => join(subtitleDir, child.name));
  } catch (error) {
    console.error('查找视频文件失败:', error);
    return [];
  }
}

// =======================================
// 字幕解析功能
// =======================================

export interface SubtitleItem {
  /** 字幕序号 */
  index: number;
  /** 开始时间（秒） */
  startTime: number;
  /** 结束时间（秒） */
  endTime: number;
  /** 字幕文本 */
  text: string;
}

/**
 * 将字幕时间格式转换为秒
 * 支持格式：
 * - SRT: "00:01:30,123" (毫秒)
 * - VTT: "00:01:30.123" (毫秒)
 * - ASS/SSA: "0:01:30.12" (厘秒)
 * @param timeStr 时间格式字符串
 * @returns 转换后的秒数
 */
export function timeToSeconds(timeStr: string): number {
  // 替换逗号为点号，统一处理
  let normalizedTime = timeStr.replace(',', '.');
  
  // 处理无效的时间格式（如 00:00:55.6.0），只保留第一个点号
  normalizedTime = normalizedTime.replace(/^(.*?)\.(.*)$/, (match, beforeDot, afterDot) => {
    // 将点号后的所有内容合并，只保留一个点号
    return `${beforeDot}.${afterDot.replace(/\./g, '')}`;
  });
  
  // 匹配三种时间格式：
  // 1. 小时:分钟:秒.毫秒 (例如 01:23:45.678)
  // 2. 分钟:秒.毫秒 (例如 01:30.123)
  // 3. 秒.毫秒 (例如 51.052)
  let match = normalizedTime.match(/^(\d+):(\d+):(\d+)\.(\d+)$/);
  let hours = 0;
  let minutes = 0;
  let seconds: number;
  let fractionalPart: string;
  
  if (match) {
    // 格式：小时:分钟:秒.毫秒
    hours = parseInt(match[1], 10);
    minutes = parseInt(match[2], 10);
    seconds = parseInt(match[3], 10);
    fractionalPart = match[4];
  } else {
    // 尝试匹配 分钟:秒.毫秒 格式
    match = normalizedTime.match(/^(\d+):(\d+)\.(\d+)$/);
    if (match) {
      minutes = parseInt(match[1], 10);
      seconds = parseInt(match[2], 10);
      fractionalPart = match[3];
    } else {
      // 尝试匹配 秒.毫秒 格式
      match = normalizedTime.match(/^(\d+)\.(\d+)$/);
      if (!match) return 0;
      
      seconds = parseInt(match[1], 10);
      fractionalPart = match[2];
    }
  }
  
  // 根据小数部分的长度判断是毫秒还是厘秒
  let milliseconds = 0;
  if (fractionalPart.length === 3) {
    // 毫秒格式 (SRT/VTT)
    milliseconds = parseInt(fractionalPart, 10);
  } else if (fractionalPart.length === 2) {
    // 厘秒格式 (ASS/SSA)
    milliseconds = parseInt(fractionalPart, 10) * 10;
  } else {
    // 其他格式，直接转换
    milliseconds = parseInt(fractionalPart.padEnd(3, '0'), 10);
  }
  
  return hours * 3600 + minutes * 60 + seconds + milliseconds / 1000;
}

/**
 * 判断是否为字幕时间行
 * @param line 行内容
 * @returns 如果是字幕时间行返回 true，否则返回 false
 */
export function isSubtitleTimeLine(line: string): boolean {
  return SUBTITLE_TIME_LINE_REGEX.test(line);
}

/**
 * 从字幕行中提取时间范围
 * @param timeLine 时间行内容（如 "00:01:30,000 --> 00:01:35,000"）
 * @returns 包含开始时间和结束时间的对象，如果格式不匹配则返回 null
 */
export function extractTimeRange(timeLine: string): { startTime: number; endTime: number } | null {
  if (!isSubtitleTimeLine(timeLine)) return null;
  
  const timeMatch = timeLine.match(SUBTITLE_TIME_LINE_REGEX);
  if (!timeMatch) return null;
  
  const startTime = timeToSeconds(timeMatch[1]);
  const endTime = timeToSeconds(timeMatch[2]);
  
  return { startTime, endTime };
}

/**
 * 解析SRT格式的字幕文件
 * @param content 字幕文件内容
 * @returns 解析后的字幕数组
 */
export function parseSrtSubtitle(content: string): SubtitleItem[] {
  const subtitles: SubtitleItem[] = [];
  
  // 按空行分割字幕块
  const blocks = content.split(/\r?\n\r?\n/).filter(block => block.trim());
  
  blocks.forEach(block => {
    const lines = block.split(/\r?\n/).filter(line => line.trim());
    if (lines.length < 2) return;
    
    // 解析序号
    const index = parseInt(lines[0], 10);
    if (isNaN(index)) return;
    
    // 解析时间范围
    const timeRange = extractTimeRange(lines[1]);
    if (!timeRange) return;
    
    // 解析文本内容（可能多行）
    const text = lines.slice(2).join('\n').trim();
    
    subtitles.push({
      index,
      startTime: timeRange.startTime,
      endTime: timeRange.endTime,
      text
    });
  });
  
  // 按开始时间排序
  const sortedSubtitles = subtitles.sort((a, b) => a.startTime - b.startTime);
  
  // 重新分配连续的序号
  return sortedSubtitles.map((subtitle, index) => ({
    ...subtitle,
    index: index + 1
  }));
}

/**
 * 解析VTT格式的字幕文件
 * @param content 字幕文件内容
 * @returns 解析后的字幕数组
 */
export function parseVttSubtitle(content: string): SubtitleItem[] {
  const subtitles: SubtitleItem[] = [];
  
  // 移除VTT头部
  const contentWithoutHeader = content.replace(/^WEBVTT.*?\r?\n\r?\n/, '');
  
  // 按空行分割字幕块
  const blocks = contentWithoutHeader.split(/\r?\n\r?\n/).filter(block => block.trim());
  
  blocks.forEach((block, idx) => {
    const lines = block.split(/\r?\n/).filter(line => line.trim());
    if (lines.length < 2) return;
    
    let timeLineIndex = 0;
    // 跳过可选的序号或ID行
    if (!lines[0].includes('-->')) {
      timeLineIndex = 1;
    }
    
    // 解析时间范围，忽略时间后面的属性（如 align:start position:0%）
    const timeMatch = lines[timeLineIndex].match(/^(.*?) --> (.*?)(?:\s+|$)/);
    if (!timeMatch) return;
    
    // 提取时间部分，忽略时间后面的额外属性
    const startTimeStr = timeMatch[1].trim();
    const endTimeStr = timeMatch[2].trim().split(/\s+/)[0]; // 只取第一个空格前的部分作为时间
    
    const startTime = timeToSeconds(startTimeStr);
    const endTime = timeToSeconds(endTimeStr);
    
    // 解析文本内容（可能多行），移除内联时间标记和样式标签
    let text = lines.slice(timeLineIndex + 1).join('\n').trim();
    // 移除内联时间标记（如 <00:13:32.480>）
    text = text.replace(/<\d+:\d+:\d+\.\d+>/g, '');
    // 移除样式标签（如 <c> 和 </c>）
    text = text.replace(/<\/?[a-z]+>/g, '');
    
    subtitles.push({
      index: idx + 1,
      startTime,
      endTime,
      text
    });
  });
  
  // 按开始时间排序
  const sortedSubtitles = subtitles.sort((a, b) => a.startTime - b.startTime);
  
  // 重新分配连续的序号
  return sortedSubtitles.map((subtitle, index) => ({
    ...subtitle,
    index: index + 1
  }));
}

/**
 * 解析ASS/SSA格式的字幕文件（基础支持）
 * @param content 字幕文件内容
 * @returns 解析后的字幕数组
 */
export function parseAssSubtitle(content: string): SubtitleItem[] {
  const subtitles: SubtitleItem[] = [];
  
  // 提取Dialogue行
  const dialogueLines: string[] = content.match(/Dialogue:.*?$/gm) || [];
  
  dialogueLines.forEach((line, idx) => {
    // 分割Dialogue行（使用逗号分隔，注意转义的逗号）
    // 由于 TypeScript 不支持原生负向回顾断言，这里手动拆分并保留转义逗号
    const parts: string[] = [];
    let lastIndex = 0;
    for (let i = 0; i < line.length; i++) {
      if (line[i] === ',' && (i === 0 || line[i - 1] !== '\\')) {
        parts.push(line.slice(lastIndex, i));
        lastIndex = i + 1;
      }
    }
    
    if (lastIndex <= line.length) {
      parts.push(line.slice(lastIndex));
    }
    if (parts.length < 10) return;
    
    // 获取开始和结束时间（格式：h:mm:ss.ms）
    const startTimeStr = parts[1];
    const endTimeStr = parts[2];
    
    const startTime = timeToSeconds(startTimeStr);
    const endTime = timeToSeconds(endTimeStr);
    
    // 获取文本内容（去除样式标签）
    let text = parts.slice(9).join(',').trim();
    // 移除ASS样式标签
    text = text.replace(/\{[^}]*\}/g, '');
    // 替换转义字符
    text = text.replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\N/g, '\n').replace(/\\,/g, ',');
    
    subtitles.push({
      index: idx + 1,
      startTime,
      endTime,
      text
    });
  });
  
  // 按开始时间排序
  const sortedSubtitles = subtitles.sort((a, b) => a.startTime - b.startTime);
  
  // 重新分配连续的序号
  return sortedSubtitles.map((subtitle, index) => ({
    ...subtitle,
    index: index + 1
  }));
}

/**
 * 解析SUB格式的字幕文件（基础支持，只支持MicroDVD格式）
 * @param content 字幕文件内容
 * @returns 解析后的字幕数组
 */
export function parseSubSubtitle(content: string): SubtitleItem[] {
  const subtitles: SubtitleItem[] = [];
  
  const FPS = 25; // 假设标准帧率
  const lines = content.split(/\r?\n/).filter(line => line.trim());
  
  let currentSubtitle: SubtitleItem | null = null;
  let index = 1;
  
  for (const line of lines) {
    const timeMatch = line.match(/^\{(\d+)\}\{(\d+)\}(.*)$/);
    
    if (timeMatch) {
      // 保存当前字幕（如果存在）
      if (currentSubtitle) {
        currentSubtitle.text = currentSubtitle.text.trim();
        subtitles.push(currentSubtitle);
      }
      
      // 开始新的字幕
      const startFrame = parseInt(timeMatch[1], 10);
      const endFrame = parseInt(timeMatch[2], 10);
      const initialText = timeMatch[3].trim();
      
      currentSubtitle = {
        index,
        startTime: startFrame / FPS,
        endTime: endFrame / FPS,
        text: initialText
      };
      
      index++;
    } else if (currentSubtitle) {
      // 继续当前字幕的文本
      currentSubtitle.text += '\n' + line;
    }
  }
  
  // 保存最后一个字幕
  if (currentSubtitle) {
    currentSubtitle.text = currentSubtitle.text.trim();
    subtitles.push(currentSubtitle);
  }
  
  // 按开始时间排序
  const sortedSubtitles = subtitles.sort((a, b) => a.startTime - b.startTime);
  
  // 重新分配连续的序号
  return sortedSubtitles.map((subtitle, index) => ({
    ...subtitle,
    index: index + 1
  }));
}

/**
 * 读取并解析字幕文件
 * @param subtitlePath 字幕文件路径
 * @returns 解析后的字幕数组
 */
export async function loadAndParseSubtitle(subtitlePath: string): Promise<SubtitleItem[]> {
  try {
    // 项目仅在 Electron 环境下运行，直接使用 electronAPI
    const content = await window.electronAPI.readFile(subtitlePath);
    
    const ext = getExtension(subtitlePath).toLowerCase();
    
    switch (ext) {
      case 'srt':
        return parseSrtSubtitle(content);
      case 'vtt':
        return parseVttSubtitle(content);
      case 'ass':
      case 'ssa':
        return parseAssSubtitle(content);
      case 'sub':
        return parseSubSubtitle(content);
      case 'txt': {
        // 尝试用多种格式解析txt文件
        let subtitles = parseSrtSubtitle(content);
        if (subtitles.length === 0) {
          subtitles = parseVttSubtitle(content);
        }
        if (subtitles.length === 0) {
          subtitles = parseAssSubtitle(content);
        }
        if (subtitles.length === 0) {
          subtitles = parseSubSubtitle(content);
        }
        return subtitles;
      }
      default:
        console.warn(`不支持的字幕格式: ${ext}`);
        return [];
    }
  } catch (error) {
    console.error('读取或解析字幕文件失败:', error);
    return [];
  }
}

/**
 * 根据当前播放时间获取对应的字幕
 * @param subtitles 字幕数组
 * @param currentTime 当前播放时间（秒）
 * @returns 当前时间对应的字幕
 */
export function getCurrentSubtitle(subtitles: SubtitleItem[], currentTime: number): SubtitleItem | null {
  return subtitles.find(sub => {
    return currentTime >= sub.startTime && currentTime <= sub.endTime;
  }) || null;
}
