import React, { useState, useCallback } from 'react';
import { InterfaceType, QueryType } from '../../shared/prompts.js';
import { FileUpload } from '../../shared/types';

interface Props {
  onSubmit: (data: {
    query: string;
    interfaceType: InterfaceType;
    queryType: QueryType;
    files?: FileUpload[];
  }) => Promise<void>;
  isProcessing: boolean;
}

export const InterfaceSelector: React.FC<Props> = ({ onSubmit, isProcessing }) => {
  const [selectedInterface, setSelectedInterface] = useState<InterfaceType>('GENERAL');
  const [queryType, setQueryType] = useState<QueryType>('CODE');
  const [query, setQuery] = useState('');
  const [files, setFiles] = useState<FileUpload[]>([]);

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = event.target.files;
    if (!fileList) return;

    const newFiles: FileUpload[] = [];
    Array.from(fileList).forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          let content: string;
          if (file.type === 'application/pdf' || file.type.startsWith('image/')) {
            // For binary files, convert ArrayBuffer to base64
            content = btoa(
              new Uint8Array(e.target.result as ArrayBuffer)
                .reduce((data, byte) => data + String.fromCharCode(byte), '')
            );
          } else {
            // For text files, use as is
            content = e.target.result as string;
          }
          newFiles.push({
            name: file.name,
            content: content,
            type: file.type
          });
          if (newFiles.length === fileList.length) {
            setFiles(prev => [...prev, ...newFiles]);
          }
        }
      };
      
      if (file.type === 'application/pdf' || file.type.startsWith('image/')) {
        reader.readAsArrayBuffer(file);
      } else {
        reader.readAsText(file);
      }
    });
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    await onSubmit({
      query,
      interfaceType: selectedInterface,
      queryType,
      files: files.length > 0 ? files : undefined
    });
  }, [query, selectedInterface, queryType, files, onSubmit]);

  return (
    <div className="interface-selector p-4 bg-gray-800 rounded-lg shadow-lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <button
            type="button"
            onClick={() => setSelectedInterface('GENERAL')}
            className={`p-4 rounded-lg transition-colors ${
              selectedInterface === 'GENERAL'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            General Assistant
          </button>
          <button
            type="button"
            onClick={() => setSelectedInterface('RESEARCHER')}
            className={`p-4 rounded-lg transition-colors ${
              selectedInterface === 'RESEARCHER'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            Deep Researcher
          </button>
          <button
            type="button"
            onClick={() => setSelectedInterface('CODER')}
            className={`p-4 rounded-lg transition-colors ${
              selectedInterface === 'CODER'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            Deep Coder
          </button>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <button
            type="button"
            onClick={() => setQueryType('CODE')}
            className={`p-2 rounded-lg transition-colors ${
              queryType === 'CODE'
                ? 'bg-green-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            Code
          </button>
          <button
            type="button"
            onClick={() => setQueryType('EXPLANATION')}
            className={`p-2 rounded-lg transition-colors ${
              queryType === 'EXPLANATION'
                ? 'bg-green-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            Explanation
          </button>
          <button
            type="button"
            onClick={() => setQueryType('RESEARCH')}
            className={`p-2 rounded-lg transition-colors ${
              queryType === 'RESEARCH'
                ? 'bg-green-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            Research
          </button>
        </div>

        <div className="space-y-2">
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Enter your query..."
            className="w-full h-32 p-2 bg-gray-700 text-white rounded-lg resize-none"
            disabled={isProcessing}
          />
          
          <div className="flex items-center space-x-4">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="file"
                multiple
                onChange={handleFileChange}
                className="hidden"
                disabled={isProcessing}
              />
              <span className="px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors">
                Attach Files
              </span>
            </label>
            {files.length > 0 && (
              <span className="text-gray-400">
                {files.length} file(s) attached
              </span>
            )}
          </div>
        </div>

        <button
          type="submit"
          disabled={isProcessing || !query.trim()}
          className={`w-full p-4 rounded-lg transition-colors ${
            isProcessing || !query.trim()
              ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-500'
          }`}
        >
          {isProcessing ? 'Processing...' : 'Submit'}
        </button>
      </form>
    </div>
  );
}; 