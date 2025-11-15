import { ToolWindow, DefaultToolWindowManager } from '../types/toolWindow';

// 简单的测试组件
const TestComponent = () => 'Test Content';

/**
 * ToolWindow 类的简单测试
 */
export const testToolWindow = () => {
    console.log('开始测试 ToolWindow 类...');
    
    // 测试1: 创建工具窗口
    const toolWindow = new ToolWindow({
        id: 'test-window',
        name: '测试窗口',
        description: '这是一个测试窗口',
        isVisible: false,
        view: <TestComponent />,
        icon: 'test',
        shortcut: 'Ctrl+T',
        defaultWidth: 200,
        defaultHeight: 150
    });
    
    console.log('✓ 工具窗口创建成功');
    console.log(`  ID: ${toolWindow.id}`);
    console.log(`  名称: ${toolWindow.name}`);
    console.log(`  描述: ${toolWindow.description}`);
    console.log(`  可见性: ${toolWindow.isVisible}`);
    
    // 测试2: 属性访问
    if (toolWindow.id === 'test-window' && 
        toolWindow.name === '测试窗口' && 
        toolWindow.description === '这是一个测试窗口' &&
        toolWindow.isVisible === false) {
        console.log('✓ 属性访问测试通过');
    } else {
        console.error('✗ 属性访问测试失败');
        return false;
    }
    
    // 测试3: 可见性切换
    toolWindow.show();
    if (toolWindow.isVisible === true) {
        console.log('✓ 显示功能测试通过');
    } else {
        console.error('✗ 显示功能测试失败');
        return false;
    }
    
    toolWindow.hide();
    if (toolWindow.isVisible === false) {
        console.log('✓ 隐藏功能测试通过');
    } else {
        console.error('✗ 隐藏功能测试失败');
        return false;
    }
    
    toolWindow.toggle();
    if (toolWindow.isVisible === true) {
        console.log('✓ 切换功能测试通过');
    } else {
        console.error('✗ 切换功能测试失败');
        return false;
    }
    
    // 测试4: 属性设置
    toolWindow.name = '修改后的名称';
    toolWindow.description = '修改后的描述';
    
    if (toolWindow.name === '修改后的名称' && 
        toolWindow.description === '修改后的描述') {
        console.log('✓ 属性设置测试通过');
    } else {
        console.error('✗ 属性设置测试失败');
        return false;
    }
    
    // 测试5: 克隆功能
    const clonedWindow = toolWindow.clone();
    if (clonedWindow.id === 'test-window_clone' && 
        clonedWindow.name === '修改后的名称 (Copy)' &&
        clonedWindow.isVisible === true) {
        console.log('✓ 克隆功能测试通过');
    } else {
        console.error('✗ 克隆功能测试失败');
        return false;
    }
    
    // 测试6: JSON 序列化
    const jsonData = toolWindow.toJSON();
    const restoredWindow = ToolWindow.fromJSON(jsonData, <TestComponent />);
    
    if (restoredWindow.id === toolWindow.id && 
        restoredWindow.name === toolWindow.name &&
        restoredWindow.description === toolWindow.description &&
        restoredWindow.isVisible === toolWindow.isVisible) {
        console.log('✓ JSON 序列化测试通过');
    } else {
        console.error('✗ JSON 序列化测试失败');
        return false;
    }
    
    console.log('所有 ToolWindow 测试通过！');
    return true;
};

/**
 * ToolWindowManager 测试
 */
export const testToolWindowManager = () => {
    console.log('\n开始测试 ToolWindowManager...');
    
    const manager = new DefaultToolWindowManager();
    
    // 创建测试窗口
    const window1 = new ToolWindow({
        id: 'window1',
        name: '窗口1',
        description: '第一个测试窗口',
        isVisible: true,
        view: <TestComponent />
    });
    
    const window2 = new ToolWindow({
        id: 'window2',
        name: '窗口2',
        description: '第二个测试窗口',
        isVisible: false,
        view: <TestComponent />
    });
    
    // 测试1: 注册窗口
    manager.register(window1);
    manager.register(window2);
    
    if (manager.count() === 2 && manager.has('window1') && manager.has('window2')) {
        console.log('✓ 窗口注册测试通过');
    } else {
        console.error('✗ 窗口注册测试失败');
        return false;
    }
    
    // 测试2: 获取窗口
    const retrievedWindow1 = manager.get('window1');
    if (retrievedWindow1 && retrievedWindow1.name === '窗口1') {
        console.log('✓ 窗口获取测试通过');
    } else {
        console.error('✗ 窗口获取测试失败');
        return false;
    }
    
    // 测试3: 获取所有窗口
    const allWindows = manager.getAll();
    if (allWindows.length === 2) {
        console.log('✓ 获取所有窗口测试通过');
    } else {
        console.error('✗ 获取所有窗口测试失败');
        return false;
    }
    
    // 测试4: 获取可见窗口
    const visibleWindows = manager.getVisible();
    if (visibleWindows.length === 1 && visibleWindows[0].id === 'window1') {
        console.log('✓ 获取可见窗口测试通过');
    } else {
        console.error('✗ 获取可见窗口测试失败');
        return false;
    }
    
    // 测试5: 切换窗口状态
    const toggleResult = manager.toggle('window2');
    if (toggleResult && manager.get('window2')?.isVisible === true) {
        console.log('✓ 切换窗口状态测试通过');
    } else {
        console.error('✗ 切换窗口状态测试失败');
        return false;
    }
    
    // 测试6: 注销窗口
    manager.unregister('window1');
    if (manager.count() === 1 && !manager.has('window1')) {
        console.log('✓ 窗口注销测试通过');
    } else {
        console.error('✗ 窗口注销测试失败');
        return false;
    }
    
    // 测试7: 清空所有窗口
    manager.clear();
    if (manager.count() === 0) {
        console.log('✓ 清空窗口测试通过');
    } else {
        console.error('✗ 清空窗口测试失败');
        return false;
    }
    
    console.log('所有 ToolWindowManager 测试通过！');
    return true;
};

/**
 * 运行所有测试
 */
export const runAllTests = () => {
    console.log('🧪 开始运行 ToolWindow 相关测试...\n');
    
    const toolWindowTestResult = testToolWindow();
    const managerTestResult = testToolWindowManager();
    
    if (toolWindowTestResult && managerTestResult) {
        console.log('\n🎉 所有测试都通过了！');
        return true;
    } else {
        console.log('\n❌ 部分测试失败！');
        return false;
    }
};