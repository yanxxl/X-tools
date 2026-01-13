import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button, Card, Input, Empty, Space, Typography, message, Checkbox, Tooltip, List, Flex } from 'antd';
import { DeleteOutlined, SettingOutlined, UpOutlined, DownOutlined, SearchOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { ToolWindow } from './toolWindow';
import { createDictionaryManager } from '../../utils/dictionaryManager';

/**
 * Word icon component
 */
const WordIcon: React.FC = () => {
    return <div style={{ fontSize: '15px', fontWeight: 'normal' }}>词</div>;
};

const { Text, Title } = Typography;



const DictionaryPanel: React.FC = () => {
    // 使用词典管理器管理多个词典
    const [dictionaryManager] = useState(() => createDictionaryManager());
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(false);
    const [isSettingsVisible, setIsSettingsVisible] = useState<boolean>(false);
    const [dictionaries, setDictionaries] = useState<Array<{ id: string; name: string; filePath: string; enabled: boolean; error?: string }>>([]);

    // 组件初始化时从本地存储加载词典
    useEffect(() => {
        const loadDictionaries = async () => {
            try {
                await dictionaryManager.loadFromStorage();
            } catch (error) {
                console.error('加载本地存储的词典失败:', error);
                message.error('加载本地存储的词典失败');
            }
        };

        loadDictionaries();
    }, [dictionaryManager]);

    // 监听词典变化，更新状态
    useEffect(() => {
        // 定义更新词典列表的函数
        const updateDictionaries = () => {
            const dictionaryArray = Array.from(dictionaryManager.dictionaries.values());
            setDictionaries(dictionaryArray.map(dict => ({
                id: dict.id,
                name: dict.name,
                filePath: dict.filePath,
                enabled: dict.enabled,
                error: dict.error
            })));
        };

        // 初始加载时更新一次
        updateDictionaries();

        // 注册change事件监听器
        dictionaryManager.on('change', updateDictionaries);

        // 组件卸载时注销监听器
        return () => {
            dictionaryManager.off('change', updateDictionaries);
        };
    }, [dictionaryManager]);

    // Add selected files as dictionaries
    const addDictionaries = useCallback(async (files: string[]) => {
        setLoading(true);
        try {
            for (const filePath of files) {
                await dictionaryManager.addDictionary(filePath);
            }
            message.success(`成功添加 ${files.length} 个词典`);
        } catch (error) {
            console.error('添加词典失败:', error);
            message.error('添加词典失败');
        } finally {
            setLoading(false);
        }
    }, [dictionaryManager]);

    // Handle file selection
    const handleSelectFiles = useCallback(async () => {
        try {
            const files = await window.electronAPI.openFileDialog({
                properties: ['openFile', 'multiSelections'],
                filters: [{ name: 'Markdown Files', extensions: ['md', 'markdown', 'mdown', 'mkd'] }]
            });

            if (files && files.length > 0) {
                await addDictionaries(files);
            }
        } catch (error) {
            console.error('选择文件失败:', error);
            message.error('选择文件失败');
        }
    }, [addDictionaries]);

    // Remove dictionary
    const handleRemoveDictionary = useCallback((dictionaryId: string) => {
        dictionaryManager.removeDictionary(dictionaryId);
        message.success('词典已移除');
    }, [dictionaryManager]);

    // 搜索结果（使用useMemo优化）
    const searchResults = useMemo(() => {
        if (!searchTerm.trim()) {
            return [];
        }
        return dictionaryManager.search(searchTerm.trim());
    }, [searchTerm, dictionaryManager]);


    return (
        <Card
            styles={{ 
                root: { margin: 0, overflow: 'hidden', borderRadius: 0, height: '100%',display:'flex',flexDirection:'column' },
                body: { flex: 1,overflow:'hidden' }
            }}
            size="small"
            title={
                <Space style={{ width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>词典</span>
                    <Space>
                        <Tooltip title="刷新词典">
                            <Button
                                type="text"
                                icon={<ReloadOutlined />}
                                onClick={async () => {
                                    try {
                                        await dictionaryManager.loadFromStorage();
                                        message.success('词典已刷新');
                                    } catch (error) {
                                        message.error('刷新词典失败');
                                    }
                                }}
                                size="small"
                            />
                        </Tooltip>
                        <Tooltip title="管理词典">
                            <Button
                                type="text"
                                icon={<SettingOutlined />}
                                onClick={() => setIsSettingsVisible(!isSettingsVisible)}
                                size="small"
                            />
                        </Tooltip>
                    </Space>
                </Space>
            }
        >
            <Flex style={{ height: '100%' }} orientation="vertical">
                {/* Settings Panel */}
                {isSettingsVisible && (
                    <div style={{ marginBottom: 16, padding: 12, backgroundColor: '#f5f5f5', borderRadius: 4, border: '1px solid #e8e8e8' }}>

                        {/* Add Dictionary Button */}
                        <Button
                            type="text"
                            icon={<PlusOutlined />}
                            onClick={handleSelectFiles}
                            loading={loading}
                            size="small"
                            style={{ marginBottom: 12 }}
                        >
                            添加词典（Markdown文件）
                        </Button>

                        {/* Dictionary List */}
                        {dictionaries.length === 0 ? (
                            <Text type="secondary">暂无添加的词典</Text>
                        ) : (
                            <Space orientation="vertical" style={{ width: '100%' }}>
                                {dictionaries.map((dict, index) => (
                                    <div key={dict.id} style={{ width: '100%', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: 4, borderRadius: 4, backgroundColor: '#fff' }}>
                                        <div style={{ flex: 1 }}>
                                            <Checkbox
                                                checked={dict.enabled}
                                                onChange={(e) => {
                                                    dictionaryManager.toggleDictionaryEnabled(dict.id);
                                                    message.success(e.target.checked ? '词典已启用' : '词典已禁用');
                                                }}
                                            >
                                                <Text>
                                                    {dict.name}
                                                </Text>
                                            </Checkbox>
                                            {dict.error && (
                                                <Text type="danger" style={{ display: 'block', fontSize: '12px', marginTop: 4 }}>
                                                    错误: {dict.error}
                                                </Text>
                                            )}
                                        </div>
                                        <Space>
                                            <Button
                                                type="text"
                                                icon={<UpOutlined />}
                                                disabled={index === 0}
                                                onClick={() => {
                                                    dictionaryManager.moveDictionaryUp(dict.id);
                                                    message.success('词典已上移');
                                                }}
                                                size="small"
                                            />
                                            <Button
                                                type="text"
                                                icon={<DownOutlined />}
                                                disabled={index === dictionaries.length - 1}
                                                onClick={() => {
                                                    dictionaryManager.moveDictionaryDown(dict.id);
                                                    message.success('词典已下移');
                                                }}
                                                size="small"
                                            />
                                            <Button
                                                type="text"
                                                icon={<DeleteOutlined />}
                                                onClick={() => handleRemoveDictionary(dict.id)}
                                                size="small"
                                            />
                                        </Space>
                                    </div>
                                ))}
                            </Space>
                        )}
                    </div>
                )}

                {/* Search Input */}
                <Input
                    placeholder="输入要搜索的术语..."
                    prefix={<SearchOutlined />}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    allowClear
                    style={{ marginBottom: 16 }}
                />

                {/* Search Results */}
                <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', width: '100%', minHeight: 0 }}>
                    <div style={{ marginBottom: 8 }}>
                        <Text type="secondary">
                            {searchTerm.trim() ?
                                `找到 ${searchResults.length} 条结果` :
                                `已启用 ${dictionaryManager.getEnabledDictionaries().length}/${dictionaryManager.dictionaries.size} 个词典`
                            }
                        </Text>
                    </div>

                    {searchResults.length > 0 ? (
                        <List
                            style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', minHeight: 0 }}
                            dataSource={searchResults}
                            renderItem={(entry, index) => (
                                <List.Item key={index} className="text-content" style={{ marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid #f0f0f0', flexDirection: 'column', alignItems: 'flex-start', width: '100%' }}>
                                    <div>
                                        {/* 显示catalog */}
                                        {entry.catalog.length > 0 && (
                                            <div style={{ marginBottom: 4 }}>
                                                <Text type="secondary" style={{ fontSize: '12px', marginRight: 8 }}>
                                                    {entry.catalog.join(' > ')}
                                                </Text>
                                            </div>
                                        )}
                                        <Title level={5}>
                                            {entry.term}
                                        </Title>
                                    </div>

                                    {/* 直接引用元素，保持原汁原味 */}
                                    <div style={{ fontSize: '14px', lineHeight: 1.6, overflowWrap: 'break-word', wordBreak: 'break-word' }}>
                                        {entry.definition.map((element, defIndex) => (
                                            <div key={defIndex} dangerouslySetInnerHTML={{ __html: element.outerHTML }} />
                                        ))}
                                    </div>
                                </List.Item>
                            )}
                        />
                    ) : (
                        <Empty
                            description="暂无搜索结果"
                            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
                        />
                    )}
                </div>
            </Flex>
        </Card>
    );
};

/**
 * Dictionary tool window
 */
export const dictionaryToolWindow = new ToolWindow({
    id: 'dictionary-tool-window',
    name: '词典',
    description: '使用Markdown文件作为词典，搜索标题内容获取相关定义',
    isVisible: false,
    view: <DictionaryPanel />,
    icon: <WordIcon />,
    isResizable: true,
    defaultWidth: 400,
    defaultHeight: 600
});
