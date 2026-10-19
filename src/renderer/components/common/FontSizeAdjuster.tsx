import React, {useEffect, useState} from 'react';
import {Button, Space} from 'antd';
import {MinusOutlined, PlusOutlined} from '@ant-design/icons';
import {storage, STORAGE_KEYS} from '../../utils/storage';

interface FontSizeAdjusterProps {
    onFontSizeChange?: (size: number) => void;
}

export const FontSizeAdjuster: React.FC<FontSizeAdjusterProps> = ({onFontSizeChange}) => {
    const [fontSize, setFontSize] = useState(() => {
        // 从本地存储读取字体大小设置，默认为 16px
        return storage.get(STORAGE_KEYS.MARKDOWN_FONT_SIZE, 16);
    });

    // 字体大小调整函数
    const increaseFontSize = () => {
        const newSize = Math.min(fontSize + 2, 48);
        setFontSize(newSize);
        storage.set(STORAGE_KEYS.MARKDOWN_FONT_SIZE, newSize);
        onFontSizeChange?.(newSize);
    };

    const decreaseFontSize = () => {
        const newSize = Math.max(fontSize - 2, 12);
        setFontSize(newSize);
        storage.set(STORAGE_KEYS.MARKDOWN_FONT_SIZE, newSize);
        onFontSizeChange?.(newSize);
    };

    // 当字体大小状态改变时，更新 CSS 变量
    useEffect(() => {
        const root = document.documentElement;
        root.style.setProperty('--markdown-font-size', `${fontSize}px`);
        onFontSizeChange?.(fontSize);
    }, [fontSize, onFontSizeChange]);

    return (
        <Space size="middle">
            {/* 字体大小调整按钮 */}
            <Button.Group>
                <Button
                    icon={<MinusOutlined/>}
                    onClick={decreaseFontSize}
                    size="small"
                    disabled={fontSize <= 12}
                    title="减小字体 (A-)"
                />
                <Button
                    size="small"
                    style={{
                        minWidth: '50px',
                        cursor: 'default',
                        margin: '0 4px'
                    }}
                    disabled
                >
                    {fontSize}px
                </Button>
                <Button
                    icon={<PlusOutlined/>}
                    onClick={increaseFontSize}
                    size="small"
                    disabled={fontSize >= 48}
                    title="增大字体 (A+)"
                />
            </Button.Group>
        </Space>
    );
};