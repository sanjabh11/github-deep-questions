import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { saveTemporaryFile } from "@/lib/storage";

interface FileUploaderProps {
  onFileUpload: (fileId: string) => void;
  disabled?: boolean;
}

export function FileUploader({ onFileUpload, disabled }: FileUploaderProps) {
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    for (const file of acceptedFiles) {
      try {
        const uploadedFile = await saveTemporaryFile(file);
        if (uploadedFile) {
          onFileUpload(uploadedFile.id);
          toast({
            title: "File Uploaded",
            description: `${file.name} has been uploaded successfully.`
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
  }, [onFileUpload]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    disabled,
    maxSize: 10 * 1024 * 1024, // 10MB
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'image/*': ['.png', '.jpg', '.jpeg', '.gif'],
      'application/dicom': ['.dcm', '.dicom']
    }
  });

  return (
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
        Supported: PDF, DOC, DOCX, Images, DICOM
      </p>
      <p className="text-xs text-muted-foreground">
        Max size: 10MB
      </p>
    </div>
  );
}