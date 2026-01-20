/**
 * CSV API module
 * Handles CSV upload, download, and export operations
 */
import axios from 'axios';
import type { ProcessingStatus, CSVUpload } from '../types';
import { request, invalidateCache, axiosInstance, isError } from './client';
import authService from '../authService';

// ============================================================================
// CSV Upload Operations
// ============================================================================

export async function fetchCSVUploads(projectId: string): Promise<CSVUpload[]> {
  const url = `/api/projects/${projectId}/csv-uploads`;
  // Do not cache CSV uploads list: users expect it to reflect recent uploads immediately.
  const data = await request<CSVUpload[]>('get', url, undefined, undefined, false);
  return data;
}

export async function downloadCSVUpload(projectId: string, uploadId: number): Promise<Blob> {
  try {
    const authToken = authService.getAccessToken();
    const response = await axiosInstance.get(
      `/api/projects/${projectId}/csv-uploads/${uploadId}/download`,
      {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        responseType: 'blob',
      }
    );
    return response.data;
  } catch (error) {
    console.error('Download CSV upload API Error:', error);
    throw new Error(isError(error) ? error.message : 'Failed to download uploaded CSV');
  }
}

export async function uploadCSV(
  projectId: string,
  formData: FormData,
  onUploadProgress?: (progress: number) => void
): Promise<{ message: string; status: ProcessingStatus; file_name?: string }> {
  try {
    invalidateCache(`/api/projects/${projectId}`);
    invalidateCache(`/api/projects/${projectId}/csv-uploads`);
    invalidateCache(`/api/projects/${projectId}/keywords`);
    invalidateCache(`/api/projects/${projectId}/stats`);
    invalidateCache(`/api/projects/${projectId}/tokens`);
    invalidateCache(`/api/projects/${projectId}/initial-data`);
    invalidateCache('/api/projects/with-stats');

    const chunkIndex = formData.get('chunkIndex');
    const totalChunks = formData.get('totalChunks');
    const url = `/api/projects/${projectId}/upload?_t=${Date.now()}`;

    const authToken = authService.getAccessToken();
    const response = await axiosInstance.post(url, formData, {
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total && onUploadProgress) {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onUploadProgress(percentCompleted);
        }
      },
      timeout: 120000,
    });

    if (chunkIndex && totalChunks && Number(chunkIndex) < Number(totalChunks) - 1) {
      return {
        message: `Uploaded chunk ${Number(chunkIndex) + 1} of ${totalChunks}`,
        status: 'uploading',
        file_name: formData.get('originalFilename') as string,
      };
    }

    return response.data;
  } catch (error) {
    console.error('Upload CSV API Error:', error);
    if (axios.isAxiosError(error) && error.response?.data?.detail) {
      throw new Error(error.response.data.detail);
    }
    throw new Error(isError(error) ? error.message : 'Failed to upload CSV');
  }
}

// ============================================================================
// Export Operations
// ============================================================================

export async function exportGroupedKeywords(projectId: string, view = 'grouped'): Promise<Blob> {
  try {
    const authToken = authService.getAccessToken();
    const response = await axiosInstance.get(`/api/projects/${projectId}/export-csv?view=${view}`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
      responseType: 'blob',
    });

    return response.data;
  } catch (error) {
    console.error('Export API Error:', error);
    throw new Error(isError(error) ? error.message : 'Failed to export CSV');
  }
}

export async function exportParentKeywords(projectId: string): Promise<Blob> {
  try {
    const authToken = authService.getAccessToken();
    const response = await axiosInstance.get(`/api/projects/${projectId}/export-parent-keywords`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'multipart/form-data',
      },
      responseType: 'blob',
    });

    return response.data;
  } catch (error) {
    console.error('Export Parent Keywords API Error:', error);
    throw new Error(isError(error) ? error.message : 'Failed to export parent keywords CSV');
  }
}

export async function importParentKeywords(projectId: string, formData: FormData): Promise<unknown> {
  try {
    const authToken = authService.getAccessToken();
    const response = await axiosInstance.post(
      `/api/projects/${projectId}/import-parent-keywords`,
      formData,
      {
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'multipart/form-data',
        },
      }
    );

    return response.data;
  } catch (error) {
    console.error('Import Parent Keywords API Error:', error);
    throw new Error(isError(error) ? error.message : 'Failed to import parent keywords CSV');
  }
}
