import React from 'react';
import Editor from '@monaco-editor/react';
import { useTheme } from '../../hooks/useTheme';

interface Props {
  code: string;
  language?: string;
  readOnly?: boolean;
  onChange?: (value: string | undefined) => void;
  onSave?: (value: string) => void;
  height?: string;
  width?: string;
}

export const CodeEditor: React.FC<Props> = ({
  code,
  language = 'typescript',
  readOnly = false,
  onChange,
  onSave,
  height = '300px',
  width = '100%'
}) => {
  const { isDarkMode } = useTheme();

  const handleEditorDidMount = (editor: any) => {
    // Add save command
    if (onSave) {
      editor.addCommand(
        // Monaco.KeyMod.CtrlCmd | Monaco.KeyCode.KeyS
        2048 | 49, // These are the values for Ctrl/Cmd + S
        () => {
          const value = editor.getValue();
          if (value) {
            onSave(value);
          }
        }
      );
    }
  };

  return (
    <div
      style={{
        border: '1px solid #ccc',
        borderRadius: '4px',
        overflow: 'hidden'
      }}
    >
      <Editor
        height={height}
        width={width}
        language={language}
        theme={isDarkMode ? 'vs-dark' : 'vs-light'}
        value={code}
        options={{
          readOnly,
          minimap: { enabled: true },
          scrollBeyondLastLine: false,
          fontSize: 14,
          lineNumbers: 'on',
          wordWrap: 'on',
          wrappingIndent: 'indent',
          renderWhitespace: 'selection',
          tabSize: 2,
          scrollbar: {
            vertical: 'visible',
            horizontal: 'visible',
            useShadows: true,
            verticalScrollbarSize: 10,
            horizontalScrollbarSize: 10
          }
        }}
        onChange={onChange}
        onMount={handleEditorDidMount}
      />
    </div>
  );
}; 