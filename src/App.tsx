import React, {useEffect, useState} from 'react';
import {Button, ConfigProvider, Dropdown, Flex, message, Splitter, Tree, Typography} from "antd";
import {DeleteOutlined, DownOutlined, EyeInvisibleOutlined, FileTextOutlined, FolderOpenOutlined, PlusOutlined} from '@ant-design/icons';
import type {DataNode, TreeProps} from 'antd/es/tree';
import {FileNode} from './types';
import {FileInfo, RecentFolder} from './types/api';
import {FilePreview} from './components/FilePreview';
import {ToolWindowsPane} from './components/windows/ToolWindowsPane';
import {AppProvider, useAppContext} from './contexts/AppContext';
import {truncateFolderName} from './utils/uiUtils';
import {Config, removeFolderPath, updateFolderPath} from "./utils/config";

// 为Tree组件定义的节点类型
export type TreeNodeWithMeta = DataNode & {
    meta: FileNode;
    children?: TreeNodeWithMeta[];
};

const AppContent: React.FC = () => {
    console.log('AppContent 组件开始渲染');
    const { currentFolder, setCurrentFolder, currentFile, setCurrentFile } = useAppContext();
    console.log('Context 数据:', { currentFolder, currentFile });
    
    const [loading, setLoading] = useState(false);
    const [config, setConfig] = useState<Config | null>(null);
    const [recentFolders, setRecentFolders] = useState<RecentFolder[]>([]);
    const [fileTree, setFileTree] = useState<FileNode | null>(null);
    const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
    const [selectedInfo, setSelectedInfo] = useState<FileInfo | null>(null);
    const [titleBarVisible, setTitleBarVisible] = useState(true);

    const {Text} = Typography;

    // 加载配置文件
    useEffect(() => {
        console.log('config changed', config);
        setLoading(true);
        if (config == null) {
            if (window.electronAPI) {
                window.electronAPI.loadConfig().then(async (loadedConfig) => {
                    console.log('get config', loadedConfig);
                    setConfig(loadedConfig);
                })
            } else {
                // 浏览器环境下的默认配置
                setConfig({
                    recentFolders: []
                });
            }
        } else {
            setRecentFolders(config.recentFolders || []);
            // 修复：只有在recentFolders有内容时才设置currentFolder
            if (config.recentFolders && config.recentFolders.length > 0) {
                console.log('设置currentFolder为:', config.recentFolders[0].path);
                setCurrentFolder(config.recentFolders[0].path);
            } else {
                console.log('recentFolders为空，不设置currentFolder');
            }
            if (window.electronAPI) {
                window.electronAPI.saveConfig(config);
            }
        }
        setLoading(false);
    }, [config]);

    useEffect(() => {
        console.log('currentFolder changed', currentFolder);
        if (currentFolder) {
            setLoading(true);
            loadFolderTree().then(() => {
                setLoading(false);
            })
            setCurrentFile(null)
            setConfig(updateFolderPath(config, currentFolder))
        } else {
            console.log('currentFolder为空，清空相关状态');
            setFileTree(null)
            setSelectedKeys([]);
            setCurrentFile(null);
            setSelectedInfo(null);
        }
    }, [currentFolder]);

    async function loadFolderTree() {
        console.log('loading folder tree, currentFolder:', currentFolder);
        if (currentFolder && window.electronAPI) {
            try {
                setLoading(true);
                const tree = await window.electronAPI.getFileTree(currentFolder);
                console.log('获取到文件树:', tree);
                setFileTree(tree);
            } catch (error) {
                console.error('选择文件夹失败:', error);
                message.error('选择文件夹失败，请重试');
            } finally {
                setLoading(false);
            }
        } else {
            console.log('没有文件夹可加载或window.electronAPI不存在');
        }
    }

    // 处理选择文件夹
    const handleSelectDirectory = async () => {
        if (!window.electronAPI) {
            message.warning('此功能需要在 Electron 应用中使用');
            return;
        }
        
        try {
            setLoading(true);

            // 调用Electron API选择文件夹
            const dirPath = await window.electronAPI.selectDirectory();

            if (dirPath && config) {
                setConfig(updateFolderPath(config, dirPath))
            }
        } catch (error) {
            console.error('选择文件夹失败:', error);
            message.error('选择文件夹失败，请重试');
        } finally {
            setLoading(false);
        }
    };

    // 下拉菜单选项
    // 转换文件节点为Tree组件需要的数据格式
    const transformToTreeData = (node: FileNode): TreeNodeWithMeta => {
        const result: TreeNodeWithMeta = {
            title: node.name,
            key: node.id,
            icon: node.isDirectory ? <FolderOpenOutlined/> : <FileTextOutlined/>,
            meta: node,
            isLeaf: !node.isDirectory
        };

        if (node.isDirectory && node.children && node.children.length > 0) {
            result.children = node.children.map(transformToTreeData);
        }

        return result;
    };

    // 选择文件后读取内容
    const handleTreeSelect: TreeProps<TreeNodeWithMeta>['onSelect'] = async (keys, info) => {
        const stringKeys = keys.map(String);
        setSelectedKeys(stringKeys);

        if (!info || !info.node) {
            setCurrentFile(null);
            setSelectedInfo(null);
            return;
        }

        const nodeMeta: FileNode | undefined = info.node.meta;

        if (!nodeMeta) {
            return;
        }

        // 设置当前选择（文件或目录）
        setCurrentFile(nodeMeta);
        setSelectedInfo(null);

        // 获取右侧信息
        try {
            if (window.electronAPI?.getFileInfo) {
                const info = await window.electronAPI.getFileInfo(nodeMeta.path);
                setSelectedInfo(info);
            }
        } catch {
            // 忽略错误
        }
    };

    return (
        <ConfigProvider
            theme={{
                components: {
                    Splitter: {
                        splitBarDraggableSize: 0,
                    },
                },
            }}
        >
            {/*顶部透明区域 - 用于捕捉鼠标靠近顶部的事件，当标题栏隐藏时显示*/}
            {!titleBarVisible && (
                <div
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        height: 15,
                        backgroundColor: 'transparent',
                        zIndex: 200,
                        cursor: 'default'
                    }}
                    onMouseEnter={() => {
                        // 鼠标进入顶部区域时显示标题栏
                        setTitleBarVisible(true);
                    }}
                />
            )}

            {/*标题栏 - 条件渲染*/}
            {titleBarVisible && (
                <Flex
                    className={'top-bar'}
                    style={{height: 40, position: 'relative', zIndex: 100}}
                    align={'center'}
                >
                    <div style={{flex: '0 0 72px'}}></div>
                    <div style={{paddingRight: 16}}>
                        <Dropdown
                            menu={{
                                items: [
                                    {
                                        key: 'new',
                                        icon: <PlusOutlined/>,
                                        label: '选择新文件夹',
                                        onClick: handleSelectDirectory
                                    },
                                    ...recentFolders.length > 0 ? [
                                        {
                                            type: 'divider' as const
                                        },
                                        ...recentFolders.map((folder) => ({
                                            key: folder.path,
                                            icon: <FolderOpenOutlined/>,
                                            label: (
                                                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '300px'}}>
                                                    <div style={{flex: 1, display: 'flex', alignItems: 'center'}}>
                                                        <span title={folder.path}>{truncateFolderName(folder.name || '')}</span>
                                                    </div>
                                                    <span style={{fontSize: '12px', color: '#999', marginRight: '8px'}}>{new Date(folder.timestamp).toLocaleString('zh-CN', {
                                                        month: '2-digit',
                                                        day: '2-digit',
                                                        hour: '2-digit',
                                                        minute: '2-digit',
                                                        hour12: false
                                                    })}</span>
                                                    <DeleteOutlined
                                                        style={{fontSize: '14px', color: '#666', cursor: 'pointer', transition: 'all 0.3s'}}
                                                        title="从列表中删除"
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            setConfig(removeFolderPath(config, folder.path))
                                                        }}
                                                        onMouseEnter={(e) => {
                                                            e.currentTarget.style.transform = 'scale(1.6)';
                                                            e.currentTarget.style.color = '#ff4d4f';
                                                        }}
                                                        onMouseLeave={(e) => {
                                                            e.currentTarget.style.transform = 'scale(1)';
                                                            e.currentTarget.style.color = '#666';
                                                        }}
                                                    />
                                                </div>
                                            ),
                                            onClick: () => setConfig(updateFolderPath(config, folder.path))
                                        }))
                                    ] : []
                                ]
                            }}
                            placement="bottomLeft"
                        >
                            <Button
                                type="link"
                                loading={loading}
                            >
                                {fileTree ? truncateFolderName(fileTree.name) : '选择文件夹'} <DownOutlined/>
                            </Button>
                        </Dropdown>
                    </div>
                    <div style={{flex: '1 3 auto', minWidth: 0}}>
                        <div className="one-line">
                            {currentFile ? currentFile.name : ''}
                        </div>
                    </div>
                    <div style={{flex: '0 0 auto', paddingLeft: 16, paddingRight: 16, display: 'flex', alignItems: 'center'}}>
                        <Button
                            type="text"
                            icon={<EyeInvisibleOutlined/>}
                            title="隐藏标题栏"
                            onClick={() => {
                                // 点击按钮直接隐藏标题栏
                                setTitleBarVisible(false);
                            }}
                            style={{padding: 0, width: 24, height: 24, borderRadius: 4}}
                        />
                    </div>
                </Flex>
            )}
            <Splitter style={{height: titleBarVisible ? 'calc(100vh - 40px)' : '100vh'}}>
                <Splitter.Panel defaultSize={320} min={'10%'} max={'45%'} collapsible>
                    <div style={{height: '100%', backgroundColor: 'white', overflow: 'hidden', overflowY: 'scroll'}}>
                        {fileTree ? (
                            <Tree<TreeNodeWithMeta>
                                treeData={transformToTreeData(fileTree).children}
                                style={{maxHeight: '100%'}}
                                blockNode
                                showLine
                                switcherIcon={<DownOutlined/>}
                                selectedKeys={selectedKeys}
                                onSelect={handleTreeSelect}
                                defaultExpandAll={false}
                            />
                        ) : (
                            <div style={{textAlign: 'center', color: '#999', padding: 20}}>
                                请点击上方按钮选择文件夹
                            </div>
                        )}
                    </div>
                </Splitter.Panel>
                {/*panel 默认有个 padding 0 1，中间去掉，避免边缘一条白线。*/}
                <Splitter.Panel style={{padding: 0}}>
                    {currentFile ? (
                        <div style={{height: '100%', padding: 0, background: '#f7f7f7'}}>
                            <div style={{height: '100%'}}>
                                <FilePreview
                                    filePath={currentFile.path}
                                    fileName={currentFile.name}
                                />
                            </div>
                        </div>
                    ) : (
                        <div style={{height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999'}}>
                            请在左侧选择一个文件以预览内容
                        </div>
                    )}
                </Splitter.Panel>
                <Splitter.Panel defaultSize={320} min={'10%'} max={'45%'} collapsible>
                    <ToolWindowsPane />
                </Splitter.Panel>
            </Splitter>
        </ConfigProvider>
    );
};

export const App: React.FC = () => {
    console.log('App 组件开始渲染');
    return (
        <AppProvider>
            <AppContent />
        </AppProvider>
    );
};