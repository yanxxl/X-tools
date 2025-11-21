import React from 'react';

export const Center: React.FC<{
    children: React.ReactNode;
    style?: React.CSSProperties;
}> = ({children, style = {}}) => {
    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '32px',
            justifyContent: 'center',
            alignItems: 'center',
            width: '100%',
            height: '100%',
            ...style,
        }}>
            {children}
        </div>
    );
};