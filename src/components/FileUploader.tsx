import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { saveTemporaryFile } from "@/lib/storage";
import { FileUpload } from "@/lib/types";
import { X } from "lucide-react";

interface FileUploaderProps {
  onUpload: (files: FileUpload[]) => void;
  onRemove: (fileId: string) => void;
  files: FileUpload[];
  acceptedTypes?: string;
  maxSize?: number;
  disabled?: boolean;
}

const MIME_TYPES = {
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.dcm': 'application/dicom',
  '.nii': 'application/x-nifti'
};

export function FileUploader({ 
  onUpload, 
  onRemove, 
  files, 
  acceptedTypes = ".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.dcm,.nii",
  maxSize = 10 * 1024 * 1024, 
  disabled 
}: FileUploaderProps) {
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const uploadedFiles: FileUpload[] = [];
    
    for (const file of acceptedFiles) {
      try {
        const fileData = await saveTemporaryFile(file);
        if (fileData) {
          uploadedFiles.push({
            id: fileData.id,
            name: file.name,
            size: file.size,
            type: file.type
          });
        }
      } catch (error) {
        toast({
          title: "Upload Failed",
          description: error instanceof Error ? error.message : "Failed to upload file",
          variant: "destructive"
        });
      }
    }

    if (uploadedFiles.length > 0) {
      onUpload(uploadedFiles);
      toast({
        title: "Files Uploaded",
        description: `${uploadedFiles.length} file(s) uploaded successfully.`
      });
    }
  }, [onUpload]);

  // Convert file extensions to MIME types
  const accept = acceptedTypes.split(',').reduce((acc, ext) => {
    const mime = MIME_TYPES[ext as keyof typeof MIME_TYPES];
    if (mime) {
      acc[mime] = [ext];
    }
    return acc;
  }, {} as Record<string, string[]>);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    disabled,
    maxSize,
    accept
  });

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer
          ${isDragActive ? 'border-primary bg-primary/10' : 'border-border'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-primary hover:bg-primary/5'}`}
      >
        <input {...getInputProps()} />
        <p className="text-sm text-muted-foreground">
          {isDragActive
            ? "Drop the files here..."
            : "Drag & drop files here, or click to select"}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Supported: PDF, DOC, DOCX, Images, DICOM, NIfTI
        </p>
        <p className="text-xs text-muted-foreground">
          Max size: {Math.round(maxSize / 1024 / 1024)}MB
        </p>
      </div>

      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((file) => (
            <div
              key={file.id}
              className="flex items-center justify-between p-2 bg-muted rounded-md"
            >
              <span className="text-sm truncate flex-1">{file.name}</span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onRemove(file.id)}
                className="h-8 w-8"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}