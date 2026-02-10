import React, { useState, useRef, useEffect } from 'react';
import { Input, message, InputRef, Button, Space } from 'antd';
import { dirname, fullname } from '../../utils/fileCommonUtil';
import { useAppContext } from '../../contexts/AppContext';

interface EditableFilePathProps {
    path: string;
    onRename?: (newPath: string) => void;
}

export const EditableFilePath: React.FC<EditableFilePathProps> = ({ path, onRename }) => {
    
    const { currentFolder } = useAppContext();
    
    const [isEditing, setIsEditing] = useState(false);
    const [fileName, setFileName] = useState(fullname(path));
    const inputRef = useRef<InputRef>(null);

    // 双击进入编辑状态
    const handleDoubleClick = () => {
        // 检查是否是主目录（当前目录），如果是则提示不可重命名
        if (path === currentFolder) {
            message.info('主目录不可重命名');
            return;
        }
        setIsEditing(true);
    };

    // 处理输入变化
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFileName(e.target.value);
    };

    // 处理回车键保存
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            handleSave();
        } else if (e.key === 'Escape') {
            handleCancel();
        }
    };

    // 处理保存
    const handleSave = async () => {
        if (!fileName.trim()) {
            message.error('文件名不能为空');
            return;
        }

        try {
            const directory = dirname(path);
            const newPath = `${directory}/${fileName}`;

            // 判断一下 newPath 是否和 path 相同
            // 如果相同，就不调用 API 了
            if (newPath === path) {
                // message.info('文件名未改变');
                setIsEditing(false);
                return;
            }

            // 调用 renameFile API 重命名文件
            const result = await window.electronAPI.renameFile(path, fileName);

            if (result.success) {
                message.success('文件重命名成功');
                setIsEditing(false);
                if (onRename && result.newPath) {
                    onRename(result.newPath);
                }
            } else {
                message.error(result.error || '文件重命名失败');
            }
        } catch (error) {
            console.error('重命名文件失败:', error);
            message.error('文件重命名失败，请重试');
        }
    };

    // 处理取消
    const handleCancel = () => {
        setFileName(fullname(path));
        setIsEditing(false);
    };

    // 点击外部取消编辑
    const handleClickOutside = (e: MouseEvent) => {
        if (inputRef.current && inputRef.current.input && !inputRef.current.input.contains(e.target as Node)) {
            handleSave();
        }
    };

    // 编辑状态变化时的副作用
    useEffect(() => {
        if (isEditing) {
            // 编辑状态下，监听点击外部事件
            document.addEventListener('mousedown', handleClickOutside);
            // 聚焦到输入框
            setTimeout(() => {
                inputRef.current?.focus();
                inputRef.current?.select();
            }, 0);
        } else {
            // 非编辑状态下，移除事件监听
            document.removeEventListener('mousedown', handleClickOutside);
        }

        return () => {
            // 清理事件监听
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isEditing]);

    return (
        <span className="file-path-editor" style={{ display: 'flex', flex: 1, minWidth: 0 }}>
            {isEditing ? (
                <div 
                    style={{ 
                        display: 'flex', 
                        width: '100%',
                        gap: '4px',
                        alignItems: 'center',
                        flex: 1,
                        minWidth: 0
                    }}
                    onClick={(e) => e.stopPropagation()}
                    onDoubleClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                >
                    <Input
                        ref={inputRef}
                        value={fileName}
                        onChange={handleInputChange}
                        onKeyDown={handleKeyDown}
                        size="small"
                        style={{ 
                            flex: 1,
                            minWidth: 0,
                            border: '1px solid #1890ff',
                            boxShadow: '0 0 0 2px rgba(24, 144, 255, 0.2)'
                        }}
                    />
                    <Button
                        type="primary"
                        size="small"
                        onClick={handleSave}
                        style={{ 
                            minWidth: 'auto',
                            padding: '0 8px',
                            flexShrink: 0
                        }}
                    >
                        保存
                    </Button>
                    <Button
                        size="small"
                        onClick={handleCancel}
                        style={{ 
                            minWidth: 'auto',
                            padding: '0 8px',
                            flexShrink: 0
                        }}
                    >
                        取消
                    </Button>
                </div>
            ) : (
                <span 
                    className="one-line"
                    onDoubleClick={handleDoubleClick}
                    data-file-path={path}
                    style={{ 
                        cursor: 'pointer',
                        padding: '0px 8px',
                        borderRadius: '4px',
                        transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#f0f0f0';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                >
                    {fullname(path)}
                </span>
            )}
        </span>
    );
};
