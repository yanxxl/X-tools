import React, { MouseEvent } from 'react';

interface DangerTextProps {
    children: React.ReactNode;
    title?: string;
    onClick?: (e: MouseEvent<HTMLSpanElement>) => void;
    style?: React.CSSProperties;
    className?: string;
}

export const DangerText: React.FC<DangerTextProps> = ({ 
    children, 
    title, 
    onClick,
    style = {},
    className 
}) => {
    return (
        <span
            style={{
                color: '#8c8c8c',
                fontSize: '14px',
                fontWeight: 300,
                cursor: onClick ? 'pointer' : 'default',
                lineHeight: '1.0',
                ...style
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.color = '#ff4d4f';
                e.currentTarget.style.fontWeight = '400';
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.color = '#8c8c8c';
                e.currentTarget.style.fontWeight = '300';
            }}
            onClick={onClick}
            title={title}
            className={className}
        >
            {children}
        </span>
    );
};