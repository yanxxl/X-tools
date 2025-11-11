import React, {useState, useEffect} from 'react';
import {ConfigProvider, Splitter, Button, Tree, message, Space, Dropdown, MenuProps, Typography} from "antd";
import {DownOutlined, FolderOpenOutlined, PlusOutlined, DeleteOutlined, FileTextOutlined} from '@ant-design/icons';
import type { DataNode, TreeProps } from 'antd/es/tree';
import { FileNode } from './types';
import { RecentFolder, FileInfo } from './types/api';
import { FilePreview } from './components/FilePreview';

type TreeNodeWithMeta = (DataNode & { meta: FileNode; children?: TreeNodeWithMeta[] });

export const App: React.FC = () => {
    const [fileTree, setFileTree] = useState<FileNode | null>(null);
    const [loading, setLoading] = useState(false);
    const [recentFolders, setRecentFolders] = useState<RecentFolder[]>([]);
    const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
    const [selectedFile, setSelectedFile] = useState<FileNode | null>(null);
    const [selectedInfo, setSelectedInfo] = useState<FileInfo | null>(null);

    const { Text } = Typography;
    
    // 限制文件夹名称长度，中文10个字符以内，英文20个字符以内
    const truncateFolderName = (name: string): string => {
        // 计算字符串长度，中文字符计为1，英文字符计为0.5
        let length = 0;
        let result = '';
        
        for (let i = 0; i < name.length; i++) {
            const char = name[i];
            // 检查是否为中文字符（Unicode范围）
            const isChinese = /[\u4e00-\u9fa5]/.test(char);
            
            if (isChinese) {
                // 中文字符，占1个单位
                if (length + 1 <= 10) {
                    result += char;
                    length += 1;
                } else {
                    break;
                }
            } else {
                // 英文字符，占0.5个单位
                if (length + 0.5 <= 10) {
                    result += char;
                    length += 0.5;
                } else {
                    break;
                }
            }
        }
        
        // 如果有截断，添加省略号
        if (result.length < name.length) {
            return result + '...';
        }
        
        return result;
    };

    // 组件加载时获取最近文件夹列表和上次打开的文件夹
    useEffect(() => {
        loadRecentFolders().then(() => {
            loadLastOpenedFolder();
        });
    }, []);

    // 加载最近文件夹列表
    const loadRecentFolders = async () => {
        try {
            // 添加防御性检查
            if (!window.electronAPI || !window.electronAPI.getRecentFolders) {
                console.warn('electronAPI 不可用，使用模拟数据');
                // 使用模拟数据进行测试
                const mockFolders: RecentFolder[] = [
                    { path: '/mock/path1', name: '文件夹1', timestamp: Date.now() - 3600000 }, // 1小时前
                    { path: '/mock/path2', name: '测试文件夹2', timestamp: Date.now() - 7200000 }, // 2小时前
                    { path: '/mock/path3', name: '很长的中文文件夹名称测试', timestamp: Date.now() - 1800000 } // 30分钟前
                ];
                const sortedFolders = mockFolders.sort((a, b) => b.timestamp - a.timestamp);
                setRecentFolders(sortedFolders);
                return sortedFolders;
            }
            
            const folders = await window.electronAPI.getRecentFolders();
            // 按时间戳降序排序，确保最新的文件夹在前面
            const sortedFolders = folders.sort((a, b) => b.timestamp - a.timestamp);
            setRecentFolders(sortedFolders);
            console.log('最近文件夹列表:', sortedFolders);
            return sortedFolders;
        } catch (error) {
            console.error('获取最近文件夹失败:', error);
            // 出错时使用模拟数据
            const mockFolders: RecentFolder[] = [
                { path: '/mock/path1', name: '文件夹1', timestamp: Date.now() - 3600000 },
                { path: '/mock/path2', name: '测试文件夹2', timestamp: Date.now() - 7200000 },
                { path: '/mock/path3', name: '很长的中文文件夹名称测试', timestamp: Date.now() - 1800000 }
            ];
            const sortedFolders = mockFolders.sort((a, b) => b.timestamp - a.timestamp);
            setRecentFolders(sortedFolders);
            return sortedFolders;
        }
    };

    // 加载上次打开的文件夹
    const loadLastOpenedFolder = async () => {
        try {
            console.log('尝试加载上次打开的文件夹');
            
            // 添加防御性检查
            if (!window.electronAPI || !window.electronAPI.getLastOpenedFolder) {
                console.warn('electronAPI 不可用，直接使用第一个最近文件夹');
                useFirstRecentFolder();
                return;
            }
            
            const lastFolder = await window.electronAPI.getLastOpenedFolder();
            console.log('获取到的lastFolder:', lastFolder);
            
            if (lastFolder) {
                // 验证文件夹是否仍然存在
                try {
                    if (window.electronAPI && window.electronAPI.getFileTree) {
                        const tree = await window.electronAPI.getFileTree(lastFolder.path);
                        setFileTree(tree);
                        console.log(`自动加载上次打开的文件夹: ${lastFolder.name}`);
                    } else {
                        // 使用模拟的文件树数据
                        const mockTree: FileNode = {
                            id: lastFolder.path,
                            name: lastFolder.name,
                            path: lastFolder.path,
                            isDirectory: true,
                            children: []
                        };
                        setFileTree(mockTree);
                    }
                } catch (error) {
                    console.error('上次打开的文件夹不存在或无法访问:', error);
                    // 如果上次文件夹无法访问，尝试使用第一个最近文件夹
                    useFirstRecentFolder();
                }
            } else {
                console.log('没有找到lastOpenedFolder，尝试使用最近文件夹列表中的第一个');
                // 如果没有lastOpenedFolder但有recentFolders，使用第一个最近文件夹
                useFirstRecentFolder();
            }
        } catch (error) {
            console.error('获取上次打开文件夹失败:', error);
            // 出错时也尝试使用第一个最近文件夹
            useFirstRecentFolder();
        }
    };
    
    // 使用第一个最近文件夹
    const useFirstRecentFolder = async () => {
        if (recentFolders.length > 0) {
            try {
                const firstFolder = recentFolders[0];
                console.log(`尝试使用第一个最近文件夹: ${firstFolder.name}`);
                
                if (window.electronAPI && window.electronAPI.getFileTree) {
                    const tree = await window.electronAPI.getFileTree(firstFolder.path);
                    setFileTree(tree);
                    console.log(`已加载最近文件夹: ${firstFolder.name}`);
                } else {
                    // 使用模拟的文件树数据
                    const mockTree: FileNode = {
                        id: firstFolder.path,
                        name: firstFolder.name,
                        path: firstFolder.path,
                        isDirectory: true,
                        children: []
                    };
                    setFileTree(mockTree);
                    console.log(`已加载模拟的最近文件夹: ${firstFolder.name}`);
                }
            } catch (error) {
                console.error('加载第一个最近文件夹失败:', error);
                // 出错时使用模拟数据
                const firstFolder = recentFolders[0];
                const mockTree: FileNode = {
                    id: firstFolder.path,
                    name: firstFolder.name,
                    path: firstFolder.path,
                    isDirectory: true,
                    children: []
                };
                setFileTree(mockTree);
            }
        }
    };

    // 处理选择文件夹
    const handleSelectDirectory = async () => {
        try {
            setLoading(true);

            // 调用Electron API选择文件夹
            const dirPath = await window.electronAPI.selectDirectory();

            if (dirPath) {
                // 获取文件树结构
                const tree = await window.electronAPI.getFileTree(dirPath);
                setFileTree(tree);
                message.success(`已加载文件夹: ${tree.name}`);
                // 重新加载最近文件夹列表
                loadRecentFolders();
            }
        } catch (error) {
            console.error('选择文件夹失败:', error);
            message.error('选择文件夹失败，请重试');
        } finally {
            setLoading(false);
        }
    };

    // 从最近文件夹列表选择
    const handleSelectRecentFolder = async (folder: RecentFolder) => {
        try {
            setLoading(true);
            
            // 获取文件树结构
            const tree = await window.electronAPI.getFileTree(folder.path);
            setFileTree(tree);
            message.success(`已加载文件夹: ${folder.name}`);
            
            // 更新文件夹的最后打开时间
            if (window.electronAPI && window.electronAPI.updateFolderTimestamp) {
                await window.electronAPI.updateFolderTimestamp(folder.path);
            }
            // 重新加载最近文件夹列表，以更新时间戳和排序
            await loadRecentFolders();
        } catch (error) {
            console.error('加载文件夹失败:', error);
            message.error('加载文件夹失败，请重试');
        } finally {
            setLoading(false);
        }
    };

    // 处理删除最近文件夹
    const handleRemoveRecentFolder = async (folderPath: string, e: React.MouseEvent) => {
        e.stopPropagation(); // 阻止事件冒泡，避免触发文件夹选择
        
        try {
            if (window.electronAPI && window.electronAPI.removeRecentFolder) {
                await window.electronAPI.removeRecentFolder(folderPath);
                message.success('文件夹已从最近列表中删除');
                // 重新加载最近文件夹列表
                await loadRecentFolders();
                
                // 如果删除的是当前打开的文件夹，清空fileTree
                if (fileTree && fileTree.path === folderPath) {
                    setFileTree(null);
                }
            }
        } catch (error) {
            console.error('删除文件夹失败:', error);
            message.error('删除文件夹失败，请重试');
        }
    };
    
    // 下拉菜单选项
    const menuItems: MenuProps['items'] = [
        {
            key: 'new',
            icon: <PlusOutlined />,
            label: '选择新文件夹',
            onClick: handleSelectDirectory
        },
        ...recentFolders.length > 0 ? [
            {
                type: 'divider' as const
            },
            ...recentFolders.map((folder) => ({
                key: folder.path,
                icon: <FolderOpenOutlined />,
                label: (
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '300px'}}>
                        <div style={{flex: 1, display: 'flex', alignItems: 'center'}}>
                            <span title={folder.path}>{truncateFolderName(folder.name)}</span>
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
                            onClick={(e) => handleRemoveRecentFolder(folder.path, e)}
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
                onClick: () => handleSelectRecentFolder(folder)
            }))
        ] : []
    ];

    // 转换文件节点为Tree组件需要的数据格式
    const transformToTreeData = (node: FileNode): TreeNodeWithMeta => {
        const result: TreeNodeWithMeta = {
            title: node.name,
            key: node.id,
            icon: node.isDirectory ? <FolderOpenOutlined /> : <FileTextOutlined />,
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
            setSelectedFile(null);
            setSelectedInfo(null);
            return;
        }

        const nodeMeta: FileNode | undefined = info.node.meta;

        if (!nodeMeta) {
            return;
        }

        // 设置当前选择（文件或目录）
        setSelectedFile(nodeMeta);
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

    // 文件树变化时重置选择状态
    useEffect(() => {
        setSelectedKeys([]);
        setSelectedFile(null);
        setSelectedInfo(null);
    }, [fileTree?.id]);

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
            <Splitter style={{height: '100vh'}}>
                <Splitter.Panel defaultSize={320} min={80}>
                    <Space className={'top-bar'}>
                        <Dropdown menu={{ items: menuItems }} placement="bottomLeft">
                            <Button
                                type="link"
                                loading={loading}
                            >
                                {fileTree ? truncateFolderName(fileTree.name) : '选择文件夹'} <DownOutlined />
                            </Button>
                        </Dropdown>
                    </Space>
                    <div style={{padding: 16, height: 'calc(100% - 40px)', overflow: 'auto'}}>
                        {fileTree ? (
                            <Tree
                                treeData={[transformToTreeData(fileTree)]}
                                style={{maxHeight: '100%'}}
                                blockNode
                                showLine
                                switcherIcon={<DownOutlined/>}
                                showIcon
                                selectedKeys={selectedKeys}
                                onSelect={handleTreeSelect}
                            />
                        ) : (
                            <div style={{textAlign: 'center', color: '#999', padding: 20}}>
                                请点击上方按钮选择文件夹
                            </div>
                        )}
                    </div>
                </Splitter.Panel>
                <Splitter.Panel min={240}>
                    <div className={'top-bar'}>
                        {selectedFile ? truncateFolderName(selectedFile.name) : '中间区域'}
                    </div>
                    <div style={{height: 'calc(100% - 40px)', padding: 0}}>
                        {selectedFile ? (
                            <div style={{height: '100%', padding: 16, background: '#f7f7f7'}}>
                                <div style={{height: '100%'}}>
                                    <FilePreview
                                        filePath={selectedFile.path}
                                        fileName={selectedFile.name}
                                    />
                                </div>
                            </div>
                        ) : (
                            <div style={{height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999'}}>
                                请在左侧选择一个文件以预览内容
                            </div>
                        )}
                    </div>
                </Splitter.Panel>
                <Splitter.Panel defaultSize={320} min={80}>
                    <div className={'top-bar'}>右侧区域</div>
                    <div style={{padding: 16}}>
                        {selectedFile ? (
                            <div style={{display: 'flex', flexDirection: 'column', gap: 8}}>
                                <h3>基本信息</h3>
                                <div><Text type="secondary">名称：</Text>{selectedFile.name}</div>
                                <div style={{wordBreak: 'break-all'}}><Text type="secondary">路径：</Text>{selectedFile.path}</div>
                                <div><Text type="secondary">类型：</Text>{selectedFile.isDirectory ? '目录' : '文件'}</div>
                                {!selectedFile.isDirectory && selectedInfo && (
                                  <>
                                    <div><Text type="secondary">扩展名：</Text>{selectedInfo.ext || '-'}</div>
                                    <div><Text type="secondary">大小：</Text>{formatFileSize(selectedInfo.size)}</div>
                                  </>
                                )}
                                {selectedFile.isDirectory && selectedInfo && (
                                  <div><Text type="secondary">子项数量：</Text>{selectedInfo.childrenCount ?? 0}</div>
                                )}
                                {selectedInfo && (
                                    <>
                                        <div><Text type="secondary">创建日期：</Text>{formatDate(selectedInfo.ctimeMs)}</div>
                                        <div><Text type="secondary">修改日期：</Text>{formatDate(selectedInfo.mtimeMs)}</div>
                                        <div><Text type="secondary">访问日期：</Text>{formatDate(selectedInfo.atimeMs)}</div>
                                    </>
                                )}
                            </div>
                        ) : (
                            <div style={{color: '#999'}}>请选择一个文件或目录查看信息</div>
                        )}
                    </div>
                </Splitter.Panel>
            </Splitter>
        </ConfigProvider>
    );
};

function formatFileSize(size: number): string {
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
    return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
function formatDate(ms: number): string {
    try {
        return new Date(ms).toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });
    } catch {
        return '-';
    }
}
