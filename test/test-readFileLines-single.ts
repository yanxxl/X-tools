import { readFileLines, clearCache } from '../src/utils/fileCacheUtil';

// 在这里设置要测试的文件路径
const TEST_FILE_PATH = '/Users/yan/资料/医学/倪海厦笔记/倪海厦/人纪-1-针灸/倪海厦人纪系列之针灸教程.pdf'; // 请更改为你想要测试的文件路径

async function testReadFileLines() {
    console.log('🚀 开始测试 readFileLines 方法\n');
    
    try {
        // 清理缓存，确保从干净状态开始
        await clearCache(0);
        console.log('✅ 缓存已清理\n');
        
        // 测试基本文件读取
        console.log('📄 测试文件读取');
        console.log(`文件路径: ${TEST_FILE_PATH}`);
        
        const lines = await readFileLines(TEST_FILE_PATH);
        
        console.log('✅ 文件读取成功');
        console.log(`总行数: ${lines.length}`);
        console.log('');
        
        // 显示文件内容预览
        console.log('📋 文件内容预览:');
        console.log('='.repeat(50));
        lines.slice(0, 10).forEach((line, index) => {
            console.log(`${index + 1}: ${line}`);
        });
        if (lines.length > 10) {
            console.log(`... (还有 ${lines.length - 10} 行)`);
        }
        console.log('='.repeat(50));
        console.log('');
        
        // 测试缓存功能
        console.log('💾 测试缓存功能');
        
        console.log('第一次读取...');
        const lines1 = await readFileLines(TEST_FILE_PATH);
        console.log(`   行数: ${lines1.length}`);
        
        console.log('第二次读取（应该使用缓存）...');
        const lines2 = await readFileLines(TEST_FILE_PATH);
        console.log(`   行数: ${lines2.length}`);
        
        // 验证缓存是否工作
        if (JSON.stringify(lines1) === JSON.stringify(lines2)) {
            console.log('✅ 缓存功能正常 - 两次读取结果一致');
        } else {
            console.log('❌ 缓存功能异常 - 两次读取结果不一致');
        }
        
        console.log('\n🎉 测试完成！');
        
    } catch (error) {
        console.error('❌ 测试过程中发生错误:');
        console.error(`错误信息: ${error.message}`);
        
        if (error.code === 'ENOENT') {
            console.log('💡 提示: 文件不存在，请检查文件路径是否正确');
        }
    }
}

// 运行测试
testReadFileLines().catch(console.error);