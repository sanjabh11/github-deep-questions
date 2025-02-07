import React, { useMemo } from 'react';
import { CodePreview } from './codeblocks/CodePreview';

interface Props {
  file: {
    name: string;
    content: string;
  };
  maxHeight?: string;
}

export const FilePreview: React.FC<Props> = ({
  file,
  maxHeight = '500px'
}) => {
  const fileType = useMemo(() => {
    const extension = file.name.split('.').pop()?.toLowerCase() || '';
    
    // Map file extensions to languages/types
    const extensionMap: Record<string, string> = {
      // Code files
      'ts': 'typescript',
      'tsx': 'typescript',
      'js': 'javascript',
      'jsx': 'javascript',
      'py': 'python',
      'java': 'java',
      'cpp': 'cpp',
      'c': 'c',
      'cs': 'csharp',
      'go': 'go',
      'rs': 'rust',
      'rb': 'ruby',
      'php': 'php',
      'swift': 'swift',
      'kt': 'kotlin',
      
      // Web files
      'html': 'html',
      'css': 'css',
      'scss': 'scss',
      'less': 'less',
      'json': 'json',
      'xml': 'xml',
      'yaml': 'yaml',
      'yml': 'yaml',
      'md': 'markdown',
      
      // Config files
      'env': 'plaintext',
      'ini': 'ini',
      'conf': 'plaintext',
      'toml': 'toml',
      
      // Data files
      'csv': 'csv',
      'txt': 'plaintext'
    };
    
    return extensionMap[extension] || 'plaintext';
  }, [file.name]);

  const isImage = useMemo(() => {
    const imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'];
    const extension = file.name.split('.').pop()?.toLowerCase() || '';
    return imageExtensions.includes(extension);
  }, [file.name]);

  const isPDF = useMemo(() => {
    return file.name.toLowerCase().endsWith('.pdf');
  }, [file.name]);

  if (isImage) {
    return (
      <div className="file-preview">
        <div className="file-name mb-2 text-sm text-gray-500">
          {file.name}
        </div>
        <img
          src={`data:image;base64,${file.content}`}
          alt={file.name}
          style={{
            maxWidth: '100%',
            maxHeight,
            objectFit: 'contain'
          }}
        />
      </div>
    );
  }

  if (isPDF) {
    return (
      <div className="file-preview">
        <div className="file-name mb-2 text-sm text-gray-500">
          {file.name}
        </div>
        <iframe
          src={`data:application/pdf;base64,${file.content}`}
          style={{
            width: '100%',
            height: maxHeight,
            border: 'none'
          }}
          title={file.name}
        />
      </div>
    );
  }

  return (
    <div className="file-preview">
      <div className="file-name mb-2 text-sm text-gray-500">
        {file.name}
      </div>
      <CodePreview
        code={file.content}
        language={fileType}
        maxHeight={maxHeight}
      />
    </div>
  );
}; 