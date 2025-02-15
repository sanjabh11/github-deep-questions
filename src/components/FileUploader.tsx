import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { FileUpload, storage } from '@/lib/storage';
import { cn } from '@/lib/utils';
import { Loader2, File, X } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

interface FileUploaderProps {
  onFilesChange: (files: FileUpload[]) => void;
  className?: string;
}

export function FileUploader({ onFilesChange, className }: FileUploaderProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<FileUpload[]>([]);
  const { toast } = useToast();

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    setIsLoading(true);
    try {
      const newFiles: FileUpload[] = [];
      
      for (const file of acceptedFiles) {
        try {
          const uploadedFile = await storage.saveTemporaryFile(file);
          if (uploadedFile) {
            newFiles.push(uploadedFile);
          }
        } catch (error) {
          toast({
            title: 'Upload Error',
            description: error instanceof Error ? error.message : 'Failed to upload file',
            variant: 'destructive'
          });
        }
      }

      const updatedFiles = [...uploadedFiles, ...newFiles];
      setUploadedFiles(updatedFiles);
      onFilesChange(updatedFiles);
    } catch (error) {
      toast({
        title: 'Upload Error',
        description: 'Failed to process files',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  }, [uploadedFiles, onFilesChange, toast]);

  const removeFile = useCallback(async (fileId: string) => {
    const updatedFiles = uploadedFiles.filter(f => f.id !== fileId);
    setUploadedFiles(updatedFiles);
    onFilesChange(updatedFiles);
    
    // Update storage
    try {
      await storage.saveTemporaryFiles(updatedFiles);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update file storage',
        variant: 'destructive'
      });
    }
  }, [uploadedFiles, onFilesChange, toast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxSize: 10 * 1024 * 1024, // 10MB
    accept: {
      'text/plain': ['.txt'],
      'text/markdown': ['.md'],
      'application/json': ['.json'],
      'text/javascript': ['.js', '.ts', '.jsx', '.tsx'],
      'text/x-python': ['.py']
    }
  });

  return (
    <div className={cn("space-y-4", className)}>
      <div
        {...getRootProps()}
        className={cn(
          "border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors",
          isDragActive ? "border-primary bg-primary/10" : "border-muted-foreground/20",
          isLoading && "opacity-50 cursor-not-allowed"
        )}
      >
        <input {...getInputProps()} disabled={isLoading} />
        {isLoading ? (
          <div className="flex items-center justify-center space-x-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Uploading...</span>
          </div>
        ) : isDragActive ? (
          <p>Drop the files here...</p>
        ) : (
          <p>Drag & drop files here, or click to select files</p>
        )}
      </div>

      {/* File list */}
      {uploadedFiles.length > 0 && (
        <ul className="space-y-2">
          {uploadedFiles.map((file) => (
            <li
              key={file.id}
              className="flex items-center justify-between p-2 rounded-lg bg-muted"
            >
              <div className="flex items-center space-x-2">
                <File className="h-4 w-4" />
                <span className="text-sm">{file.name}</span>
                <span className="text-xs text-muted-foreground">
                  ({Math.round(file.size / 1024)}KB)
                </span>
              </div>
              <button
                onClick={() => removeFile(file.id)}
                className="p-1 hover:bg-destructive/10 rounded-full transition-colors"
                aria-label="Remove file"
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}