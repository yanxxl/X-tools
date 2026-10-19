import fs from 'fs';
import path from 'path';
import {
  parseSrtSubtitle,
  parseVttSubtitle,
  parseAssSubtitle,
  parseSubSubtitle,
  SubtitleItem
} from '../../src/renderer/utils/subtitleUtil';

// 模拟window.electronAPI类型
declare global {
  interface Window {
    electronAPI?: any;
  }
}

// 测试数据目录
const testDir = __dirname;

// 读取测试文件内容
function readTestFile(filename: string): string {
  const filePath = path.join(testDir, filename);
  return fs.readFileSync(filePath, 'utf8');
}

// 测试通用验证函数
function validateSubtitles(subtitles: SubtitleItem[], expectedCount: number) {
  console.assert(subtitles.length === expectedCount, `预期 ${expectedCount} 条字幕，实际 ${subtitles.length} 条`);
  
  subtitles.forEach((subtitle, index) => {
    console.assert(subtitle.index === index + 1, `字幕 ${index + 1} 的序号不正确`);
    console.assert(typeof subtitle.startTime === 'number' && !isNaN(subtitle.startTime), `字幕 ${index + 1} 的开始时间不是有效数字`);
    console.assert(typeof subtitle.endTime === 'number' && !isNaN(subtitle.endTime), `字幕 ${index + 1} 的结束时间不是有效数字`);
    console.assert(subtitle.startTime < subtitle.endTime, `字幕 ${index + 1} 的开始时间应小于结束时间`);
    console.assert(subtitle.text.length > 0, `字幕 ${index + 1} 的文本内容为空`);
    
    console.log(`字幕 ${index + 1}: ${subtitle.text}`);
    console.log(`  时间: ${subtitle.startTime.toFixed(3)}s - ${subtitle.endTime.toFixed(3)}s`);
  });
}

// 测试SRT格式解析
function testSrtParser() {
  console.log('\n=== 测试SRT格式解析 ===');
  const content = readTestFile('test.srt');
  const subtitles = parseSrtSubtitle(content);
  validateSubtitles(subtitles, 3);
  console.log('SRT格式解析测试通过！');
}

// 测试VTT格式解析
function testVttParser() {
  console.log('\n=== 测试VTT格式解析 ===');
  const content = readTestFile('test.vtt');
  const subtitles = parseVttSubtitle(content);
  validateSubtitles(subtitles, 3);
  console.log('VTT格式解析测试通过！');
}

// 测试ASS格式解析
function testAssParser() {
  console.log('\n=== 测试ASS格式解析 ===');
  const content = readTestFile('test.ass');
  const subtitles = parseAssSubtitle(content);
  validateSubtitles(subtitles, 3);
  console.log('ASS格式解析测试通过！');
}

// 测试SUB格式解析
function testSubParser() {
  console.log('\n=== 测试SUB格式解析 ===');
  const content = readTestFile('test.sub');
  const subtitles = parseSubSubtitle(content);
  validateSubtitles(subtitles, 3);
  console.log('SUB格式解析测试通过！');
}

// 运行所有测试
function runAllTests() {
  console.log('开始测试字幕解析功能...');
  
  try {
    testSrtParser();
    testVttParser();
    testAssParser();
    testSubParser();
    
    console.log('\n✅ 所有格式解析测试通过！');
  } catch (error) {
    console.error('\n❌ 测试失败:', error);
    process.exit(1);
  }
}

// 执行测试
runAllTests();