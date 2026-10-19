import React from 'react';

export const Container: React.FC<{
    children: React.ReactNode;
    style?: React.CSSProperties;
}> = ({children, style = {}}) => {
    return (
        <div style={{
            width: '100%',
            height: '100%',
            overflow: 'hidden',
            ...style
        }}>
            {children}
        </div>
    );
};