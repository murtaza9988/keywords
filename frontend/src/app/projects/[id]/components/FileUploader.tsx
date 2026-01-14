"use client";
import React, { useState, useCallback, useRef } from 'react';
import apiClient from '@/lib/apiClient';
import { UploadCloud, Loader2 } from 'lucide-react';
import { ProcessingStatus } from '@/lib/types';

interface FileUploaderProps {
  projectId: string;
  onUploadStart: () => void;
  onUploadBatchStart: (files: File[]) => void;
  onUploadSuccess: (backendStatus: ProcessingStatus, message?: string) => void;
  onUploadError: (message: string) => void;
}

interface ApiError {
  message: string;
}
function isApiError(error: unknown): error is ApiError {
  return typeof error === 'object' && error !== null && 'message' in error;
}

const FileUploader: React.FC<FileUploaderProps> = ({
  projectId,
  onUploadStart,
  onUploadBatchStart,
  onUploadSuccess,
  onUploadError,
}) => {
  const [isUploadingInternal, setIsUploadingInternal] = useState<boolean>(false);
  const [dragActive, setDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  const [totalFiles, setTotalFiles] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const prevProgressRef = useRef<number>(0);
  const [uploadStage, setUploadStage] = useState<ProcessingStatus>('idle');

  const getStageLabel = (stage: ProcessingStatus) => {
    switch (stage) {
      case 'uploading':
        return 'Uploading';
      case 'combining':
        return 'Combining';
      default:
        return 'Uploading';
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length > 0) {
      handleUploads(files);
    }
    if (inputRef.current) inputRef.current.value = '';
  };

  const uploadSingleFile = useCallback(
    async (fileToUpload: File) => {
      if (!fileToUpload || !projectId) {
        console.error('File or Project ID missing for upload');
        onUploadError('Cannot start upload: file or project ID missing.');
        throw new Error('Missing file or project ID');
      }
      
      const fileSizeInMB = fileToUpload.size / (1024 * 1024);
      const CHUNK_SIZE = fileSizeInMB > 20 ? 2 * 1024 * 1024 : 1024 * 1024;
      const totalChunks = Math.ceil(fileToUpload.size / CHUNK_SIZE);
      let currentChunk = 0;
      let uploadSuccessful = true;
      let uploadMessage = '';
      
      try {
        while (currentChunk < totalChunks && uploadSuccessful) {
          const start = currentChunk * CHUNK_SIZE;
          const end = Math.min(start + CHUNK_SIZE, fileToUpload.size);
          const chunk = fileToUpload.slice(start, end);
          const formData = new FormData();
          const chunkFile = new File([chunk], fileToUpload.name, { type: fileToUpload.type });
          formData.append('file', chunkFile);
          formData.append('chunkIndex', String(currentChunk));
          formData.append('totalChunks', String(totalChunks));
          formData.append('originalFilename', fileToUpload.name);
          formData.append('fileSize', String(fileToUpload.size));
          const baseProgress = Math.floor((currentChunk / totalChunks) * 100);
          setUploadProgress(Math.max(prevProgressRef.current, baseProgress));
          setUploadStage('uploading');
          try {
            if (currentChunk === totalChunks - 1) {
              setUploadStage('combining');
            }
            const result = await apiClient.uploadCSV(projectId, formData, (chunkProgress) => {
              const adjustedChunkProgress = chunkProgress / totalChunks;
              const compositeProgress = Math.floor(baseProgress + adjustedChunkProgress);
              const newProgress = Math.max(prevProgressRef.current, compositeProgress);
              prevProgressRef.current = newProgress;
              setUploadProgress(newProgress);
            });
            
            if (currentChunk < totalChunks - 1 && result.status === 'uploading') {
              currentChunk++;
              continue;
            }
            
            uploadSuccessful = result.status !== 'error';
            uploadMessage = result.message || '';
            if (currentChunk === totalChunks - 1) {
              setUploadProgress(100);
              prevProgressRef.current = 100;
              return { status: result.status, message: result.message };
            }
            
            currentChunk++;
          } catch (error) {
            uploadSuccessful = false;
            throw new Error(isApiError(error) ? error.message : 'An error occurred during upload.');
          }
        }
        
        if (!uploadSuccessful) {
          throw new Error(uploadMessage || 'Upload failed');
        }
      } catch (error: unknown) {
        console.error('Upload API error:', error);
        const message = isApiError(error)
          ? error.message
          : 'An unknown error occurred during upload.';
        throw new Error(message);
      }

      return { status: 'error' as const, message: uploadMessage };
    },
    [projectId, onUploadError]
  );

  const handleUploads = useCallback(
    async (filesToUpload: File[]) => {
      const invalidFiles = filesToUpload.filter(
        (file) => file.type !== 'text/csv' && !file.name.toLowerCase().endsWith('.csv')
      );

      if (invalidFiles.length > 0) {
        onUploadError('Invalid file type. Please upload CSV files only.');
        return;
      }

      setIsUploadingInternal(true);
      onUploadStart();
      onUploadBatchStart(filesToUpload);
      setUploadStage('uploading');
      setTotalFiles(filesToUpload.length);
      let lastStatus: ProcessingStatus = 'complete';
      let lastMessage = '';

      try {
        for (let index = 0; index < filesToUpload.length; index += 1) {
          setCurrentFileIndex(index + 1);
          prevProgressRef.current = 0;
          setUploadProgress(0);
          const result = await uploadSingleFile(filesToUpload[index]);
          if (result?.status) {
            lastStatus = result.status;
            lastMessage = result.message ?? '';
          }
        }

        const uploadCount = filesToUpload.length;
        const pluralSuffix = uploadCount === 1 ? '' : 's';
        let summaryMessage = lastMessage;

        if (uploadCount > 0) {
          if (lastStatus === 'complete') {
            summaryMessage = `All ${uploadCount} CSV${pluralSuffix} uploaded and processed.`;
          } else if (lastStatus === 'processing') {
            summaryMessage = `All ${uploadCount} CSV${pluralSuffix} uploaded. Processing started.`;
          } else if (!lastMessage) {
            summaryMessage = `CSV upload finished for ${uploadCount} file${pluralSuffix}.`;
          }
        }

        onUploadSuccess(lastStatus, summaryMessage);
      } catch (error: unknown) {
        const message = isApiError(error)
          ? error.message
          : error instanceof Error
            ? error.message
            : 'An unknown error occurred during upload.';
        onUploadError(message);
      } finally {
        setIsUploadingInternal(false);
        setCurrentFileIndex(0);
        setTotalFiles(0);
        setUploadStage('idle');
        setUploadProgress(0);
        prevProgressRef.current = 0;
      }
    },
    [onUploadBatchStart, onUploadError, onUploadStart, onUploadSuccess, uploadSingleFile]
  );

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);
      const files = Array.from(e.dataTransfer.files ?? []);
      if (files.length > 0) {
        handleUploads(files);
      }
    },
    [handleUploads]
  );

  return (
    <div className="w-full">
      <form
        id="form-file-upload"
        onDragEnter={handleDrag}
        onSubmit={(e) => e.preventDefault()}
        className="w-full"
      >
        <input
          ref={inputRef}
          type="file"
          id="input-file-upload"
          accept=".csv, text/csv"
          multiple
          className="hidden"
          onChange={handleFileChange}
          disabled={isUploadingInternal}
        />
        <label
          htmlFor="input-file-upload"
          className={`relative flex items-center justify-center w-full h-10 border border-dashed rounded cursor-pointer transition-colors duration-200 ${
            dragActive
              ? 'border-blue-500 bg-blue-50'
              : 'border-border bg-white hover:bg-surface-muted'
          } ${isUploadingInternal ? 'opacity-70 cursor-not-allowed' : ''}`}
        >
          <div className="flex items-center gap-1 w-full justify-center">
            {isUploadingInternal ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-muted" />
                <span className="text-xs text-muted">
                  {getStageLabel(uploadStage)}
                  {totalFiles > 0 ? ` ${currentFileIndex}/${totalFiles}` : ''}...
                  {uploadStage === 'uploading' ? ` ${uploadProgress}%` : ''}
                </span>
              </>
            ) : (
              <>
                <UploadCloud
                  className={`w-4 h-4 ${dragActive ? 'text-blue-500' : 'text-muted'}`}
                />
                <span className="text-xs text-muted">Upload CSVs</span>
              </>
            )}
          </div>
          {dragActive && (
            <div
              className="absolute inset-0 w-full h-full rounded"
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            />
          )}
        </label>
      </form>
    </div>
  );
};

export default FileUploader;
