import React, { useState, useRef, useEffect } from 'react';
import { Input, message, InputRef } from 'antd';
import { dirname, fullname } from '../../utils/fileCommonUtil';

interface EditableFilePathProps {
    path: string;
    onRename?: (newPath: string) => void;
}

export const EditableFilePath: React.FC<EditableFilePathProps> = ({ path, onRename }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [fileName, setFileName] = useState(fullname(path));
    const inputRef = useRef<InputRef>(null);

    // 双击进入编辑状态
    const handleDoubleClick = () => {
        setIsEditing(true);
    };

    // 处理输入变化
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFileName(e.target.value);
    };

    // 处理回车键保存
    const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
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
        <span className="file-path-editor no-drag">
            {isEditing ? (
                <Input
                    ref={inputRef}
                    value={fileName}
                    onChange={handleInputChange}
                    onKeyPress={handleKeyPress}
                    onBlur={() => handleSave()}
                    size="small"
                    style={{ 
                        width: 'auto', 
                        maxWidth: '300px',
                        border: '1px solid #1890ff',
                        boxShadow: '0 0 0 2px rgba(24, 144, 255, 0.2)'
                    }}
                />
            ) : (
                <span 
                    className="one-line"
                    onDoubleClick={handleDoubleClick}
                    style={{ 
                        cursor: 'pointer',
                        padding: '2px 4px',
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
