import React from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus, vs } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useTheme } from '../../hooks/useTheme';

interface Props {
  code: string;
  language?: string;
  showLineNumbers?: boolean;
  wrapLongLines?: boolean;
  maxHeight?: string;
}

export const CodePreview: React.FC<Props> = ({
  code,
  language = 'typescript',
  showLineNumbers = true,
  wrapLongLines = true,
  maxHeight = '500px'
}) => {
  const { isDarkMode } = useTheme();

  return (
    <div
      style={{
        position: 'relative',
        borderRadius: '4px',
        overflow: 'hidden'
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: '8px',
          right: '8px',
          padding: '4px 8px',
          borderRadius: '4px',
          backgroundColor: isDarkMode ? '#1e1e1e' : '#f5f5f5',
          color: isDarkMode ? '#d4d4d4' : '#333',
          fontSize: '12px',
          fontFamily: 'monospace',
          zIndex: 1
        }}
      >
        {language}
      </div>
      
      <SyntaxHighlighter
        language={language}
        style={isDarkMode ? vscDarkPlus : vs}
        showLineNumbers={showLineNumbers}
        wrapLongLines={wrapLongLines}
        customStyle={{
          margin: 0,
          borderRadius: '4px',
          maxHeight,
          fontSize: '14px'
        }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}; 