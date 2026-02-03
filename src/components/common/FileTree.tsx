import React, {useEffect, useState} from 'react';
import {ConfigProvider, message, Tree} from "antd";
import type {DataNode, TreeProps} from 'antd/es/tree';
import {DownOutlined} from '@ant-design/icons';
import {FileNode} from '../../types';
import {useAppContext} from '../../contexts/AppContext';
import {FileIcon} from './FileIcon';

export type TreeNodeWithMeta = DataNode & {
    meta: FileNode;
    children?: TreeNodeWithMeta[];
};

export const FileTree: React.FC = () => {
    const {currentFolder, currentFile, setCurrentFile} = useAppContext();
    const [fileList, setFileList] = useState<FileNode[]>([]);
    const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
    const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
    const [loadedKeys, setLoadedKeys] = useState<Set<string>>(new Set());
    const [initialLoading, setInitialLoading] = useState(false);

    const handleTreeSelect: TreeProps<TreeNodeWithMeta>['onSelect'] = async (keys, info) => {
        const nodeMeta: FileNode | undefined = info.node.meta;
        if (!nodeMeta.isDirectory) {
            setCurrentFile(nodeMeta.path);
            setSelectedKeys([nodeMeta.path]);
        }
    };

    const handleTreeExpand: TreeProps<TreeNodeWithMeta>['onExpand'] = async (expandedKeysValue, info) => {
        setExpandedKeys(expandedKeysValue as string[]);
    };

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

    const updateNodeChildren = (nodeList: FileNode[], metaId: string, children: FileNode[]): FileNode[] => {
        return nodeList.map(item => {
            if (item.id === metaId) {
                return {
                    ...item,
                    children: children
                };
            }
            if (item.children) {
                return {
                    ...item,
                    children: updateNodeChildren(item.children, metaId, children)
                };
            }
            return item;
        });
    };

    const transformToTreeData = (node: FileNode): TreeNodeWithMeta => {
        const result: TreeNodeWithMeta = {
            title: (
                <div
                    className={'one-line'}
                    title={node.name}
                    style={{cursor: node.isDirectory ? 'pointer' : 'default'}}
                >
                    <FileIcon 
                        fileName={node.name} 
                        isDirectory={node.isDirectory} 
                        style={{marginRight: 8}} 
                    />
                    {node.name}
                </div>
            ),
            key: node.id,
            meta: node,
            isLeaf: !node.isDirectory
        };

        if (node.isDirectory && node.children && node.children.length > 0) {
            result.children = node.children.map(transformToTreeData);
        }

        return result;
    };

    async function loadFileList() {
        if (currentFolder && window.electronAPI) {
            try {
                setInitialLoading(true);
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

    const onLoadData = async (node: TreeNodeWithMeta): Promise<void> => {
        const {meta} = node;
        if (!meta.isDirectory || loadedKeys.has(meta.id)) {
            return;
        }

        try {
            const children = await window.electronAPI.getDirectoryChildren(meta.path);
            setFileList(prevList => updateNodeChildren(prevList, meta.id, children));
            setLoadedKeys(prev => new Set([...prev, meta.id]));
        } catch (error) {
            console.error('加载子节点失败:', error);
            message.error('加载子节点失败，请重试');
        }
    };

    useEffect(() => {
        if (currentFolder) {
            loadFileList();
        } else {
            setFileList([]);
            setSelectedKeys([]);
            setExpandedKeys([]);
            setLoadedKeys(new Set());
        }
    }, [currentFolder]);

    useEffect(() => {
        if (selectedKeys.includes(currentFile)) return;

        setTimeout(() => {
            if (currentFile && fileList.length > 0) {
                setSelectedKeys([currentFile]);
                const parentPaths = getAllParentPaths(currentFile);
                const newExpandedKeys = Array.from(new Set([...expandedKeys, ...parentPaths]));
                setExpandedKeys(newExpandedKeys);
            } else {
                setSelectedKeys([]);
            }
        }, 500);
    }, [currentFile, fileList]);

    return (
        <div style={{height: '100%', overflowY: 'auto', overflowX: 'hidden'}}>
            <ConfigProvider theme={{token: {colorBgContainer: 'transparent'}}}>
                {initialLoading
                    ? (
                        <div style={{textAlign: 'center', padding: '20px'}}>
                            加载中...
                        </div>
                    )
                    : (
                        <Tree<TreeNodeWithMeta>
                            treeData={fileList.map(transformToTreeData)}
                            blockNode
                            showLine
                            switcherIcon={<DownOutlined />}
                            selectedKeys={selectedKeys}
                            expandedKeys={expandedKeys}
                            onSelect={handleTreeSelect}
                            onExpand={handleTreeExpand}
                            loadData={onLoadData}
                            expandAction="click"
                        />
                    )}
            </ConfigProvider>
        </div>
    );
};