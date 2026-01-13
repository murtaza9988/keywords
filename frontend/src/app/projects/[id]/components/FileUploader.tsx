"use client";
import React, { useState, useCallback, useRef } from 'react';
import apiClient from '@/lib/apiClient';
import { UploadCloud, Loader2 } from 'lucide-react';
import { ProcessingStatus } from '@/lib/types';

interface FileUploaderProps {
  projectId: string;
  onUploadStart: (totalFiles: number) => void;
  onUploadSuccess: (backendStatus: ProcessingStatus, message?: string, fileName?: string) => void;
  onUploadError: (message: string, fileName?: string) => void;
  onUploadComplete: (summary: { totalFiles: number; successCount: number; failureCount: number }) => void;
}

interface ApiError {
  message: string;
}
function isApiError(error: unknown): error is ApiError {
  return typeof error === 'object' && error !== null && 'message' in error;
}

type UploadStage = 'queued' | 'uploading' | 'finalizing' | 'complete' | 'error';

interface UploadItem {
  id: string;
  file: File;
  progress: number;
  stage: UploadStage;
  message?: string;
}

const FileUploader: React.FC<FileUploaderProps> = ({
  projectId,
  onUploadStart,
  onUploadSuccess,
  onUploadError,
  onUploadComplete,
}) => {
  const [isUploadingInternal, setIsUploadingInternal] = useState<boolean>(false);
  const [dragActive, setDragActive] = useState(false);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const prevProgressRef = useRef<number>(0);

  const updateUpload = useCallback((id: string, updates: Partial<UploadItem>) => {
    setUploads((prev) =>
      prev.map((upload) => (upload.id === id ? { ...upload, ...updates } : upload))
    );
  }, []);

  const uploadSingleFile = useCallback(
    async (upload: UploadItem): Promise<boolean> => {
      const fileToUpload = upload.file;
      if (!fileToUpload || !projectId) {
        console.error('File or Project ID missing for upload');
        onUploadError('Cannot start upload: file or project ID missing.', fileToUpload?.name);
        updateUpload(upload.id, { stage: 'error', message: 'Missing project or file.' });
        return false;
      }

      prevProgressRef.current = 0;
      updateUpload(upload.id, { stage: 'uploading', progress: 0 });

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
          updateUpload(upload.id, { progress: Math.max(prevProgressRef.current, baseProgress) });
          try {
            const result = await apiClient.uploadCSV(projectId, formData, (chunkProgress) => {
              const adjustedChunkProgress = chunkProgress / totalChunks;
              const compositeProgress = Math.floor(baseProgress + adjustedChunkProgress);
              const newProgress = Math.max(prevProgressRef.current, compositeProgress);
              prevProgressRef.current = newProgress;
              updateUpload(upload.id, { progress: newProgress, stage: 'uploading' });
            });

            if (currentChunk < totalChunks - 1 && result.status === 'complete') {
              currentChunk++;
              continue;
            }

            uploadSuccessful = result.status !== 'error';
            uploadMessage = result.message || '';
            if (currentChunk === totalChunks - 1) {
              updateUpload(upload.id, { progress: 100, stage: 'finalizing' });
              onUploadSuccess(result.status, result.message, fileToUpload.name);
              updateUpload(upload.id, { stage: uploadSuccessful ? 'complete' : 'error', message: uploadMessage });
              break;
            }

            currentChunk++;
          } catch (error) {
            uploadSuccessful = false;
            const message = isApiError(error) ? error.message : 'An error occurred during upload.';
            onUploadError(message, fileToUpload.name);
            updateUpload(upload.id, { stage: 'error', message });
            break;
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
        onUploadError(message, fileToUpload.name);
        updateUpload(upload.id, { stage: 'error', message });
        return false;
      }
      return true;
    },
    [projectId, onUploadSuccess, onUploadError, updateUpload]
  );

  const handleFilesSelected = useCallback(
    async (files: FileList) => {
      const fileArray = Array.from(files);
      if (!fileArray.length) return;

      const validFiles = fileArray.filter((file) => file.name.toLowerCase().endsWith('.csv'));
      const invalidFiles = fileArray.filter((file) => !file.name.toLowerCase().endsWith('.csv'));

      invalidFiles.forEach((file) =>
        onUploadError(`Invalid file type for ${file.name}. Please upload a CSV file.`, file.name)
      );

      if (!validFiles.length) {
        if (inputRef.current) inputRef.current.value = '';
        return;
      }

      const newUploads = validFiles.map((file) => ({
        id: `${file.name}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        file,
        progress: 0,
        stage: 'queued' as UploadStage
      }));

      setUploads(newUploads);
      setIsUploadingInternal(true);
      onUploadStart(newUploads.length);

      let successCount = 0;
      let failureCount = 0;

      for (const upload of newUploads) {
        updateUpload(upload.id, { stage: 'uploading' });
        const success = await uploadSingleFile(upload);
        if (success) {
          successCount += 1;
        } else {
          failureCount += 1;
        }
      }

      setIsUploadingInternal(false);
      onUploadComplete({
        totalFiles: newUploads.length,
        successCount,
        failureCount
      });

      if (inputRef.current) inputRef.current.value = '';
    },
    [onUploadStart, onUploadComplete, onUploadError, updateUpload, uploadSingleFile]
  );

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      handleFilesSelected(files);
    }
  };

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
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleFilesSelected(e.dataTransfer.files);
      }
    },
    [handleFilesSelected]
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
              : 'border-gray-300 bg-gray-50 hover:bg-gray-100'
          } ${isUploadingInternal ? 'opacity-70 cursor-not-allowed' : ''}`}
        >
          <div className="flex items-center gap-1 w-full justify-center">
            {isUploadingInternal ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
                <span className="text-xs text-gray-500">Uploading selected CSVs...</span>
              </>
            ) : (
              <>
                <UploadCloud
                  className={`w-4 h-4 ${dragActive ? 'text-blue-500' : 'text-gray-400'}`}
                />
                <span className="text-xs text-gray-600">Upload CSVs</span>
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
      <div className="mt-2 space-y-1">
        <p className="text-[11px] text-gray-500">
          Supports UTF-8 and UTF-16 CSV files. You can select multiple files at once.
        </p>
        {uploads.length > 0 && (
          <ul className="space-y-1 text-[11px] text-gray-600">
            {uploads.map((upload) => (
              <li key={upload.id} className="flex items-center justify-between">
                <span className="truncate">{upload.file.name}</span>
                <span className="ml-2 text-gray-500">
                  {upload.stage === 'queued' && 'Queued'}
                  {upload.stage === 'uploading' && `Uploading ${Math.round(upload.progress)}%`}
                  {upload.stage === 'finalizing' && 'Finalizing upload'}
                  {upload.stage === 'complete' && 'Upload complete'}
                  {upload.stage === 'error' && 'Upload failed'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default FileUploader;
