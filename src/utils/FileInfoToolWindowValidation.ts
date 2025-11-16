/**
 * 文件信息工具窗口验证脚本
 * 用于验证工具窗口的基本功能
 */

import { fileInfoToolWindow } from '../components/FileInfoToolWindow';
import { toolWindowManager } from './toolWindowManager';

// 验证工具窗口基本属性
function validateToolWindowProperties() {
    console.log('🔍 验证工具窗口基本属性...');
    
    const requiredProps = ['id', 'name', 'description', 'view', 'icon'];
    const missingProps = requiredProps.filter(prop => !(prop in fileInfoToolWindow));
    
    if (missingProps.length > 0) {
        console.error('❌ 缺少必要属性:', missingProps);
        return false;
    }
    
    console.log('✅ 工具窗口基本属性验证通过');
    console.log(`   - ID: ${fileInfoToolWindow.id}`);
    console.log(`   - 名称: ${fileInfoToolWindow.name}`);
    console.log(`   - 描述: ${fileInfoToolWindow.description}`);
    console.log(`   - 默认宽度: ${fileInfoToolWindow.defaultWidth}px`);
    console.log(`   - 默认高度: ${fileInfoToolWindow.defaultHeight}px`);
    console.log(`   - 快捷键: ${fileInfoToolWindow.shortcut}`);
    
    return true;
}

// 验证工具窗口方法
function validateToolWindowMethods() {
    console.log('\n🔍 验证工具窗口方法...');
    
    const requiredMethods = ['show', 'hide', 'toggle', 'clone', 'toJSON'];
    const missingMethods = requiredMethods.filter(method => typeof (fileInfoToolWindow as any)[method] !== 'function');
    
    if (missingMethods.length > 0) {
        console.error('❌ 缺少必要方法:', missingMethods);
        return false;
    }
    
    console.log('✅ 工具窗口方法验证通过');
    
    // 测试切换方法
    const originalVisibility = fileInfoToolWindow.isVisible;
    fileInfoToolWindow.toggle();
    const toggledVisibility = fileInfoToolWindow.isVisible;
    fileInfoToolWindow.toggle(); // 恢复原状态
    const restoredVisibility = fileInfoToolWindow.isVisible;
    
    if (originalVisibility === restoredVisibility && originalVisibility !== toggledVisibility) {
        console.log('✅ toggle 方法工作正常');
    } else {
        console.error('❌ toggle 方法异常');
        return false;
    }
    
    return true;
}

// 验证工具窗口管理器集成
function validateToolWindowManagerIntegration() {
    console.log('\n🔍 验证工具窗口管理器集成...');
    
    try {
        // 注册工具窗口
        toolWindowManager.register(fileInfoToolWindow);
        
        // 验证注册是否成功
        const retrievedWindow = toolWindowManager.get(fileInfoToolWindow.id);
        
        if (!retrievedWindow) {
            console.error('❌ 工具窗口注册失败');
            return false;
        }
        
        if (retrievedWindow.id !== fileInfoToolWindow.id) {
            console.error('❌ 工具窗口ID不匹配');
            return false;
        }
        
        console.log('✅ 工具窗口管理器集成验证通过');
        console.log(`   - 已注册工具窗口数量: ${toolWindowManager.getAll().length}`);
        
        return true;
    } catch (error) {
        console.error('❌ 工具窗口管理器集成失败:', error);
        return false;
    }
}

// 验证JSON序列化
function validateJSONSerialization() {
    console.log('\n🔍 验证JSON序列化...');
    
    try {
        const jsonData = fileInfoToolWindow.toJSON();
        
        if (!jsonData || typeof jsonData !== 'object') {
            console.error('❌ JSON序列化失败');
            return false;
        }
        
        const requiredFields = ['id', 'name', 'description', 'isVisible'];
        const missingFields = requiredFields.filter(field => !(field in jsonData));
        
        if (missingFields.length > 0) {
            console.error('❌ JSON序列化缺少字段:', missingFields);
            return false;
        }
        
        console.log('✅ JSON序列化验证通过');
        console.log(`   - 序列化字段数量: ${Object.keys(jsonData).length}`);
        
        return true;
    } catch (error) {
        console.error('❌ JSON序列化验证失败:', error);
        return false;
    }
}

// 运行所有验证
export function runFileInfoToolWindowValidation() {
    console.log('🧪 开始文件信息工具窗口验证...\n');
    
    const results = [
        validateToolWindowProperties(),
        validateToolWindowMethods(),
        validateToolWindowManagerIntegration(),
        validateJSONSerialization()
    ];
    
    const allPassed = results.every(result => result === true);
    
    if (allPassed) {
        console.log('\n🎉 所有验证都通过了！文件信息工具窗口已准备就绪。');
        return true;
    } else {
        console.log('\n❌ 部分验证失败，请检查上述错误信息。');
        return false;
    }
}

// 如果直接运行此脚本
if (typeof window !== 'undefined' && window.location.pathname.includes('validation')) {
    runFileInfoToolWindowValidation();
}