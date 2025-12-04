import React, {useCallback, useEffect, useState} from 'react';
import {ConfigProvider, message, Tree} from "antd";
import type {DataNode, TreeProps} from 'antd/es/tree';
import {FileNode} from '../../types';
import {detectFileType} from '../../utils/fileType';
import {useAppContext} from '../../contexts/AppContext';
import {DownOutlined, FileImageOutlined, FileOutlined, FilePdfOutlined, FileTextOutlined, FolderOutlined, PlayCircleOutlined} from '@ant-design/icons';

// 为Tree组件定义的节点类型
export type TreeNodeWithMeta = DataNode & {
    meta: FileNode; children?: TreeNodeWithMeta[];
};

export const FileTree: React.FC = () => {
    const {currentFolder, currentFile, setCurrentFile} = useAppContext();
    const [fileList, setFileList] = useState<FileNode[]>([]); // 存储当前目录下的文件列表
    const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
    const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
    const [loadedKeys, setLoadedKeys] = useState<Set<string>>(new Set()); // 记录已加载的节点
    const [initialLoading, setInitialLoading] = useState(false); // 仅用于第一次加载

    // 监听currentFile的变化并更新树节点选中状态
    useEffect(() => {
        if (selectedKeys.includes(currentFile)) return; // 避免重复更新
        // 延后更新，让视图先渲染
        setTimeout(() => {
            if (currentFile && fileList.length > 0) {
                // 设置文件树中对应节点为选中状态
                setSelectedKeys([currentFile]);

                // 展开所有父级目录，确保选中的文件可见
                const getAllParentPaths = (filePath: string): string[] => {
                    // 处理Windows和Unix路径分隔符
                    const parts = filePath.split(/[\\/]/).filter(part => part !== '');
                    const parents: string[] = [];
                    let currentPath = '';

                    // 从根目录开始构建每一级父目录路径
                    for (let i = 0; i < parts.length - 1; i++) {
                        // 保持原始路径分隔符，解决跨平台路径问题
                        const separator = filePath.includes('\\') ? '\\' : '/';
                        currentPath += (i === 0 ? '' : separator) + parts[i];
                        // 确保根目录路径格式正确
                        if (i === 0 && filePath.startsWith(separator)) {
                            currentPath = separator + currentPath;
                        }
                        parents.push(currentPath);
                    }

                    return parents;
                };

                // 获取所有父级目录路径并展开它们
                const parentPaths = getAllParentPaths(currentFile);
                // 只保留父目录路径，不包含文件本身，并与现有expandedKeys合并
                const newExpandedKeys = Array.from(new Set([...expandedKeys, ...parentPaths]));
                setExpandedKeys(newExpandedKeys);
            } else {
                // 如果没有选中文件，清空选中状态
                setSelectedKeys([]);
            }
        }, 500)
    }, [currentFile, fileList]);

    // 当文件夹改变时加载文件列表
    useEffect(() => {
        if (currentFolder) {
            loadFileList().then();
        } else {
            setFileList([]);
            setSelectedKeys([]);
            setExpandedKeys([]);
            setLoadedKeys(new Set());
        }
    }, [currentFolder]);

    // 根据文件类型获取对应图标
    const getFileIcon = useCallback((node: FileNode) => {
        if (node.isDirectory) {
            return <FolderOutlined style={{marginRight: 8}}/>;
        }
        const fileType = detectFileType(node.name);
        switch (fileType) {
            case 'text':
                return <FileTextOutlined style={{marginRight: 8}}/>;
            case 'image':
                return <FileImageOutlined style={{marginRight: 8}}/>;
            case 'video':
                return <PlayCircleOutlined style={{marginRight: 8}}/>;
            case 'pdf':
                return <FilePdfOutlined style={{marginRight: 8}}/>;
            default:
                return <FileOutlined style={{marginRight: 8}}/>;
        }
    }, []);

    // 加载当前目录下的文件列表
    async function loadFileList() {
        if (currentFolder && window.electronAPI) {
            try {
                setInitialLoading(true); // 只在第一次加载时显示加载状态
                // 直接获取当前目录的子文件列表，而不是整个文件树
                const children = await window.electronAPI.getDirectoryChildren(currentFolder);
                setFileList(children);
            } catch (error) {
                console.error('加载文件列表失败:', error);
                message.error('加载文件列表失败，请重试');
            } finally {
                setInitialLoading(false);
            }
        }
    }

    // 转换文件节点为Tree组件需要的数据格式
    const transformToTreeData = (node: FileNode): TreeNodeWithMeta => {
        const result: TreeNodeWithMeta = {
            title: (<div
                className={'one-line'}
                title={node.name}
                style={{cursor: node.isDirectory ? 'pointer' : 'default'}}
            >
                {getFileIcon(node)}
                {node.name}
            </div>), key: node.id, meta: node, isLeaf: !node.isDirectory
        };

        if (node.isDirectory && node.children && node.children.length > 0) {
            result.children = node.children.map(transformToTreeData);
        }

        return result;
    };

    // 点击选中
    const handleTreeSelect: TreeProps<TreeNodeWithMeta>['onSelect'] = async (keys, info) => {
        const nodeMeta: FileNode | undefined = info.node.meta;
        if (!nodeMeta.isDirectory) {
            setCurrentFile(nodeMeta.path);
            setSelectedKeys([nodeMeta.path])
        }
    };

    // 处理树节点展开/折叠
    const handleTreeExpand: TreeProps<TreeNodeWithMeta>['onExpand'] = async (expandedKeysValue, info) => {
        setExpandedKeys(expandedKeysValue as string[]);
    };

    // 懒加载子节点
    const onLoadData = async (node: TreeNodeWithMeta): Promise<void> => {
        const {meta} = node;
        if (!meta.isDirectory || loadedKeys.has(meta.id)) {
            return;
        }

        try {
            // 不再设置全局loading状态，避免影响用户体验
            const children = await window.electronAPI!.getDirectoryChildren(meta.path);

            // 更新文件列表中的子节点
            const updateNodeChildren = (nodeList: FileNode[]): FileNode[] => {
                return nodeList.map(item => {
                    if (item.id === meta.id) {
                        return {
                            ...item, children: children
                        };
                    }
                    if (item.children) {
                        return {
                            ...item, children: updateNodeChildren(item.children)
                        };
                    }
                    return item;
                });
            };

            setFileList(prevList => updateNodeChildren(prevList));
            setLoadedKeys(prev => new Set([...prev, meta.id]));
        } catch (error) {
            console.error('加载子节点失败:', error);
            message.error('加载子节点失败，请重试');
        }
    };

    return (
        <div style={{height: '100%', overflowY: 'auto', overflowX: 'hidden'}}>
            <ConfigProvider theme={{token: {colorBgContainer: 'transparent',}}}>
                {initialLoading
                    ? (<div style={{textAlign: 'center', padding: '20px'}}>
                        加载中...
                    </div>)
                    : (<Tree<TreeNodeWithMeta>
                        treeData={fileList.map(transformToTreeData)}
                        blockNode
                        showLine
                        switcherIcon={<DownOutlined/>}
                        selectedKeys={selectedKeys}
                        expandedKeys={expandedKeys}
                        onSelect={handleTreeSelect}
                        onExpand={handleTreeExpand}
                        loadData={onLoadData}
                        expandAction="click"
                    />)}
            </ConfigProvider>
        </div>
    );
};