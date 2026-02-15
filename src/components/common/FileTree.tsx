import React, { useEffect, useState, useRef } from 'react';
import { ConfigProvider, message, Tree, Dropdown, type MenuProps, Flex, Space, Button, Input, Tooltip, Switch, Empty, Modal } from "antd";
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
import { basename } from '../../utils/fileCommonUtil';
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
    const [loadedKeys, setLoadedKeys] = useState<string[]>([]);

    // 使用 ref 来避免闭包陷阱
    const currentFileRef = useRef<string | null>(null);
    currentFileRef.current = currentFile;

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
            onClick: async (e) => {
                e.domEvent.stopPropagation();
                try {
                    await window.electronAPI.openFile(node.path);
                    message.success('文件已打开');
                } catch (error) {
                    console.error('打开文件失败:', error);
                    message.error('打开失败');
                }
            }
        });

        items.push({
            key: 'openInFolder',
            icon: <FolderOpenOutlined />,
            label: '打开文件夹',
            onClick: async (e) => {
                e.domEvent.stopPropagation();
                try {
                    await window.electronAPI.showItemInFolder(node.path);
                    message.success('文件夹已打开');
                } catch (error) {
                    console.error('打开文件夹失败:', error);
                    message.error('打开失败');
                }
            }
        });

        // 添加一个分隔线
        items.push({
            key: 'divider',
            type: 'divider'
        });

        // 如果是文件夹，添加新建文件和新建文件夹选项
        if (node.isDirectory) {
            items.push({
                key: 'newFile',
                icon: <FileAddOutlined />,
                label: '新建文件',
                onClick: async (e) => {
                    e.domEvent.stopPropagation();
                    try {
                        await handleCreateFile(node.path);
                    } catch (error) {
                        console.error('新建文件失败:', error);
                        message.error('新建失败');
                    }
                }
            });

            items.push({
                key: 'newFolder',
                icon: <FolderAddOutlined />,
                label: '新建文件夹',
                onClick: async (e) => {
                    e.domEvent.stopPropagation();
                    try {
                        await handleCreateFolder(node.path);
                    } catch (error) {
                        console.error('新建文件夹失败:', error);
                        message.error('新建失败');
                    }
                }
            });

            // 添加分隔线
            items.push({
                key: 'divider-new',
                type: 'divider'
            });
        }

        items.push({
            key: 'rename',
            icon: <FileOutlined />,
            label: '重命名',
            disabled: node.path === currentFolder, // 主目录不可重命名
            onClick: async (e) => {
                e.domEvent.stopPropagation();
                try {
                    // 触发文件名的双击编辑功能
                    const escapedPath = node.path.replace(/\\/g, '\\\\');
                    const element = document.querySelector(`[data-file-path="${escapedPath}"]`);
                    if (element) {
                        element.dispatchEvent(new MouseEvent('dblclick', {
                            view: window,
                            bubbles: true,
                            cancelable: true
                        }));
                    }
                } catch (error) {
                    console.error('触发改名失败:', error);
                    message.error('重命名失败');
                }
            }
        });

        // 添加删除菜单项（根目录不可删除）
        items.push({
            key: 'delete',
            icon: <FileOutlined />,
            label: '删除',
            disabled: node.path === currentFolder, // 主目录不可删除
            onClick: async (e) => {
                e.domEvent.stopPropagation();
                try {
                    // 显示删除确认对话框
                    Modal.confirm({
                        title: '确认删除',
                        content: (
                            <div>
                                <p>确定要删除 "{node.name}" 吗？</p>
                                <p style={{ color: '#ff4d4f', fontSize: '12px', marginTop: '4px' }}>
                                    此操作会将文件移动到回收站。
                                </p>
                            </div>
                        ),
                        okText: '确认删除',
                        okType: 'danger',
                        cancelText: '取消',
                        onOk: async () => {
                            try {
                                const success = await window.electronAPI.removeFile(node.path);
                                if (success) {
                                    message.success('文件已删除');

                                    // 如果删除的是当前预览的文件，设置当前文件为null
                                    console.log('currentFile:', currentFileRef.current, node.path);
                                    if (currentFileRef.current === node.path) {
                                        setCurrentFile(null);
                                    }

                                    // 刷新文件树
                                    resetTree();
                                    setTimeout(() => {
                                        setExpandedKeys(getAllParentPaths(node.path));
                                    }, 100);
                                } else {
                                    message.error('删除失败，请重试');
                                }
                            } catch (error) {
                                console.error('删除文件失败:', error);
                                message.error('删除失败');
                            }
                        }
                    });
                } catch (error) {
                    console.error('删除操作失败:', error);
                    message.error('删除失败');
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
            message.error('加载失败，请重试');
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
                message.error('加载失败，请重试');
            }
        } else {
            console.error('没有当前文件夹:');
        }
    }

    const resetTree = (filePath?: string) => {
        console.log('resetTree', filePath);
        if (currentFolder) {
            if (showRootFolder) {
                const rootFileNode: FileNode = {
                    id: currentFolder,
                    name: basename(currentFolder),
                    path: currentFolder,
                    isDirectory: true,
                    children: []
                };
                const rootDataNode = transformToTreeDataNode(rootFileNode);
                setDataNodeList([rootDataNode]);
            } else {
                setInitialLoading(true);
                window.electronAPI.getDirectoryChildren(currentFolder).then((children) => {
                    setDataNodeList(children.map(child => transformToTreeDataNode(child)));
                    setInitialLoading(false);
                });
            }

            setSelectedKeys([]);
            setExpandedKeys([]);
            setLoadedKeys([]);

            // 如果提供了文件路径，聚焦到该文件
            if (filePath) setCurrentFile(filePath);
            setTimeout(() => {
                handleFocusCurrent();
            }, 100);
        }
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

    const handleLoadedKeys: TreeProps<DataNode>['onLoad'] = (loadedKeysValue) => {
        setLoadedKeys(loadedKeysValue as string[]);
    };

    const handleDrop: TreeProps<DataNode>['onDrop'] = async (info) => {
        const { dragNode, node: dropNode, dropToGap } = info;

        const dragPath = dragNode.key as string;
        const dropPath = dropNode.key as string;

        console.log('dragPath', dragPath);
        console.log('dropPath', dropPath);
        console.log('dropToGap', dropToGap);
        console.log('dropNode.isLeaf', dropNode.isLeaf);
        try {
            // 确定目标路径
            let targetPath: string;
            const fileName = dragPath.split(/[\\/]/).pop() || '';

            // 根据 dropNode 是否是叶子节点和 dropToGap 来决定目标路径
            if (dropNode.isLeaf) {
                // 拖拽到文件上
                if (!dropToGap) {
                    // leaf + 非gap：拖拽到文件上，提示不能放到文件里
                    message.error('只能拖拽到文件夹中');
                    return;
                } else {
                    // leaf + gap：拖拽到文件之间的间隙，移动到父文件夹
                    const parentPath = dropPath.split(/[\\/]/).slice(0, -1).join(dropPath.includes('\\') ? '\\' : '/');
                    targetPath = parentPath;
                }
            } else {
                // 拖拽到文件夹上
                if (dropToGap) {
                    // 非leaf + gap：拖拽到文件夹之间的间隙，移动到父文件夹
                    const parentPath = dropPath.split(/[\\/]/).slice(0, -1).join(dropPath.includes('\\') ? '\\' : '/');
                    // 检查是否是根目录（主文件夹）
                    if (dropPath === currentFolder) {
                        message.error('不能移动到主文件夹外');
                        return;
                    }
                    targetPath = parentPath;
                } else {
                    // 非leaf + 非gap：拖拽到文件夹上，移动到该文件夹内
                    targetPath = dropPath;
                }
            }

            // 构建完整的目标路径
            const separator = targetPath.includes('\\') ? '\\' : '/';
            const finalTargetPath = targetPath + (targetPath.endsWith(separator) ? '' : separator) + fileName;

            // 检查是否可以移动（不能移动到自身或其子目录）
            if (dragPath === finalTargetPath || finalTargetPath.startsWith(dragPath + separator)) {
                message.error('不能移动到自身或其子目录');
                return;
            }

            // 检查目标路径是否已存在同名文件/文件夹
            try {
                const exists = await window.electronAPI.fileExists(finalTargetPath);
                if (exists) {
                    message.error(`目标位置已存在同名文件或文件夹: ${fileName}`);
                    return;
                }
            } catch (error) {
                // 文件不存在是正常情况，继续执行
            }

            // 执行移动操作
            const success = await window.electronAPI.moveFile(dragPath, finalTargetPath);
            if (success) {
                message.success('文件移动成功');

                // 如果移动的是当前预览的文件，更新当前文件路径
                if (currentFileRef.current === dragPath) {
                    setCurrentFile(finalTargetPath);
                }

                // 刷新文件树
                resetTree();

                // 移动完成后自动展开文件树中的相关文件夹，方便用户查看结果
                setTimeout(() => {
                    // 确定要展开的文件夹路径
                    const folderToExpand = dropToGap ? targetPath : dropPath;

                    // 将目标文件夹添加到展开的键列表中
                    setExpandedKeys(prev => {
                        const newExpandedKeys = new Set(prev);
                        newExpandedKeys.add(folderToExpand);
                        const parentPaths = getAllParentPaths(folderToExpand);
                        parentPaths.forEach(path => newExpandedKeys.add(path));
                        return Array.from(newExpandedKeys);
                    });

                    // 如果移动的是文件，也选中它
                    if (dragNode.isLeaf) {
                        setSelectedKeys([finalTargetPath]);
                    }
                }, 100);
            } else {
                message.error('移动失败');
            }
        } catch (error) {
            console.error('移动文件失败:', error);
            // 提供更具体的错误信息
            if (error.message.includes('ENOTEMPTY')) {
                message.error('目标文件夹非空');
            } else if (error.message.includes('EISDIR')) {
                message.error('不能移动到目录路径');
            } else {
                message.error('移动失败');
            }
        }
    };

    const handleShowRootToggle = () => {
        const newValue = !showRootFolder;
        setShowRootFolder(newValue);
        storage.set('filetree-show-root', newValue);
    };

    const handleToggleExpand = () => {
        setIsExpanded(!isExpanded);
    };

    const handleFocusCurrent = () => {
        console.log('handleFocusCurrent', currentFile);
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
                message.error('创建失败');
            }
        } catch (error) {
            console.error('创建文件失败:', error);
            message.error('创建失败');
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
                message.error('创建失败');
            }
        } catch (error) {
            console.error('创建文件夹失败:', error);
            message.error('创建失败');
        }
    };

    useEffect(() => {
        resetTree();
    }, [currentFolder, showRootFolder]);

    useEffect(() => {
        if (!currentFile) return;

        // 检查文件是否存在于树节点列表中，用于新建文件，重命名文件等情况
        const fileExists = isFileInNodeList(currentFile, dataNodeList);
        if (!fileExists) {
            resetTree(currentFile);
            return;
        }

        if (selectedKeys.includes(currentFile)) return;

        setTimeout(() => {
            if (currentFile) {
                // 设置选中状态并展开父节点，并保留当前展开状态
                setSelectedKeys([currentFile]);
                const parentPaths = getAllParentPaths(currentFile);
                const newExpandedKeys = Array.from(new Set([...expandedKeys, ...parentPaths]));
                setExpandedKeys(newExpandedKeys);
            }
        }, 100);
    }, [currentFile]);

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
                // backgroundColor: '#fafafa',
                margin: '8px 0px 0px 0px'
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
                                <Button
                                    size="small"
                                    icon={<HomeOutlined />}
                                    onClick={handleShowRootToggle}
                                    type={showRootFolder ? "primary" : "text"}
                                    ghost
                                />
                            </Tooltip>

                            <Tooltip title="创建文件">
                                <Button
                                    size="small"
                                    icon={<FileAddOutlined />}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleCreateFile();
                                    }}
                                    type="text"
                                />
                            </Tooltip>
                            <Tooltip title="创建文件夹">
                                <Button
                                    size="small"
                                    icon={<FolderAddOutlined />}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleCreateFolder();
                                    }}
                                    type="text"
                                />
                            </Tooltip>
                        </Space>

                        <Space align="center">
                            <Tooltip title="搜索文件">
                                <Button
                                    size="small"
                                    icon={<SearchOutlined />}
                                    onClick={(e) => {
                                        e.stopPropagation();
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
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleToggleExpand();
                                    }}
                                    type="text"
                                />
                            </Tooltip>

                            <Tooltip title="聚焦当前文件">
                                <Button
                                    size="small"
                                    icon={<AimOutlined />}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleFocusCurrent();
                                    }}
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
                                        onClick={(e) => {
                                            e.stopPropagation();
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
                            loadedKeys={loadedKeys}
                            onSelect={handleTreeSelect}
                            onExpand={handleTreeExpand}
                            loadData={onLoadData}
                            onLoad={handleLoadedKeys}
                            onDrop={handleDrop}
                            draggable={{ icon: false }}
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