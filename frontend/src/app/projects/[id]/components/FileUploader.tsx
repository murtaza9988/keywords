"use client";
import React, { useState, useCallback, useRef } from 'react';
import apiClient from '@/lib/apiClient';
import { UploadCloud, Loader2 } from 'lucide-react';
import { ProcessingStatus } from '@/lib/types';

interface FileUploaderProps {
  projectId: string;
  onUploadStart: () => void;
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
  onUploadSuccess,
  onUploadError,
}) => {
  const [isUploadingInternal, setIsUploadingInternal] = useState<boolean>(false);
  const [dragActive, setDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const prevProgressRef = useRef<number>(0);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type !== 'text/csv' && !file.name.toLowerCase().endsWith('.csv')) {
        onUploadError('Invalid file type. Please upload a CSV file.');
        if (inputRef.current) inputRef.current.value = '';
        return;
      }
      handleUpload(file);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleUpload = useCallback(
    async (fileToUpload: File) => {
      if (!fileToUpload || !projectId) {
        console.error('File or Project ID missing for upload');
        onUploadError('Cannot start upload: file or project ID missing.');
        return;
      }
  

      
      setIsUploadingInternal(true);
      prevProgressRef.current = 0;
      setUploadProgress(0);
      onUploadStart();
      
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
          try {
            const result = await apiClient.uploadCSV(projectId, formData, (chunkProgress) => {
              const adjustedChunkProgress = chunkProgress / totalChunks;
              const compositeProgress = Math.floor(baseProgress + adjustedChunkProgress);
              const newProgress = Math.max(prevProgressRef.current, compositeProgress);
              prevProgressRef.current = newProgress;
              setUploadProgress(newProgress);
            });
            
            if (currentChunk < totalChunks - 1 && result.status === 'complete') {
              currentChunk++;
              continue;
            }
            
            uploadSuccessful = result.status !== 'error';
            uploadMessage = result.message || '';
            if (currentChunk === totalChunks - 1) {
              setUploadProgress(100);
              prevProgressRef.current = 100;
              onUploadSuccess(result.status, result.message);
              if (result.status === 'complete' || result.status === 'processing') {
                setTimeout(() => {
                  window.location.reload();
                }, 1500);
              }
              break;
            }
            
            currentChunk++;
          } catch (error) {
            uploadSuccessful = false;
            onUploadError(isApiError(error) ? error.message : 'An error occurred during upload.');
            break;
          }
        }
        
        if (!uploadSuccessful) {
          throw new Error(uploadMessage || 'Upload failed');
        }
      } catch (error: unknown) {
        console.error('Upload API error:', error);
        setIsUploadingInternal(false);
        const message = isApiError(error)
          ? error.message
          : 'An unknown error occurred during upload.';
        onUploadError(message);
      } finally {
        setIsUploadingInternal(false);
      }
    },
    [projectId, onUploadStart, onUploadSuccess, onUploadError]
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
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        const file = e.dataTransfer.files[0];
        if (file.type !== 'text/csv' && !file.name.toLowerCase().endsWith('.csv')) {
          onUploadError('Invalid file type. Please upload a CSV file.');
          return;
        }
        handleUpload(file);
      }
    },
    [handleUpload, onUploadError]
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
                <span className="text-xs text-gray-500">Uploading... {uploadProgress}%</span>
              </>
            ) : (
              <>
                <UploadCloud
                  className={`w-4 h-4 ${dragActive ? 'text-blue-500' : 'text-gray-400'}`}
                />
                
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