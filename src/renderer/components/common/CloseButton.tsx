// React核心导入
import React, { MouseEvent } from 'react';

// 第三方库导入
import { CloseOutlined } from '@ant-design/icons';

// 定义组件props类型
interface CloseButtonProps {
    title?: string;
    onClick?: (e: MouseEvent<HTMLElement>) => void;
}

/**
 * 关闭按钮组件
 * 显示一个CloseOutlined图标，当鼠标悬停时变红
 * @param title 按钮标题（可选）
 * @param onClick 点击回调函数（可选）
 */
export const CloseButton: React.FC<CloseButtonProps> = ({ title, onClick }) => {
    return (
        <div
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                padding: '4px',
                borderRadius: '4px',
                transition: 'color 0.2s ease',
                color: 'lightgray',
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.color = '#ff4d4f';
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.color = 'lightgray';
            }}
            onClick={onClick}
            title={title}
        >
            <CloseOutlined />
        </div>
    );
};
