import React, {useEffect, useState} from 'react';
import {Card, Descriptions, Typography} from 'antd';

import {countText, getSelectedText, truncateText} from '../../utils/format';

const {Text} = Typography;

/**
 * 选中文本面板组件
 */
const SelectedTextPanel: React.FC = () => {
    const [selectedText, setSelectedText] = useState('');
    const [selectedTextCount, setSelectedTextCount] = useState('0 字');

    const handleSelectionChange = () => {
        const selection = getSelectedText();
        if (selection !== selectedText) {
            setSelectedText(selection);
            const count = countText(selection);
            if (count.chars > 0) {
                setSelectedTextCount(`${count.chars} 字`);
            } else {
                setSelectedTextCount('0 字');
            }
        }
    };

    const forceUpdateSelection = () => {
        const selection = getSelectedText();
        setSelectedText(selection);
        const count = countText(selection);
        setSelectedTextCount(count.chars > 0 ? `${count.chars} 字` : '0 字');
    };

    useEffect(() => {
        const handlePdfTextSelected = (event: CustomEvent) => {
            const selectedText = event.detail;
            setSelectedText(selectedText);
            const count = countText(selectedText);
            if (count.chars > 0) {
                setSelectedTextCount(`${count.chars} 字`);
            } else {
                setSelectedTextCount('0 字');
            }
        };

        document.addEventListener('selectionchange', handleSelectionChange);
        document.addEventListener('click', forceUpdateSelection);
        document.addEventListener('keydown', forceUpdateSelection);
        document.addEventListener('keyup', handleSelectionChange);
        window.addEventListener('blur', forceUpdateSelection);
        window.addEventListener('pdf-text-selected', handlePdfTextSelected);

        return () => {
            document.removeEventListener('selectionchange', handleSelectionChange);
            document.removeEventListener('click', forceUpdateSelection);
            document.removeEventListener('keydown', forceUpdateSelection);
            document.removeEventListener('keyup', handleSelectionChange);
            window.removeEventListener('blur', forceUpdateSelection);
            window.removeEventListener('pdf-text-selected', handlePdfTextSelected);
        };
    }, [selectedText]);

    return (
        <Card
            size="small"
            title="选中内容"
        >
            <Descriptions size="small" column={1} labelStyle={{width: '80px', textAlign: 'right'}}>
                <Descriptions.Item label="选中字数">
                    <Text strong style={{color: '#fa8c16'}}>{selectedTextCount}</Text>
                </Descriptions.Item>

                {selectedText && selectedTextCount !== '0 字' && (
                    <Descriptions.Item label="选中内容">
                        <Text style={{fontSize: 12, wordBreak: 'break-all'}} type="secondary">
                            {truncateText(selectedText, 100)}
                        </Text>
                    </Descriptions.Item>
                )}
            </Descriptions>
        </Card>
    );
};

export {SelectedTextPanel};