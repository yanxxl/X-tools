import React, { useEffect, useState } from 'react';
import { ConfigProvider, message, Tree, Dropdown, type MenuProps, Flex, Space, Button, Input, Tooltip, Switch, Empty } from "antd";
import type { DataNode, TreeProps } from 'antd/es/tree';
import {
    DownOutlined, FileOutlined, FolderOpenOutlined,
    HomeOutlined, FolderAddOutlined, FileAddOutlined,
    ExpandOutlined, CompressOutlined, SearchOutlined,
    AimOutlined, CloseOutlined,
    LoadingOutlined
} from '@ant-design/icons';
import { FileNode } from '../../types';
import { useAppContext } from '../../contexts/AppContext';
import { FileIcon } from './FileIcon';
import { storage } from '../../utils/storage';
import { fullname } from '../../utils/fileCommonUtil';
import { highlightText } from '../../utils/highlight';
import { EditableFilePath } from './EditableFilePath';

export const FileTree: React.FC = () => {
    const { currentFolder, currentFile, setCurrentFile } = useAppContext();

    const [fileTree, setFileTree] = useState<FileNode | null>(null);
    const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
    const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
    const [initialLoading, setInitialLoading] = useState(false);
    const [showRootFolder, setShowRootFolder] = useState<boolean>(storage.get('filetree-show-root', false));
    const [searchText, setSearchText] = useState<string>('');
    const [debouncedSearchText, setDebouncedSearchText] = useState<string>('');
    const [showSearchBox, setShowSearchBox] = useState<boolean>(false);
    const [isExpanded, setIsExpanded] = useState<boolean>(false);
    const [dataNodeList, setDataNodeList] = useState<DataNode[]>([]);
    const [searchLoading, setSearchLoading] = useState<boolean>(false);
    const [searchResultCount, setSearchResultCount] = useState<number>(0);

    const getAllParentPaths = (filePath: string): string[] => {
        const parts = filePath.split(/[\\/]/).filter(part => part !== '');
        const parents: string[] = [];
        let currentPath = '';

        for (let i = 0; i < parts.length - 1; i++) {
            const separator = filePath.includes('\\') ? '\\' : '/';
            currentPath += (i === 0 ? '' : separator) + parts[i];
            if (i === 0 && filePath.startsWith(separator)) {
                currentPath = separator + currentPath;
            }
            parents.push(currentPath);
        }

        return parents;
    };
    
    // 检查文件是否存在于树节点列表中
    const isFileInNodeList = (filePath: string, nodes: DataNode[]): boolean => {
        for (const node of nodes) {
            if (node.key === filePath) {
                return true;
            }
            if (node.children && node.children.length > 0) {
                if (isFileInNodeList(filePath, node.children)) {
                    return true;
                }
            }
        }
        return false;
    };

    const getContextMenuItems = (node: FileNode): MenuProps['items'] => {
        const items: MenuProps['items'] = [];

        items.push({
            key: 'open',
            icon: <FileOutlined />,
            label: '打开',
            onClick: async () => {
                try {
                    await window.electronAPI.openFile(node.path);
                    message.success('文件已打开');
                } catch (error) {
                    console.error('打开文件失败:', error);
                    message.error('打开文件失败');
                }
            }
        });

        items.push({
            key: 'openInFolder',
            icon: <FolderOpenOutlined />,
            label: '在文件夹中显示',
            onClick: async () => {
                try {
                    await window.electronAPI.showItemInFolder(node.path);
                    message.success('文件夹已打开');
                } catch (error) {
                    console.error('打开文件夹失败:', error);
                    message.error('打开文件夹失败');
                }
            }
        });

        return items;
    };

    const transformToTreeDataNode = (node: FileNode, searchQuery?: string): DataNode => {
        const result: DataNode = {
            title: (
                <Dropdown
                    menu={{ items: getContextMenuItems(node) }}
                    trigger={['contextMenu']}
                >
                    <span
                        className="one-line"
                        title={node.name}
                        style={{ cursor: node.isDirectory ? 'pointer' : 'default', display: 'flex', alignItems: 'center' }}
                    >
                        <FileIcon
                            fileName={node.name}
                            isDirectory={node.isDirectory}
                        />
                        {searchQuery ? highlightText(node.name, searchQuery) : <EditableFilePath path={node.path} onRename={setCurrentFile} />}
                    </span>
                </Dropdown>
            ),
            key: node.id,
            isLeaf: !node.isDirectory
        };

        if (node.isDirectory && node.children && node.children.length > 0) {
            result.children = node.children.map(child => transformToTreeDataNode(child, searchQuery));
        }

        return result;
    };

    const onLoadData = async (node: DataNode): Promise<void> => {
        if (node.isLeaf) {
            return;
        }

        try {
            const children = await window.electronAPI.getDirectoryChildren(node.key as string);
            const newChildren = children.map(child => transformToTreeDataNode(child));

            const updateChildrenInNodeList = (nodes: DataNode[]): DataNode[] => {
                return nodes.map(n => {
                    if (n.key === node.key) {
                        return {
                            ...n,
                            children: newChildren
                        };
                    }
                    if (n.children) {
                        return {
                            ...n,
                            children: updateChildrenInNodeList(n.children)
                        };
                    }
                    return n;
                });
            };

            setDataNodeList(prev => updateChildrenInNodeList(prev));
        } catch (error) {
            console.error('加载子节点失败:', error);
            message.error('加载子节点失败，请重试');
        }
    };

    async function loadFileTree() {
        console.log('loadFileTree', currentFolder);
        if (currentFolder) {
            try {
                const startTime = performance.now();
                const tree = await window.electronAPI.getFileTree(currentFolder);
                const endTime = performance.now();
                console.log(`getFileTree 耗时: ${endTime - startTime}ms`);
                setFileTree(tree);
            } catch (error) {
                console.error('加载文件树失败:', error);
                message.error('加载文件树失败，请重试');
            }
        } else {
            console.error('没有当前文件夹:');
        }
    }

    const resetTree = (filePath?: string) => {
        setDataNodeList([]);
        setSelectedKeys([]);
        setExpandedKeys([]);
        setFileTree(null);

        setTimeout(() => {
            if (currentFolder) {
                if (showRootFolder) {
                    const rootFileNode: FileNode = {
                        id: currentFolder,
                        name: fullname(currentFolder),
                        path: currentFolder,
                        isDirectory: true,
                        children: []
                    };
                    const rootDataNode = transformToTreeDataNode(rootFileNode);
                    setDataNodeList([rootDataNode]);
                    setExpandedKeys([rootDataNode.key as string]);
                } else {
                    setInitialLoading(true);
                    window.electronAPI.getDirectoryChildren(currentFolder).then((children) => {
                        setDataNodeList(children.map(child => transformToTreeDataNode(child)));
                        setInitialLoading(false);
                    });
                }

                // 如果提供了文件路径，聚焦到该文件
                if (filePath) {
                    setTimeout(() => {
                        setCurrentFile(filePath);
                        setSelectedKeys([filePath]);
                        const parentPaths = getAllParentPaths(filePath);
                        setExpandedKeys(prev => Array.from(new Set([...prev, ...parentPaths])));
                    }, 100);
                }
            }
        }, 10);
    };

    const handleTreeSelect: TreeProps<DataNode>['onSelect'] = async (_, info) => {
        if (info.node && info.node.isLeaf) {
            setCurrentFile(info.node.key as string);
            setSelectedKeys([info.node.key as string]);
        }
    };

    const handleTreeExpand: TreeProps<DataNode>['onExpand'] = async (expandedKeysValue) => {
        setExpandedKeys(expandedKeysValue as string[]);
    };

    const handleShowRootToggle = (checked: boolean) => {
        setShowRootFolder(checked);
        storage.set('filetree-show-root', checked);
    };

    const handleToggleExpand = () => {
        setIsExpanded(!isExpanded);
    };

    const handleFocusCurrent = () => {
        if (currentFile) {
            const parentPaths = getAllParentPaths(currentFile);
            setExpandedKeys(parentPaths);
            setSelectedKeys([currentFile]);
        }
    };

    const handleCreateFile = async (folderPath?: string | React.MouseEvent<HTMLElement>) => {
        const targetFolder = typeof folderPath === 'string' ? folderPath : currentFolder;
        if (!targetFolder) return;

        try {
            const result = await window.electronAPI.addFile(targetFolder);
            if (result.success && result.filePath) {
                message.success('文件创建成功');
                // 更新树结构并聚焦到新文件
                resetTree(result.filePath);
            } else {
                message.error('文件创建失败');
            }
        } catch (error) {
            console.error('创建文件失败:', error);
            message.error('文件创建失败');
        }
    };

    const handleCreateFolder = async (folderPath?: string | React.MouseEvent<HTMLElement>) => {
        const targetFolder = typeof folderPath === 'string' ? folderPath : currentFolder;
        if (!targetFolder) return;

        try {
            const result = await window.electronAPI.addFolder(targetFolder);
            if (result.success && result.folderPath) {
                message.success('文件夹创建成功');
                // 更新树结构
                resetTree(result.folderPath);
            } else {
                message.error('文件夹创建失败');
            }
        } catch (error) {
            console.error('创建文件夹失败:', error);
            message.error('文件夹创建失败');
        }
    };

    useEffect(() => {
        resetTree();
    }, [currentFolder, showRootFolder]);

    useEffect(() => {        
        if (selectedKeys.includes(currentFile)) return;

        setTimeout(() => {
            if (currentFile) {
                // 检查文件是否存在于树节点列表中
                const fileExists = isFileInNodeList(currentFile, dataNodeList);
                
                if (fileExists) {
                    // 文件存在，设置选中状态并展开父节点
                    setSelectedKeys([currentFile]);
                    const parentPaths = getAllParentPaths(currentFile);
                    const newExpandedKeys = Array.from(new Set([...expandedKeys, ...parentPaths]));
                    setExpandedKeys(newExpandedKeys);
                } else {
                    // 文件不存在，刷新树结构
                    resetTree(currentFile);
                    setSelectedKeys([currentFile]);
                }
            } else {
                setSelectedKeys([]);
            }
        }, 500);
    }, [currentFile, dataNodeList]);

    useEffect(() => {
        const debouncedSearch = (text: string) => {
            const timer = setTimeout(() => {
                setDebouncedSearchText(text);
            }, 500);

            return () => clearTimeout(timer);
        };

        const cleanup = debouncedSearch(searchText);
        return cleanup;
    }, [searchText]);

    useEffect(() => {
        if (debouncedSearchText.trim() && fileTree) {
            setSearchLoading(true);

            setTimeout(() => {
                const searchTerm = debouncedSearchText.trim().toLowerCase();
                let resultCount = 0;
                let searchResults: FileNode | null = null;

                const traverse = (node: FileNode): FileNode | null => {
                    const nodeMatches = node.name.toLowerCase().includes(searchTerm);

                    const filteredChildren: FileNode[] = [];
                    if (node.isDirectory && node.children) {
                        for (const child of node.children) {
                            const filteredChild = traverse(child);
                            if (filteredChild) {
                                filteredChildren.push(filteredChild);
                            }
                        }
                    }

                    if (nodeMatches || filteredChildren.length > 0) {
                        if (nodeMatches) {
                            resultCount += 1;
                        }
                        return {
                            ...node,
                            children: filteredChildren.length > 0 ? filteredChildren : undefined
                        };
                    }

                    return null;
                };

                searchResults = fileTree ? traverse(fileTree) : null;

                if (searchResults) {
                    const fileNodes = showRootFolder ? [searchResults] : searchResults.children || [];
                    const searchDataNodes = fileNodes.map(node => transformToTreeDataNode(node, debouncedSearchText.trim()));
                    setDataNodeList(searchDataNodes);
                    if (resultCount <= 300) {
                        const getSearchResultKeys = (nodes: DataNode[]): string[] => {
                            const keys: string[] = [];
                            nodes.forEach(node => {
                                if (node.children && node.children.length > 0) {
                                    keys.push(node.key as string);
                                    keys.push(...getSearchResultKeys(node.children));
                                }
                            });
                            return keys;
                        };
                        setExpandedKeys(getSearchResultKeys(searchDataNodes));
                    } else {
                        setExpandedKeys([searchDataNodes[0].key as string]);
                    }
                } else {
                    setDataNodeList([]);
                    setExpandedKeys([]);
                    resultCount = 0;
                }
                setSearchResultCount(resultCount);
                setSearchLoading(false);
            }, 10);
        } else {
            setSearchLoading(false);
            setSearchResultCount(0);
        }
    }, [debouncedSearchText]);

    useEffect(() => {
        const handleExpandCollapse = async () => {
            if (isExpanded) {
                const tree = await window.electronAPI.getFileTree(currentFolder);
                if (tree) {
                    const rootDataNode = transformToTreeDataNode(tree);
                    setDataNodeList(showRootFolder ? [rootDataNode] : rootDataNode.children || []);

                    const getAllNonLeafKeys = (node: DataNode): string[] => {
                        const keys: string[] = [];
                        if (node.children && node.children.length > 0) {
                            keys.push(node.key as string);

                            for (const child of node.children) {
                                keys.push(...getAllNonLeafKeys(child));
                            }
                        }
                        return keys;
                    };

                    const allKeys = getAllNonLeafKeys(rootDataNode);
                    setExpandedKeys(allKeys);
                }
            } else {
                setExpandedKeys([]);
            }
            setInitialLoading(false);
        };

        setInitialLoading(true);
        setTimeout(() => {
            handleExpandCollapse();
        }, 10);
    }, [isExpanded]);

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{
                borderBottom: '1px solid #f0f0f0',
                backgroundColor: '#fafafa'
            }}>
                {!showSearchBox ? (
                    <div style={{
                        padding: '8px 12px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                    }}>
                        <Space align="center">
                            <Tooltip title="显示主目录">
                                <Switch
                                    size="small"
                                    checked={showRootFolder}
                                    onChange={handleShowRootToggle}
                                    checkedChildren={<HomeOutlined />}
                                    unCheckedChildren={<HomeOutlined />}
                                />
                            </Tooltip>

                            <Tooltip title="创建文件">
                                <Button
                                    size="small"
                                    icon={<FileAddOutlined />}
                                    onClick={handleCreateFile}
                                    type="text"
                                />
                            </Tooltip>
                            <Tooltip title="创建文件夹">
                                <Button
                                    size="small"
                                    icon={<FolderAddOutlined />}
                                    onClick={handleCreateFolder}
                                    type="text"
                                />
                            </Tooltip>
                        </Space>

                        <Space align="center">
                            <Tooltip title="搜索文件">
                                <Button
                                    size="small"
                                    icon={<SearchOutlined />}
                                    onClick={() => {
                                        setShowSearchBox(true)
                                        loadFileTree();
                                    }}
                                    type="text"
                                />
                            </Tooltip>

                            <Tooltip title={isExpanded ? "折叠所有" : "展开所有"}>
                                <Button
                                    size="small"
                                    icon={isExpanded ? <CompressOutlined /> : <ExpandOutlined />}
                                    onClick={handleToggleExpand}
                                    type="text"
                                />
                            </Tooltip>

                            <Tooltip title="聚焦当前文件">
                                <Button
                                    size="small"
                                    icon={<AimOutlined />}
                                    onClick={handleFocusCurrent}
                                    type="text"
                                    disabled={!currentFile}
                                />
                            </Tooltip>
                        </Space>
                    </div>
                ) : (
                    <div style={{
                        padding: '8px 12px'
                    }}>
                        <Input
                            size="small"
                            placeholder="搜索文件..."
                            prefix={<SearchOutlined />}
                            value={searchText}
                            onChange={(e) => setSearchText(e.target.value)}
                            suffix={
                                <Space size="small">
                                    {searchLoading && <LoadingOutlined spin />}
                                    {!searchLoading && searchResultCount > 0 && (
                                        <span style={{ fontSize: '12px', color: '#666' }}>
                                            {searchResultCount} 个结果
                                        </span>
                                    )}
                                    <Button
                                        size="small"
                                        icon={<CloseOutlined />}
                                        onClick={() => {
                                            setShowSearchBox(false);
                                            setSearchText('');
                                            setDebouncedSearchText('');
                                            setSearchResultCount(0);
                                            resetTree();
                                        }}
                                        type="text"
                                    />
                                </Space>
                            }
                            style={{ width: '100%' }}
                            autoFocus
                        />
                    </div>
                )}
            </div>

            <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
                <ConfigProvider theme={{ token: { colorBgContainer: 'transparent' } }}>
                    {initialLoading ? (
                        <Flex style={{ height: '100%' }} align="center" justify="center">
                            <LoadingOutlined style={{ fontSize: 24 }} spin />
                        </Flex>
                    ) : dataNodeList.length > 0 ? (
                        <Tree<DataNode>
                            treeData={dataNodeList}
                            blockNode
                            showLine
                            switcherIcon={<DownOutlined />}
                            selectedKeys={selectedKeys}
                            expandedKeys={expandedKeys}
                            onSelect={handleTreeSelect}
                            onExpand={handleTreeExpand}
                            loadData={onLoadData}
                            expandAction="click"
                            style={{ padding: '8px 0' }}
                        />
                    ) : (
                        <Flex style={{ height: '100%' }} align="center" justify="center">
                            <Empty
                                description={
                                    debouncedSearchText.trim() ? "没有找到匹配的文件或文件夹" : "没有可显示的内容"
                                }
                            />
                        </Flex>
                    )}
                </ConfigProvider>
            </div>
        </div>
    );
};