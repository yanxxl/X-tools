import React, {useState, useEffect} from 'react';
import {Button, ConfigProvider, Dropdown, Flex, message, Splitter, Tree} from "antd";
import {DeleteOutlined, DownOutlined, EyeInvisibleOutlined, FolderOpenOutlined, PlusOutlined} from '@ant-design/icons';
import type {DataNode, TreeProps} from 'antd/es/tree';
import {FileNode, RecentFolder} from './types';
import {FileViewer} from './components/viewers/FileViewer';
import {ToolWindowsPane} from './components/windows/ToolWindowsPane';
import {AppProvider, useAppContext} from './contexts/AppContext';
import {truncateFolderName} from './utils/uiUtils';
import {Config, removeFolderPath, updateFolderPath} from "./utils/config";
import {Container} from "./components/common/Container";
import {Center} from "./components/common/Center";

// 为Tree组件定义的节点类型
export type TreeNodeWithMeta = DataNode & {
    meta: FileNode;
    children?: TreeNodeWithMeta[];
};

const AppContent: React.FC = () => {
    const {currentFolder, setCurrentFolder, currentFile, setCurrentFile} = useAppContext();

    const [loading, setLoading] = useState(false);
    const [config, setConfig] = useState<Config | null>(null);
    const [recentFolders, setRecentFolders] = useState<RecentFolder[]>([]);
    const [fileTree, setFileTree] = useState<FileNode | null>(null);
    const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
    const [titleBarVisible, setTitleBarVisible] = useState(true);
    const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
    const [loadedKeys, setLoadedKeys] = useState<Set<string>>(new Set()); // 记录已加载的节点

    // 加载配置文件
    useEffect(() => {
        setLoading(true);
        if (config == null) {
            if (window.electronAPI) {
                window.electronAPI.loadConfig().then(async (loadedConfig) => {
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
                setCurrentFolder(config.recentFolders[0].path);
            }
            if (window.electronAPI) {
                window.electronAPI.saveConfig(config);
            }
        }
        setLoading(false);
    }, [config]);

    useEffect(() => {
        if (currentFolder) {
            setLoading(true);
            loadFolderTree().then(() => {
                setLoading(false);
            })
            setCurrentFile(null)
            setConfig(updateFolderPath(config, currentFolder))
            // 切换文件夹时清空展开和加载状态
            setExpandedKeys([]);
            setLoadedKeys(new Set());
        } else {
            setFileTree(null)
            setSelectedKeys([]);
            setCurrentFile(null);
            setExpandedKeys([]);
            setLoadedKeys(new Set());
        }
    }, [currentFolder]);

    // 同步红绿灯显示状态与标题栏显示状态
    useEffect(() => {
        if (window.electronAPI?.setWindowButtonVisibility) {
            window.electronAPI.setWindowButtonVisibility(titleBarVisible);
        }
    }, [titleBarVisible]);

    async function loadFolderTree() {
        if (currentFolder && window.electronAPI) {
            try {
                setLoading(true);
                const tree = await window.electronAPI.getFileTree(currentFolder);
                setFileTree(tree);
            } catch (error) {
                console.error('选择文件夹失败:', error);
                message.error('选择文件夹失败，请重试');
            } finally {
                setLoading(false);
            }
        }
    }

    // 懒加载子节点
    const onLoadData = async (node: TreeNodeWithMeta): Promise<void> => {
        const {meta} = node;
        if (!meta.isDirectory || loadedKeys.has(meta.id)) {
            return;
        }

        try {
            setLoading(true);
            const children = await window.electronAPI!.getDirectoryChildren(meta.path);

            // 更新文件树中的子节点
            const updateNodeChildren = (node: FileNode): FileNode => {
                if (node.id === meta.id) {
                    return {
                        ...node,
                        children: children
                    };
                }
                if (node.children) {
                    return {
                        ...node,
                        children: node.children.map(updateNodeChildren)
                    };
                }
                return node;
            };

            setFileTree(prevTree => prevTree ? updateNodeChildren(prevTree) : null);
            setLoadedKeys(prev => new Set([...prev, meta.id]));
        } catch (error) {
            console.error('加载子节点失败:', error);
            message.error('加载子节点失败，请重试');
        } finally {
            setLoading(false);
        }
    };

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

    // 转换文件节点为Tree组件需要的数据格式
    const transformToTreeData = (node: FileNode): TreeNodeWithMeta => {
        const result: TreeNodeWithMeta = {
            title: (
                <div className={'one-line'} title={node.name}>
                    {node.name}
                </div>
            ),
            key: node.id,
            meta: node,
            isLeaf: !node.isDirectory
        };

        // 检查是否有未加载的子节点
        const hasUnloadedChildren = (node as any).hasUnloadedChildren;

        if (node.isDirectory && node.children && node.children.length > 0) {
            result.children = node.children.map(transformToTreeData);
        } else if (hasUnloadedChildren) {
            // 对于有未加载子节点的目录，不显示children，让antd显示可展开状态
            // 这样用户点击时会触发onLoadData
        }

        return result;
    };

    // 处理树节点展开
    const handleExpand: TreeProps<TreeNodeWithMeta>['onExpand'] = (expandedKeysValue) => {
        setExpandedKeys(expandedKeysValue as string[]);
    };

    // 选择文件后读取内容
    const handleTreeSelect: TreeProps<TreeNodeWithMeta>['onSelect'] = async (keys, info) => {
        const stringKeys = keys.map(String);
        setSelectedKeys(stringKeys);

        if (!info || !info.node) {
            setCurrentFile(null);
            return;
        }

        const nodeMeta: FileNode | undefined = info.node.meta;

        if (!nodeMeta) {
            return;
        }

        // 设置当前选择（文件或目录）
        setCurrentFile(nodeMeta);
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
                        height: 8,
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
                        <div className="one-line text-center">
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
                    <Container style={{overflowY: 'auto',backgroundColor:"white"}}>
                        {fileTree ? (
                            <Tree<TreeNodeWithMeta>
                                treeData={transformToTreeData(fileTree).children}
                                style={{maxHeight: '100%'}}
                                blockNode
                                showLine
                                switcherIcon={<DownOutlined/>}
                                selectedKeys={selectedKeys}
                                expandedKeys={expandedKeys}
                                onExpand={handleExpand}
                                onSelect={handleTreeSelect}
                                loadData={onLoadData}
                            />
                        ) : (
                            <Center style={{color: 'gray'}}>
                                请点击上方按钮选择文件夹
                            </Center>
                        )}
                    </Container>
                </Splitter.Panel>
                {/*panel 默认有个 padding 0 1，中间去掉，避免边缘一条白线。*/}
                <Splitter.Panel style={{padding: 0}}>
                    <Container>
                        {currentFile ? (
                            <FileViewer
                                filePath={currentFile.path}
                                fileName={currentFile.name}
                            />
                        ) : (
                            <Center style={{color: 'gray'}}>
                                请在左侧选择一个文件以预览内容
                            </Center>
                        )}
                    </Container>
                </Splitter.Panel>
                <Splitter.Panel defaultSize={320} min={'10%'} max={'45%'} collapsible>
                    <Container>
                        <ToolWindowsPane/>
                    </Container>
                </Splitter.Panel>
            </Splitter>
        </ConfigProvider>
    );
};

export const App: React.FC = () => {
    return (
        <AppProvider>
            <AppContent/>
        </AppProvider>
    );
};