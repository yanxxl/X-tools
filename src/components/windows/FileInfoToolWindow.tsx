import React, {useEffect, useState} from 'react';
import {Alert, Button, Card, Descriptions, Space, Spin, Typography} from 'antd';
import {FileOutlined, FolderOpenOutlined} from '@ant-design/icons';
import {countText, formatDate, formatFileSize, getFileTextStats, getSelectedText, truncateText} from '../../utils/format';
import {isTextFile} from '../../utils/fileType';
import {useAppContext} from '../../contexts/AppContext';
import {FileInfo} from "../../types";
import {ToolWindow} from './toolWindow';

const {Text} = Typography;

/**
 * 文件信息面板组件
 */
const FileInfoPanel: React.FC = () => {
    const {currentFile, currentFolder} = useAppContext();
    const [fileInfo, setFileInfo] = useState<FileInfo | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedText, setSelectedText] = useState('');
    const [selectedTextCount, setSelectedTextCount] = useState('0 字');
    const [fileTextStats, setFileTextStats] = useState<{ chars: number; words: number; chineseChars: number } | null>(null);

    // 处理文本选择
    const handleSelectionChange = () => {
        const selection = getSelectedText();
        if (selection !== selectedText) {
            setSelectedText(selection);
            const count = countText(selection);
            if (count.chars > 0) {
                setSelectedTextCount(`${count.chars} 字`);
            } else {
                setSelectedTextCount('0 字');
            }
        }
    };

    // 强制更新选择状态
    const forceUpdateSelection = () => {
        const selection = getSelectedText();
        setSelectedText(selection);
        const count = countText(selection);
        setSelectedTextCount(count.chars > 0 ? `${count.chars} 字` : '0 字');
    };

    // 监听文本选择变化
    // 这里看起来事件挺杂乱，但确是 Trae 精挑细选的，不能删一条，不然总会漏掉一些场景。
    // 这个事情，也不能挪到更高层级共享状态，会影响页面选中。要避免 Markdown 页面因状态而重新渲染，而影响选中状态。
    useEffect(() => {
        // 监听选择变化
        document.addEventListener('selectionchange', handleSelectionChange);
        // 监听鼠标点击事件（处理点击空白处取消选择）
        document.addEventListener('click', forceUpdateSelection);
        // 监听键盘事件（处理ESC键等取消选择）
        document.addEventListener('keydown', forceUpdateSelection);
        // 监听键盘释放事件
        document.addEventListener('keyup', handleSelectionChange);
        // 监听窗口失焦（可能导致选择被清除）
        window.addEventListener('blur', forceUpdateSelection);

        return () => {
            document.removeEventListener('selectionchange', handleSelectionChange);
            document.removeEventListener('click', forceUpdateSelection);
            document.removeEventListener('keydown', forceUpdateSelection);
            document.removeEventListener('keyup', handleSelectionChange);
            window.removeEventListener('blur', forceUpdateSelection);
        };
    }, [selectedText]);

    // 获取当前选中的路径
    const targetPath = currentFile || currentFolder;

    // 处理打开文件
    const handleOpenFile = async () => {
        if (targetPath && window.electronAPI) {
            try {
                await window.electronAPI.openFile(targetPath);
            } catch (error) {
                console.error('打开文件失败:', error);
            }
        }
    };

    // 处理显示文件夹
    const handleShowInFolder = async () => {
        if (targetPath && window.electronAPI) {
            try {
                await window.electronAPI.showItemInFolder(targetPath);
            } catch (error) {
                console.error('显示文件夹失败:', error);
            }
        }
    };

    // 获取文件信息
    useEffect(() => {
        const fetchFileInfo = async () => {
            if (!currentFile && !currentFolder) {
                setFileInfo(null);
                setFileTextStats(null);
                setError(null);
                return;
            }

            const targetPath = currentFile || currentFolder;
            if (!targetPath) {
                setFileInfo(null);
                setFileTextStats(null);
                setError(null);
                return;
            }

            setLoading(true);
            setError(null);

            try {
                if (window.electronAPI) {
                    const info = await window.electronAPI.getFileInfo(targetPath);
                    setFileInfo(info);

                    // 如果是文本文件，获取字符数统计
                    if (!info.isDirectory && isTextFile(info.name)) {
                        const stats = await getFileTextStats(targetPath);
                        setFileTextStats(stats);
                    } else {
                        setFileTextStats(null);
                    }
                } else {
                    // 浏览器环境下的模拟数据
                    setError('浏览器环境下无法获取文件信息');
                }
            } catch (err) {
                console.error('获取文件信息失败:', err);
                setError('获取文件信息失败');
            } finally {
                setLoading(false);
            }
        };

        fetchFileInfo();
    }, [currentFile, currentFolder]);

    // 渲染加载状态
    if (loading) {
        return (
            <div style={{padding: 16, textAlign: 'center'}}>
                <Spin tip="正在获取文件信息..."/>
            </div>
        );
    }

    // 渲染错误状态
    if (error) {
        return (
            <div style={{padding: 16}}>
                <Alert
                    message="错误"
                    description={error}
                    type="error"
                    showIcon
                />
            </div>
        );
    }

    // 渲染空状态
    if (!fileInfo) {
        return (
            <div style={{padding: 16, textAlign: 'center'}}>
                <div style={{fontSize: 48, color: '#d9d9d9', marginBottom: 16}}>📄</div>
                <div>
                    <Text type="secondary">请选择文件或文件夹查看信息</Text>
                </div>
            </div>
        );
    }

    return (
        <div style={{height: '100%', padding: 8, display: 'flex', flexDirection: 'column', gap: 8}}>
            {/* 基本文件信息卡片 */}
            <Card
                size="small"
                title="基本信息"
                extra={
                    <Space>
                        <Button
                            type="text"
                            size="small"
                            icon={<FileOutlined/>}
                            onClick={handleOpenFile}
                            title="打开文件"
                        />
                        <Button
                            type="text"
                            size="small"
                            icon={<FolderOpenOutlined/>}
                            onClick={handleShowInFolder}
                            title="在文件夹中显示"
                        />
                    </Space>
                }
            >
                <Descriptions size="small" column={1} labelStyle={{width: '80px', textAlign: 'right'}}>
                    <Descriptions.Item label="名称">
                        <Text style={{wordBreak: 'break-all'}}>{fileInfo.name}</Text>
                    </Descriptions.Item>

                    <Descriptions.Item label="路径">
                        <Text copyable style={{fontSize: 12, wordBreak: 'break-all'}}>
                            {fileInfo.path}
                        </Text>
                    </Descriptions.Item>

                    <Descriptions.Item label="大小">
                        {fileInfo.isDirectory
                            ? `${fileInfo.childrenCount || 0} 个项目`
                            : formatFileSize(fileInfo.size)
                        }
                    </Descriptions.Item>

                    <Descriptions.Item label="修改时间">
                        {formatDate(fileInfo.mtimeMs)}
                    </Descriptions.Item>

                    <Descriptions.Item label="创建时间">
                        {formatDate(fileInfo.ctimeMs)}
                    </Descriptions.Item>
                </Descriptions>
            </Card>

            {/* 文件字数统计卡片 - 仅对文本文件显示 */}
            {!fileInfo.isDirectory && fileTextStats && (
                <Card
                    size="small"
                    title="字数统计"
                >
                    <Descriptions size="small" column={1} labelStyle={{width: '80px', textAlign: 'right'}}>
                        <Descriptions.Item label="总字符数">
                            <Text strong>{fileTextStats.chars.toLocaleString()}</Text>
                        </Descriptions.Item>

                        <Descriptions.Item label="中文字符">
                            <Text style={{color: '#1890ff'}}>{fileTextStats.chineseChars.toLocaleString()}</Text>
                        </Descriptions.Item>

                        <Descriptions.Item label="英文单词">
                            <Text style={{color: '#52c41a'}}>{fileTextStats.words.toLocaleString()}</Text>
                        </Descriptions.Item>
                    </Descriptions>
                </Card>
            )}

            {/* 选中内容统计卡片 - 始终显示 */}
            <Card
                size="small"
                title="选中内容"
            >
                <Descriptions size="small" column={1} labelStyle={{width: '80px', textAlign: 'right'}}>
                    <Descriptions.Item label="选中字数">
                        <Text strong style={{color: '#fa8c16'}}>{selectedTextCount}</Text>
                    </Descriptions.Item>

                    {selectedText && selectedTextCount !== '0 字' && (
                        <Descriptions.Item label="选中内容">
                            <Text style={{fontSize: 12, wordBreak: 'break-all'}} type="secondary">
                                {truncateText(selectedText, 100)}
                            </Text>
                        </Descriptions.Item>
                    )}
                </Descriptions>
            </Card>
        </div>
    );
};

/**
 * 文件信息图标组件
 */
const FileInfoIcon: React.FC = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
    </svg>
);

/**
 * 创建并导出文件基本信息工具窗口实例
 */
export const createFileInfoToolWindow = (): ToolWindow => {
    return new ToolWindow({
        id: 'file-info',
        name: '文件信息',
        description: '显示选中文件或文件夹的基本信息',
        isVisible: false,
        view: <FileInfoPanel/>,
        icon: <FileInfoIcon/>,
        shortcut: 'Ctrl+Shift+I',
        defaultWidth: 300,
        defaultHeight: 400
    });
};

/**
 * 导出默认的工具窗口实例
 */
export const fileInfoToolWindow = createFileInfoToolWindow();

/**
 * 导出组件供其他地方使用
 */
export {FileInfoPanel};