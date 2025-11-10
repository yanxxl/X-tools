import React, {useState} from 'react';
import {ConfigProvider, Splitter, Button, Tree, message} from "antd";

// 文件树节点类型
interface FileNode {
  id: string;
  name: string;
  path: string;
  isDirectory: boolean;
  children?: FileNode[];
}

// Tree组件数据类型
interface TreeNodeData {
  title: string;
  key: string;
  icon?: string;
  children?: TreeNodeData[];
}

export const App: React.FC = () => {
  const [fileTree, setFileTree] = useState<FileNode | null>(null);
  const [loading, setLoading] = useState(false);

  // 处理按钮点击事件
  const handleSelectDirectory = async () => {
    try {
      setLoading(true);
      
      // 调用Electron API选择文件夹
      const dirPath = await window.electronAPI.selectDirectory();
      
      if (dirPath) {
        // 获取文件树结构
        const tree = await window.electronAPI.getFileTree(dirPath);
        setFileTree(tree);
        message.success(`已加载文件夹: ${tree.name}`);
      }
    } catch (error) {
      console.error('选择文件夹失败:', error);
      message.error('选择文件夹失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  // 转换文件节点为Tree组件需要的数据格式
  const transformToTreeData = (node: FileNode): TreeNodeData => {
    const result: TreeNodeData = {
      title: node.name,
      key: node.id,
      icon: node.isDirectory ? 'folder' : 'file'
    };
    
    if (node.isDirectory && node.children && node.children.length > 0) {
      result.children = node.children.map(transformToTreeData);
    }
    
    return result;
  };

  return (
    <ConfigProvider
      theme={{
        components: {
          Splitter: {
            splitBarDraggableSize: 0,
          },
        },
      }}
    >
      <Splitter style={{height: '100vh'}}>
        <Splitter.Panel defaultSize={320} min={80}>
          <div className={'top-bar'}>
            <Button 
              type="link" 
              onClick={handleSelectDirectory}
              loading={loading}
            >
              选择文件夹
            </Button>
          </div>
          <div style={{padding: 16, height: 'calc(100% - 40px)', overflow: 'auto'}}>
            {fileTree ? (
              <Tree
                defaultExpandAll
                treeData={[transformToTreeData(fileTree)]}
                style={{maxHeight: '100%'}}
              />
            ) : (
              <div style={{textAlign: 'center', color: '#999', padding: 20}}>
                请点击上方按钮选择文件夹
              </div>
            )}
          </div>
        </Splitter.Panel>
        <Splitter.Panel min={240}>
          <div className={'top-bar'}>中间区域</div>
          <div style={{padding: 16}}>
            {fileTree ? (
              <div>
                <h3>已选择文件夹</h3>
                <p>路径: {fileTree.path}</p>
                <p>包含项目: {fileTree.children ? fileTree.children.length : 0}</p>
              </div>
            ) : (
              <div style={{color: '#999'}}>请先选择一个文件夹</div>
            )}
          </div>
        </Splitter.Panel>
        <Splitter.Panel defaultSize={320} min={80}>
          <div className={'top-bar'}>右侧区域</div>
          <div style={{padding: 16, color: '#999'}}>
            详细信息区域
          </div>
        </Splitter.Panel>
      </Splitter>
    </ConfigProvider>
  );
};
