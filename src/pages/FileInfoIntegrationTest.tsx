/**
 * 文件信息工具窗口完整集成测试页面
 */

import React, { useState, useEffect } from 'react';
import { Card, Button, Space, Typography, Divider, Alert, Tag, List, Row, Col } from 'antd';
import { 
    FolderOutlined, 
    InfoCircleOutlined, 
    CheckCircleOutlined, 
    ExclamationCircleOutlined,
    PlayCircleOutlined,
    EyeOutlined,
    EyeInvisibleOutlined,
    ReloadOutlined
} from '@ant-design/icons';
import { fileInfoToolWindow } from '../components/windows/FileInfoToolWindow';
import { toolWindowManager } from '../components/windows/toolWindowManager';
import { runFileInfoToolWindowValidation } from '../utils/FileInfoToolWindowValidation';
import { useAppContext } from '../contexts/AppContext';

const { Title, Text, Paragraph } = Typography;

interface TestResult {
    name: string;
    status: 'pending' | 'success' | 'error';
    message?: string;
    duration?: number;
}

export const FileInfoIntegrationTest: React.FC = () => {
    const { selectedPath } = useAppContext();
    const [testResults, setTestResults] = useState<TestResult[]>([]);
    const [isRunningTests, setIsRunningTests] = useState(false);
    const [windowInfo, setWindowInfo] = useState<any>(null);

    // 添加测试结果
    const addTestResult = (result: TestResult) => {
        setTestResults(prev => [...prev, result]);
    };

    // 运行验证测试
    const runValidationTests = async () => {
        setIsRunningTests(true);
        setTestResults([]);
        
        const startTime = Date.now();
        
        try {
            addTestResult({
                name: '开始验证测试',
                status: 'pending',
                message: '正在运行文件信息工具窗口验证...'
            });
            
            // 运行验证
            const validationPassed = runFileInfoToolWindowValidation();
            
            addTestResult({
                name: '基本验证测试',
                status: validationPassed ? 'success' : 'error',
                message: validationPassed ? '所有基本验证通过' : '部分验证失败',
                duration: Date.now() - startTime
            });
            
        } catch (error) {
            addTestResult({
                name: '验证测试',
                status: 'error',
                message: `验证过程中发生错误: ${error}`,
                duration: Date.now() - startTime
            });
        } finally {
            setIsRunningTests(false);
        }
    };

    // 测试工具窗口注册
    const testWindowRegistration = () => {
        const startTime = Date.now();
        
        try {
            toolWindowManager.register(fileInfoToolWindow);
            const registeredWindow = toolWindowManager.get(fileInfoToolWindow.id);
            
            addTestResult({
                name: '工具窗口注册测试',
                status: registeredWindow ? 'success' : 'error',
                message: registeredWindow ? '工具窗口注册成功' : '工具窗口注册失败',
                duration: Date.now() - startTime
            });
        } catch (error) {
            addTestResult({
                name: '工具窗口注册测试',
                status: 'error',
                message: `注册失败: ${error}`,
                duration: Date.now() - startTime
            });
        }
    };

    // 测试工具窗口显示/隐藏
    const testWindowVisibility = () => {
        const startTime = Date.now();
        
        try {
            const originalState = fileInfoToolWindow.isVisible;
            
            // 切换状态
            fileInfoToolWindow.toggle();
            const toggledState = fileInfoToolWindow.isVisible;
            
            // 恢复原状态
            fileInfoToolWindow.toggle();
            const restoredState = fileInfoToolWindow.isVisible;
            
            const success = originalState === restoredState && originalState !== toggledState;
            
            addTestResult({
                name: '工具窗口显示/隐藏测试',
                status: success ? 'success' : 'error',
                message: success ? '显示/隐藏功能正常' : '显示/隐藏功能异常',
                duration: Date.now() - startTime
            });
        } catch (error) {
            addTestResult({
                name: '工具窗口显示/隐藏测试',
                status: 'error',
                message: `显示/隐藏测试失败: ${error}`,
                duration: Date.now() - startTime
            });
        }
    };

    // 获取工具窗口信息
    const getWindowInfo = () => {
        const info = {
            id: fileInfoToolWindow.id,
            name: fileInfoToolWindow.name,
            description: fileInfoToolWindow.description,
            isVisible: fileInfoToolWindow.isVisible,
            defaultWidth: fileInfoToolWindow.defaultWidth,
            defaultHeight: fileInfoToolWindow.defaultHeight,
            shortcut: fileInfoToolWindow.shortcut,
            hasView: !!fileInfoToolWindow.view,
            registered: !!toolWindowManager.get(fileInfoToolWindow.id)
        };
        
        setWindowInfo(info);
    };

    // 运行所有测试
    const runAllTests = async () => {
        setTestResults([]);
        await runValidationTests();
        testWindowRegistration();
        testWindowVisibility();
        getWindowInfo();
    };

    // 页面加载时获取窗口信息
    useEffect(() => {
        getWindowInfo();
    }, []);

    return (
        <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
            <Card>
                <Title level={2}>
                    <InfoCircleOutlined /> 文件信息工具窗口集成测试
                </Title>
                
                <Paragraph>
                    这个页面用于测试文件信息工具窗口的完整功能，包括基本属性验证、
                    工具窗口管理器集成、显示/隐藏功能等。
                </Paragraph>

                {/* 当前选中路径信息 */}
                <Alert
                    message="当前选中路径"
                    description={selectedPath || '未选中任何文件或文件夹'}
                    type="info"
                    showIcon
                    style={{ marginBottom: '16px' }}
                />

                {/* 工具窗口信息 */}
                {windowInfo && (
                    <Card size="small" title="工具窗口信息" style={{ marginBottom: '16px' }}>
                        <Row gutter={[16, 16]}>
                            <Col span={8}>
                                <Text strong>ID:</Text> {windowInfo.id}
                            </Col>
                            <Col span={8}>
                                <Text strong>名称:</Text> {windowInfo.name}
                            </Col>
                            <Col span={8}>
                                <Text strong>状态:</Text> 
                                <Tag color={windowInfo.isVisible ? 'green' : 'default'}>
                                    {windowInfo.isVisible ? '显示' : '隐藏'}
                                </Tag>
                            </Col>
                            <Col span={8}>
                                <Text strong>默认尺寸:</Text> {windowInfo.defaultWidth}×{windowInfo.defaultHeight}
                            </Col>
                            <Col span={8}>
                                <Text strong>快捷键:</Text> {windowInfo.shortcut}
                            </Col>
                            <Col span={8}>
                                <Text strong>注册状态:</Text> 
                                <Tag color={windowInfo.registered ? 'green' : 'red'}>
                                    {windowInfo.registered ? '已注册' : '未注册'}
                                </Tag>
                            </Col>
                        </Row>
                    </Card>
                )}

                {/* 操作按钮 */}
                <Space wrap style={{ marginBottom: '16px' }}>
                    <Button 
                        type="primary" 
                        icon={<PlayCircleOutlined />}
                        loading={isRunningTests}
                        onClick={runAllTests}
                    >
                        运行所有测试
                    </Button>
                    <Button 
                        icon={<ReloadOutlined />}
                        onClick={runValidationTests}
                    >
                        验证测试
                    </Button>
                    <Button 
                        icon={<CheckCircleOutlined />}
                        onClick={testWindowRegistration}
                    >
                        测试注册
                    </Button>
                    <Button 
                        icon={<EyeOutlined />}
                        onClick={() => fileInfoToolWindow.show()}
                    >
                        显示窗口
                    </Button>
                    <Button 
                        icon={<EyeInvisibleOutlined />}
                        onClick={() => fileInfoToolWindow.hide()}
                    >
                        隐藏窗口
                    </Button>
                    <Button 
                        onClick={() => fileInfoToolWindow.toggle()}
                    >
                        切换显示
                    </Button>
                </Space>

                <Divider />

                {/* 测试结果 */}
                {testResults.length > 0 && (
                    <Card size="small" title="测试结果">
                        <List
                            dataSource={testResults}
                            renderItem={(result) => (
                                <List.Item>
                                    <List.Item.Meta
                                        avatar={
                                            result.status === 'success' ? 
                                                <CheckCircleOutlined style={{ color: '#52c41a' }} /> :
                                                result.status === 'error' ?
                                                <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} /> :
                                                <ReloadOutlined spin />
                                        }
                                        title={
                                            <Space>
                                                {result.name}
                                                <Tag color={
                                                    result.status === 'success' ? 'green' :
                                                    result.status === 'error' ? 'red' : 'blue'
                                                }>
                                                    {result.status === 'success' ? '成功' :
                                                     result.status === 'error' ? '失败' : '进行中'}
                                                </Tag>
                                                {result.duration && (
                                                    <Text type="secondary">({result.duration}ms)</Text>
                                                )}
                                            </Space>
                                        }
                                        description={result.message}
                                    />
                                </List.Item>
                            )}
                        />
                    </Card>
                )}

                {/* 使用说明 */}
                <Alert
                    message="使用说明"
                    description={
                        <div>
                            <p>1. 点击"运行所有测试"执行完整的集成测试</p>
                            <p>2. 使用"显示窗口"/"隐藏窗口"按钮控制工具窗口的显示状态</p>
                            <p>3. 在文件浏览器中选择不同的文件或文件夹，观察工具窗口内容的变化</p>
                            <p>4. 使用快捷键 {fileInfoToolWindow.shortcut} 快速切换工具窗口显示状态</p>
                        </div>
                    }
                    type="info"
                    showIcon
                    style={{ marginTop: '16px' }}
                />
            </Card>
        </div>
    );
};

export default FileInfoIntegrationTest;