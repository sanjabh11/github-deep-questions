import { ChatMode, FileUpload } from './types';

const CHAT_MODE_KEY = 'chat_mode';
const TEMP_FILES_KEY = 'temp_files';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export const saveChatMode = (mode: ChatMode) => {
  localStorage.setItem(CHAT_MODE_KEY, mode);
};

export const loadChatMode = (): ChatMode => {
  return (localStorage.getItem(CHAT_MODE_KEY) as ChatMode) || 'default';
};

export const saveTemporaryFile = async (file: File): Promise<FileUpload | null> => {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error('File size exceeds 10MB limit');
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const fileUpload: FileUpload = {
          id: crypto.randomUUID(),
          name: file.name,
          type: file.type,
          size: file.size,
          content: e.target?.result || ''
        };

        const files = await loadTemporaryFiles();
        files.push(fileUpload);
        
        // Only keep last 5 files
        if (files.length > 5) {
          files.shift();
        }

        localStorage.setItem(TEMP_FILES_KEY, JSON.stringify(files));
        resolve(fileUpload);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
};

export const loadTemporaryFiles = async (): Promise<FileUpload[]> => {
  const stored = localStorage.getItem(TEMP_FILES_KEY);
  return stored ? JSON.parse(stored) : [];
};

export const clearTemporaryFiles = () => {
  localStorage.removeItem(TEMP_FILES_KEY);
};