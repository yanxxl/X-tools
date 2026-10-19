import { describe, it, expect, beforeEach } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import {
  parseSrtSubtitle,
  parseVttSubtitle,
  parseAssSubtitle,
  parseSubSubtitle
} from '../../src/renderer/utils/subtitleUtil';

// 测试数据目录
const testDir = __dirname;

// 读取测试文件内容
function readTestFile(filename: string): string {
  const filePath = path.join(testDir, filename);
  return fs.readFileSync(filePath, 'utf8');
}

describe('subtitleUtil.ts 字幕解析功能测试', () => {
  // 测试数据
  let srtContent: string;
  let vttContent: string;
  let assContent: string;
  let subContent: string;

  beforeEach(() => {
    // 读取所有测试文件内容
    srtContent = readTestFile('test.srt');
    vttContent = readTestFile('test.vtt');
    assContent = readTestFile('test.ass');
    subContent = readTestFile('test.sub');
  });

  describe('SRT字幕解析', () => {
    it('应该正确解析SRT格式的字幕', () => {
      const subtitles = parseSrtSubtitle(srtContent);

      // 验证字幕数量
      expect(subtitles.length).toBe(3);

      // 验证第一条字幕
      expect(subtitles[0]).toEqual({
        index: 1,
        startTime: 1.000,
        endTime: 5.000,
        text: '这是SRT格式的第一行字幕\n这是第二行'
      });

      // 验证第二条字幕
      expect(subtitles[1]).toEqual({
        index: 2,
        startTime: 6.000,
        endTime: 10.000,
        text: '测试字幕解析功能\nSRT格式测试'
      });

      // 验证第三条字幕
      expect(subtitles[2]).toEqual({
        index: 3,
        startTime: 11.500,
        endTime: 15.750,
        text: '包含特殊字符：!@#$%^&*()\n支持多行文本'
      });
    });
  });

  describe('VTT字幕解析', () => {
    it('应该正确解析VTT格式的字幕', () => {
      const subtitles = parseVttSubtitle(vttContent);

      // 验证字幕数量
      expect(subtitles.length).toBe(3);

      // 验证第一条字幕
      expect(subtitles[0]).toEqual({
        index: 1,
        startTime: 1.000,
        endTime: 5.000,
        text: '这是VTT格式的第一行字幕\n这是第二行'
      });

      // 验证第二条字幕
      expect(subtitles[1]).toEqual({
        index: 2,
        startTime: 6.000,
        endTime: 10.000,
        text: '测试字幕解析功能\nVTT格式测试'
      });

      // 验证第三条字幕
      expect(subtitles[2]).toEqual({
        index: 3,
        startTime: 11.500,
        endTime: 15.750,
        text: '包含特殊字符：!@#$%^&*()\n支持多行文本'
      });
    });
  });

  describe('ASS字幕解析', () => {
    it('应该正确解析ASS格式的字幕', () => {
      const subtitles = parseAssSubtitle(assContent);

      // 验证字幕数量
      expect(subtitles.length).toBe(3);

      // 验证第一条字幕
      expect(subtitles[0]).toEqual({
        index: 1,
        startTime: 1.000,
        endTime: 5.000,
        text: '这是ASS格式的第一行字幕\n这是第二行'
      });

      // 验证第二条字幕
      expect(subtitles[1]).toEqual({
        index: 2,
        startTime: 6.000,
        endTime: 10.000,
        text: '测试字幕解析功能\nASS格式测试'
      });

      // 验证第三条字幕
      expect(subtitles[2]).toEqual({
        index: 3,
        startTime: 11.500,
        endTime: 15.750,
        text: '包含特殊字符：!@#$%^&*()\n支持多行文本'
      });
    });
  });

  describe('SUB字幕解析', () => {
    it('应该正确解析SUB格式的字幕', () => {
      const subtitles = parseSubSubtitle(subContent);

      // 验证字幕数量
      expect(subtitles.length).toBe(3);

      // 验证第一条字幕
      expect(subtitles[0]).toEqual({
        index: 1,
        startTime: 1.000, // 25fps: {25} = 1s
        endTime: 5.000,   // 25fps: {125} = 5s
        text: '这是SUB格式的第一行字幕\n这是第二行'
      });

      // 验证第二条字幕
      expect(subtitles[1]).toEqual({
        index: 2,
        startTime: 6.000,  // 25fps: {150} = 6s
        endTime: 10.000,   // 25fps: {250} = 10s
        text: '测试字幕解析功能\nSUB格式测试'
      });

      // 验证第三条字幕
      expect(subtitles[2]).toEqual({
        index: 3,
        startTime: 11.480,  // 25fps: {287} = 11.48s
        endTime: 15.720,    // 25fps: {393} = 15.72s
        text: '包含特殊字符：!@#$%^&*()\n支持多行文本'
      });
    });
  });

  describe('字幕通用属性验证', () => {
    it('所有解析器都应返回有效的字幕对象', () => {
      const parsers = [
        () => parseSrtSubtitle(srtContent),
        () => parseVttSubtitle(vttContent),
        () => parseAssSubtitle(assContent),
        () => parseSubSubtitle(subContent)
      ];

      parsers.forEach((parse, index) => {
        const subtitles = parse();

        subtitles.forEach((subtitle) => {
          // 验证字幕基本属性
          expect(subtitle).toHaveProperty('index');
          expect(subtitle).toHaveProperty('startTime');
          expect(subtitle).toHaveProperty('endTime');
          expect(subtitle).toHaveProperty('text');

          // 验证字幕属性类型
          expect(typeof subtitle.index).toBe('number');
          expect(typeof subtitle.startTime).toBe('number');
          expect(typeof subtitle.endTime).toBe('number');
          expect(typeof subtitle.text).toBe('string');

          // 验证时间范围有效性
          expect(subtitle.startTime).toBeGreaterThanOrEqual(0);
          expect(subtitle.endTime).toBeGreaterThan(subtitle.startTime);

          // 验证文本内容不为空
          expect(subtitle.text.length).toBeGreaterThan(0);
        });
      });
    });
  });
});