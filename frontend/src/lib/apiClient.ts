import axios, { AxiosInstance, AxiosResponse } from 'axios';
import {
  Project,
  Keyword,
  PaginationInfo,
  FetchKeywordsResponse,
  LoginResponse,
  CreateProjectResponse,
  KeywordChildrenData,
  ProcessingStatus,
  ProcessingStatusResponse,
  GroupKeywordsResponse,
  BlockTokenResponse,
  UnblockKeywordsResponse,
  TokenListResponse,
  Note,
  CSVUpload,
  ActivityLog,
  ActivityLogListResponse,
} from './types';
import authService from './authService';

// BASE_URL should be the backend origin (WITHOUT trailing `/api`).
// All client methods already prefix paths with `/api/...`.
const RAW_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const BASE_URL = RAW_BASE_URL.replace(/\/api\/?$/, '');

function isError(error: unknown): error is Error {
  return error instanceof Error;
}

interface ApiKeyword {
  id: number;
  project_id?: number;
  keyword?: string | null;
  tokens?: string[] | null;
  volume?: number | null;
  length?: number | null;
  difficulty?: number | null;
  rating?: number | null;
  isParent?: boolean | null;
  groupId?: string | null;
  groupName?: string | null;
  status?: 'ungrouped' | 'grouped' | 'confirmed' | 'blocked' | string | null;
  childCount?: number | null;
  original_volume?: number | null;
  serpFeatures?: string[] | null;
}

interface ApiProject {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
}

interface ApiProjectStats {
  ungroupedCount: number;
  groupedKeywordsCount: number;
  groupedPages: number;
  confirmedKeywordsCount: number;
  confirmedPages: number;
  blockedCount: number;
  totalKeywords: number;
  totalParentKeywords: number;
  ungroupedPercent: number;
  groupedPercent: number;
  confirmedPercent: number;
  blockedPercent: number;
}

interface ApiProjectWithStats extends ApiProject {
  stats?: ApiProjectStats;
}

interface ProjectsWithStatsResponse {
  projects: ApiProjectWithStats[];
}

interface ApiKeywordListResponse {
  ungroupedKeywords?: ApiKeyword[];
  groupedKeywords?: ApiKeyword[];
  confirmedKeywords?: ApiKeyword[];
  blockedKeywords?: ApiKeyword[];
  pagination?: PaginationInfo;
}

interface ApiKeywordChildrenResponse {
  children?: ApiKeyword[];
}

interface ApiInitialDataResponse {
  keywords?: Record<string, ApiKeyword[]>;
  stats?: ApiInitialProjectStats;
  pagination?: PaginationInfo;
  currentView?: {
    status?: string;
    keywords?: ApiKeyword[];
  };
  processingStatus?: {
    status?: ProcessingStatus;
    progress?: number;
    complete?: boolean;
    message?: string;
    currentFileName?: string | null;
    queuedFiles?: string[];
    queueLength?: number;
    uploadedFiles?: string[];
    processedFiles?: string[];
    uploadedFileCount?: number;
    processedFileCount?: number;
    validationError?: string | null;
  };
}

interface ApiInitialProjectStats {
  ungroupedCount: number;
  groupedKeywordsCount: number;
  groupedPages: number;
  blockedCount: number;
  totalKeywords: number;
  ungroupedPercent: number;
  groupedPercent: number;
  blockedPercent: number;
  confirmedKeywordsCount?: number;
  confirmedPages?: number;
  confirmedPercent?: number;
  totalParentKeywords?: number;
}

interface ApiConfirmationResponse {
  message: string;
  count: number;
}

interface ApiTokenOperationResponse {
  message: string;
  affected_keywords?: number;
}

interface ApiCreateTokenResponse extends ApiTokenOperationResponse {
  affected_keywords: number;
}

interface ApiActivityLog {
  id: number;
  projectId?: number;
  project_id?: number;
  user: string;
  action: string;
  details?: Record<string, unknown> | null;
  createdAt?: string;
  created_at?: string;
}

interface ApiActivityLogListResponse {
  logs: ApiActivityLog[];
  pagination: PaginationInfo;
}

const mapKeyword = (keywordData: ApiKeyword): Keyword => {
  const normalizedStatus: Keyword['status'] =
    keywordData.status === 'ungrouped' ||
    keywordData.status === 'grouped' ||
    keywordData.status === 'blocked' ||
    keywordData.status === 'confirmed'
      ? keywordData.status
      : 'ungrouped';

  return {
  id: keywordData.id,
  project_id: keywordData.project_id ?? 0,
  keyword: keywordData.keyword ?? '',
  tokens: Array.isArray(keywordData.tokens) ? keywordData.tokens : [],
  volume: typeof keywordData.volume === 'number' ? keywordData.volume : 0,
  length: typeof keywordData.length === 'number' ? keywordData.length : (keywordData.keyword ?? '').length,
  difficulty: typeof keywordData.difficulty === 'number' ? keywordData.difficulty : 0,
  rating: typeof keywordData.rating === 'number' ? keywordData.rating : undefined,
  isParent: !!keywordData.isParent,
  groupId: typeof keywordData.groupId === 'string' ? keywordData.groupId : null,
  groupName: typeof keywordData.groupName === 'string' ? keywordData.groupName : null,
  status: normalizedStatus,
  childCount: typeof keywordData.childCount === 'number' ? keywordData.childCount : 0,
  original_volume: typeof keywordData.original_volume === 'number' ? keywordData.original_volume : 0,
  serpFeatures: Array.isArray(keywordData.serpFeatures) ? keywordData.serpFeatures : []
  };
};

const mapProject = (projectData: ApiProject): Project => ({
  id: projectData.id,
  name: projectData.name ?? 'Unnamed Project',
  created_at: projectData.created_at ?? new Date().toISOString(),
  updated_at: projectData.updated_at ?? new Date().toISOString(),
});

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expires: number;
}

class ApiCache {
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private defaultTTLMs: number;
  
  constructor(defaultTTLMs = 30000) {
    this.defaultTTLMs = defaultTTLMs;
  }
  
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    const now = Date.now();
    if (now > entry.expires) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data as T;
  }
  
  set<T>(key: string, data: T, ttlMs?: number): void {
    const timestamp = Date.now();
    const expires = timestamp + (ttlMs || this.defaultTTLMs);
    
    this.cache.set(key, { data, timestamp, expires });
  }
  
  invalidate(keyPattern: string): void {
    const keysToDelete: string[] = [];
    
    for (const key of this.cache.keys()) {
      if (key.includes(keyPattern)) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => {
      this.cache.delete(key);
    });
    
    console.log(`Invalidated ${keysToDelete.length} cache entries matching "${keyPattern}"`);
  }
  
  clear(): void {
    this.cache.clear();
  }
}

class ApiClient {
  private axiosInstance: AxiosInstance;
  private cache: ApiCache;

  constructor(baseURL: string, defaultToken?: string) {
    this.axiosInstance = axios.create({
      baseURL,
      headers: {
        'Content-Type': 'application/json',
        ...(defaultToken && { Authorization: `Bearer ${defaultToken}` }),
      },
    });
    
    this.cache = new ApiCache();

    this.axiosInstance.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;
        
        // Handle 401 errors with automatic token refresh
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;
          
          try {
            // Try to refresh the token
            await authService.refreshAccessToken();
            const newToken = authService.getAccessToken();
            
            if (newToken) {
              // Retry the original request with new token
              originalRequest.headers.Authorization = `Bearer ${newToken}`;
              return this.axiosInstance.request(originalRequest);
            }
          } catch {
            // If refresh fails, logout user
            authService.logout();
            return Promise.reject(new Error('Session expired. Please login again.'));
          }
        }
        
        const message = error.response?.data?.detail || error.response?.data?.message || error.message || 'Unknown error';
        return Promise.reject(new Error(message));
      }
    );
  }

    private async request<T>(
      method: 'get' | 'post' | 'delete' | 'put',
      url: string,
      data?: unknown,
      token?: string,
      useCache = false
    ): Promise<T> {
      const maxRetries = 2;
      let attempt = 0;
    
      while (attempt <= maxRetries) {
        try {
          const cacheKey = useCache ? `${method}:${url}:${JSON.stringify(data)}` : '';
    
          if (useCache) {
            const cachedData = this.cache.get<T>(cacheKey);
            if (cachedData) return cachedData;
          }
    
          // Use provided token or get from auth service
          const authToken = token || authService.getAccessToken();
          
          const config: {
            method: typeof method;
            url: string;
            data?: unknown;
            headers?: { Authorization: string };
          } = { method, url };

          if (data !== undefined) {
            config.data = data;
          }

          if (authToken) {
            config.headers = { Authorization: `Bearer ${authToken}` };
          }
    
          const response: AxiosResponse<T> = await this.axiosInstance.request(config);
          const responseData = response.status === 204 ? ({} as T) : response.data;
    
          if (useCache) {
            this.cache.set<T>(cacheKey, responseData);
          }
    
          return responseData;
        } catch (error) {
          attempt++;
          const errorMessage = isError(error) ? error.message : `Failed to perform ${method} request on ${url}`;
          console.error(`Attempt ${attempt} - ${method.toUpperCase()} ${url} API Error:`, error);
    
          if (attempt > maxRetries) {
            throw new Error(`Max retries (${maxRetries}) reached for ${method} ${url}: ${errorMessage}`);
          }
    
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
    
      throw new Error('Unexpected error in request retry logic');
    }

  async login(username: string, password: string): Promise<LoginResponse> {
    return this.request<LoginResponse>('post', '/api/login', { username, password });
  }

  async fetchProjects(): Promise<Project[]> {
    const data = await this.request<ApiProject[]>('get', '/api/projects', undefined, undefined, true);
    return data.map(mapProject);
  }

  async fetchProjectsWithStats(): Promise<ProjectsWithStatsResponse> {
    const data = await this.request<ProjectsWithStatsResponse>('get', '/api/projects/with-stats', undefined, undefined, true);
    return data;
  }

  async fetchProjectLogs(projectId: string): Promise<ActivityLog[]> {
    const data = await this.request<ApiActivityLog[]>(
      'get',
      `/api/projects/${projectId}/logs`,
      undefined,
      undefined,
      false
    );
    return data.map((log) => ({
      ...log,
      projectId: log.projectId ?? log.project_id ?? Number(projectId),
      createdAt: log.createdAt ?? log.created_at ?? new Date().toISOString(),
      details: log.details ?? null,
    }));
  }

  async fetchAllActivityLogs(filters: {
    projectId?: number;
    user?: string;
    action?: string;
    startDate?: string | Date;
    endDate?: string | Date;
    page?: number;
    limit?: number;
  } = {}): Promise<ActivityLogListResponse> {
    const params = new URLSearchParams();
    if (filters.projectId !== undefined) {
      params.set('projectId', String(filters.projectId));
    }
    if (filters.user) {
      params.set('user', filters.user);
    }
    if (filters.action) {
      params.set('action', filters.action);
    }
    if (filters.startDate) {
      const value =
        filters.startDate instanceof Date ? filters.startDate.toISOString() : filters.startDate;
      params.set('startDate', value);
    }
    if (filters.endDate) {
      const value = filters.endDate instanceof Date ? filters.endDate.toISOString() : filters.endDate;
      params.set('endDate', value);
    }
    if (filters.page) {
      params.set('page', String(filters.page));
    }
    if (filters.limit) {
      params.set('limit', String(filters.limit));
    }
    const query = params.toString();
    const url = query ? `/api/logs?${query}` : '/api/logs';
    const data = await this.request<ApiActivityLogListResponse>(
      'get',
      url,
      undefined,
      undefined,
      false
    );
    const logs = data.logs.map((log) => ({
      ...log,
      projectId: log.projectId ?? log.project_id ?? 0,
      createdAt: log.createdAt ?? log.created_at ?? new Date().toISOString(),
      details: log.details ?? null,
    }));
    return { logs, pagination: data.pagination };
  }

  async fetchSingleProjectStats(projectId: string): Promise<ApiProjectStats> {
    const data = await this.request<ApiProjectStats>('get', `/api/projects/${projectId}/stats`, undefined, undefined, true);
    return data;
  }

  async createProject(name: string): Promise<Project> {
    const data = await this.request<CreateProjectResponse>('post', '/api/projects', { name });
    this.cache.invalidate('/api/projects');
    this.cache.invalidate('/api/projects/with-stats');
    return mapProject(data);
  }

  async updateProject(projectId: number, name: string): Promise<Project> {
    const data = await this.request<CreateProjectResponse>('put', `/api/projects/${projectId}`, { name });
    this.cache.invalidate(`/api/projects`);
    this.cache.invalidate(`/api/projects/${projectId}`);
    this.cache.invalidate('/api/projects/with-stats');
    return mapProject(data);
  }

  async deleteProject(projectId: number): Promise<boolean> {
    await this.request('delete', `/api/projects/${projectId}`);
    this.cache.invalidate(`/api/projects/${projectId}`);
    this.cache.invalidate('/api/projects');
    this.cache.invalidate('/api/projects/with-stats');
    return true;
  }

  async fetchKeywords(
    projectId: string, 
    queryParams: URLSearchParams,
    useCache: boolean = false
  ): Promise<FetchKeywordsResponse> {
    const url = `/api/projects/${projectId}/keywords?${queryParams.toString()}`;
    const data = await this.request<ApiKeywordListResponse>('get', url, undefined, undefined, useCache);
    
    const ungroupedKeywords = (data?.ungroupedKeywords || []).map(mapKeyword);
    const groupedKeywords = (data?.groupedKeywords || []).map(mapKeyword);
    const confirmedKeywords = (data?.confirmedKeywords || []).map(mapKeyword);
    const blockedKeywords = (data?.blockedKeywords || []).map(mapKeyword);
    const pagination: PaginationInfo = data?.pagination || { total: 0, page: 1, limit: 100, pages: 0 };

    return { ungroupedKeywords, groupedKeywords, confirmedKeywords, blockedKeywords, pagination };
  }
  async fetchNotes(projectId: string): Promise<Note> {
    const url = `/api/projects/${projectId}/notes`;
    try {
      const data = await this.request<Note>('get', url, undefined, undefined, false);
      return data;
    } catch (error) {
      console.error('Error fetching notes:', error);
      return { id: 0, project_id: Number(projectId), note1: '', note2: '', created_at: new Date(), updated_at: new Date() };
    }
  }

  async saveNotes(projectId: string, note1: string, note2: string): Promise<Note> {
    const url = `/api/projects/${projectId}/notes`;
    try {
      const data = await this.request<Note>('post', url, { note1, note2 }, undefined, false);
      return data;
    } catch (error) {
      console.error('Error saving notes:', error);
      throw error;
    }
  }

  async fetchInitialData(projectId: string): Promise<ApiInitialDataResponse> {
    const url = `/api/projects/${projectId}/initial-data`;
    const data = await this.request<ApiInitialDataResponse>('get', url, undefined, undefined, true);
    
    if (data?.keywords) {
      for (const viewKey in data.keywords) {
        if (Object.prototype.hasOwnProperty.call(data.keywords, viewKey)) {
          data.keywords[viewKey] = data.keywords[viewKey].map(mapKeyword);
        }
      }
    }
    
    return data;
  }

  async fetchChildren(projectId: string, groupId: string): Promise<KeywordChildrenData> {
    if (!groupId) {
      console.warn("fetchChildren called with invalid groupId");
      return { children: [] };
    }
    
    const timestamp = Date.now();
    const data = await this.request<ApiKeywordChildrenResponse>(
      'get',
      `/api/projects/${projectId}/groups/${groupId}/children?_t=${timestamp}`,
      undefined,
      undefined,
      false
    );
    
    const mappedChildren = (data?.children || []).map(mapKeyword);
    return { children: mappedChildren };
  }
  async fetchCSVUploads(projectId: string): Promise<CSVUpload[]> {
    const url = `/api/projects/${projectId}/csv-uploads`;
    // Do not cache CSV uploads list: users expect it to reflect recent uploads immediately.
    const data = await this.request<CSVUpload[]>('get', url, undefined, undefined, false);
    return data;
  }

  async downloadCSVUpload(projectId: string, uploadId: number): Promise<Blob> {
    try {
      const authToken = authService.getAccessToken();
      const response = await this.axiosInstance.get(
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

  async uploadCSV(
    projectId: string,
    formData: FormData,
    onUploadProgress?: (progress: number) => void
  ): Promise<{ message: string; status: ProcessingStatus; file_name?: string }> {
    try {
      this.cache.invalidate(`/api/projects/${projectId}`);
      this.cache.invalidate(`/api/projects/${projectId}/csv-uploads`);
      const chunkIndex = formData.get('chunkIndex');
      const totalChunks = formData.get('totalChunks');
      const url = `/api/projects/${projectId}/upload?_t=${Date.now()}`;
      
      const authToken = authService.getAccessToken();
      const response = await this.axiosInstance.post(url, formData, {
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
          file_name: formData.get('originalFilename') as string
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

  async checkProcessingStatus(projectId: string): Promise<ProcessingStatusResponse> {
    return this.request<ProcessingStatusResponse>(
      'get', 
      `/api/projects/${projectId}/processing-status?_t=${Date.now()}`,
      undefined, 
      undefined,
      false
    );
  }

  async groupKeywords(projectId: string, keywordIds: number[], groupName: string): Promise<GroupKeywordsResponse> {
    const data = await this.request<GroupKeywordsResponse>(
      'post',
      `/api/projects/${projectId}/group`,
      { keywordIds, groupName }
    );
    
    this.cache.invalidate(`/api/projects/${projectId}/keywords`);
    this.cache.invalidate(`/api/projects/${projectId}/stats`);
    this.cache.invalidate('/api/projects/with-stats');
    
    return data;
  }

  async blockToken(projectId: string, blockTokenValue: string): Promise<BlockTokenResponse> {
    const data = await this.request<BlockTokenResponse>(
      'post',
      `/api/projects/${projectId}/block-token`,
      { token: blockTokenValue }
    );
    
    this.cache.invalidate(`/api/projects/${projectId}/keywords`);
    this.cache.invalidate(`/api/projects/${projectId}/stats`);
    this.cache.invalidate('/api/projects/with-stats');
    
    return data;
  }

  async unblockKeywords(projectId: string, keywordIds: number[]): Promise<UnblockKeywordsResponse> {
    const data = await this.request<UnblockKeywordsResponse>(
      'post',
      `/api/projects/${projectId}/unblock`,
      { keywordIds }
    );
    
    this.cache.invalidate(`/api/projects/${projectId}/keywords`);
    this.cache.invalidate(`/api/projects/${projectId}/stats`);
    this.cache.invalidate('/api/projects/with-stats');
    
    return data;
  }

  async ungroupKeywords(projectId: string, keywordIds: number[]): Promise<UnblockKeywordsResponse> {
    const data = await this.request<UnblockKeywordsResponse>(
      'post',
      `/api/projects/${projectId}/ungroup`,
      { keywordIds }
    );
    
    this.cache.invalidate(`/api/projects/${projectId}/keywords`);
    this.cache.invalidate(`/api/projects/${projectId}/stats`);
    this.cache.invalidate('/api/projects/with-stats');
    
    return data;
  }

  async regroupKeywords(projectId: string, keywordIds: number[], groupName: string): Promise<GroupKeywordsResponse> {
    const data = await this.request<GroupKeywordsResponse>(
      'post',
      `/api/projects/${projectId}/regroup`,
      { keywordIds, groupName }
    );
    
    this.cache.invalidate(`/api/projects/${projectId}/keywords`);
    this.cache.invalidate(`/api/projects/${projectId}/stats`);
    this.cache.invalidate(`/api/projects/${projectId}/groups`);
    this.cache.invalidate('/api/projects/with-stats');
    
    return data;
  }
  
  async getBlockTokenCount(projectId: string, tokenToBlock: string): Promise<{ count: number }> {
    return this.request<{ count: number }>(
      'get',
      `/api/projects/${projectId}/block-token-count?token=${encodeURIComponent(tokenToBlock)}`,
      undefined,
      undefined
    );
  }

  clearCache(pattern?: string): void {
    if (pattern) {
      this.cache.invalidate(pattern);
    } else {
      this.cache.clear();
    }
  }

  async fetchTokens(
    projectId: string,
    queryParams: URLSearchParams,
    useCache: boolean = false
  ): Promise<TokenListResponse> {
    const url = `/api/projects/${projectId}/tokens?${queryParams.toString()}`;
    const data = await this.request<TokenListResponse>('get', url, undefined, undefined, useCache);
    return {
      tokens: data.tokens || [],
      pagination: data.pagination || { total: 0, page: 1, limit: 100, pages: 0 }
    };
  }

  async blockTokens(projectId: string, tokens: string[]): Promise<BlockTokenResponse> {
    const data = await this.request<BlockTokenResponse>(
      'post',
      `/api/projects/${projectId}/block-tokens`,
      { tokens }
    );
    
    this.cache.invalidate(`/api/projects/${projectId}/keywords`);
    this.cache.invalidate(`/api/projects/${projectId}/stats`);
    this.cache.invalidate('/api/projects/with-stats');
    
    return data;
  }

  async unblockTokens(projectId: string, tokens: string[]): Promise<BlockTokenResponse> {
    const data = await this.request<BlockTokenResponse>(
      'post',
      `/api/projects/${projectId}/unblock-tokens`,
      { tokens }
    );
    
    this.cache.invalidate(`/api/projects/${projectId}/keywords`);
    this.cache.invalidate(`/api/projects/${projectId}/stats`);
    this.cache.invalidate('/api/projects/with-stats');
    
    return data;
  }

  async mergeTokens(projectId: string, parentToken: string, childTokens: string[]): Promise<ApiTokenOperationResponse> {
    const data = await this.request<ApiTokenOperationResponse>(
      'post',
      `/api/projects/${projectId}/merge-tokens`,
      {
        parent_token: parentToken,
        child_tokens: childTokens 
      }
    );
    
    this.cache.invalidate(`/api/projects/${projectId}/tokens`);
    this.cache.invalidate(`/api/projects/${projectId}/keywords`);
    this.cache.invalidate(`/api/projects/${projectId}/stats`);
    this.cache.invalidate('/api/projects/with-stats');
    
    return data;
  }

  async unmergeToken(projectId: string, tokenName: string): Promise<ApiTokenOperationResponse> {
    const data = await this.request<ApiTokenOperationResponse>(
      'post',
      `/api/projects/${projectId}/unmerge-token`,
      {
        tokenName
      }
    );
    
    this.cache.invalidate(`/api/projects/${projectId}/tokens`);
    this.cache.invalidate(`/api/projects/${projectId}/keywords`);
    this.cache.invalidate(`/api/projects/${projectId}/stats`);
    this.cache.invalidate('/api/projects/with-stats');
    
    return data;
  }

  async createToken(projectId: string, searchTerm: string, tokenName: string): Promise<ApiCreateTokenResponse> {
    const data = await this.request<ApiCreateTokenResponse>(
      'post',
      `/api/projects/${projectId}/create-token`,
      {
        search_term: searchTerm,
        token_name: tokenName
      }
    );
    
    this.cache.invalidate(`/api/projects/${projectId}/tokens`);
    this.cache.invalidate(`/api/projects/${projectId}/keywords`);
    this.cache.invalidate(`/api/projects/${projectId}/stats`);
    this.cache.invalidate('/api/projects/with-stats');
    
    return data;
  }
  
  async fetchGroupNameSuggestions(projectId: string, search: string): Promise<string[]> {
    if (!search || search.trim().length === 0) {
      return [];
    }
    try {
      const sanitizedSearch = encodeURIComponent(search.trim());
      const cacheKey = `group-suggestions:${projectId}:${sanitizedSearch}`;
      const cachedData = this.cache.get<string[]>(cacheKey);
      if (cachedData) return cachedData;
      const url = `/api/projects/${projectId}/group-suggestions?search=${sanitizedSearch}`;
      const data = await this.request<string[]>('get', url, undefined, undefined, false);
      this.cache.set(cacheKey, data, 5000);
      return data;
    } catch (error) {
      console.error('Error fetching group name suggestions:', error);
      return [];
    }
  }
  
  async fetchSerpFeatures(projectId: string): Promise<string[]> {
    try {
      const cacheKey = `serp-features:${projectId}`;
      const cachedData = this.cache.get<string[]>(cacheKey);
      if (cachedData) return cachedData;
      
      const data = await this.request<{features: string[]}>(
        'get',
        `/api/projects/${projectId}/serp-features`,
        undefined,
        undefined,
        false
      );
      
      const features = data.features || [];
      this.cache.set(cacheKey, features, 5 * 60 * 1000); 
      
      return features;
    } catch (error) {
      console.error('Error fetching SERP features:', error);
      return [];
    }
  }
  
  async unmergeIndividualToken(projectId: string, parentToken: string, childToken: string): Promise<ApiTokenOperationResponse> {
    const data = await this.request<ApiTokenOperationResponse>(
      'post',
      `/api/projects/${projectId}/unmerge-individual-token?parent_token=${encodeURIComponent(parentToken)}&child_token=${encodeURIComponent(childToken)}`,
      undefined,
      undefined
    );
    
    this.cache.invalidate(`/api/projects/${projectId}/tokens`);
    this.cache.invalidate(`/api/projects/${projectId}/keywords`);
    this.cache.invalidate(`/api/projects/${projectId}/stats`);
    this.cache.invalidate('/api/projects/with-stats');
    
    return data;
  }
  
  async exportGroupedKeywords(projectId: string, view = 'grouped'): Promise<Blob> {
    try {
      const authToken = authService.getAccessToken();
      const response = await this.axiosInstance.get(
        `/api/projects/${projectId}/export-csv?view=${view}`,
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
          responseType: 'blob',
        }
      );
      
      return response.data;
    } catch (error) {
      console.error('Export API Error:', error);
      throw new Error(isError(error) ? error.message : 'Failed to export CSV');
    }
  }
    async exportParentKeywords(projectId: string): Promise<Blob> {
    try {
      const authToken = authService.getAccessToken();
      const response = await this.axiosInstance.get(
        `/api/projects/${projectId}/export-parent-keywords`,
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'multipart/form-data',
          },
          responseType: 'blob',
        }
      );
      
      return response.data;
    } catch (error) {
      console.error('Export Parent Keywords API Error:', error);
      throw new Error(isError(error) ? error.message : 'Failed to export parent keywords CSV');
    }
  }

  async importParentKeywords(projectId: string, formData: FormData): Promise<unknown> {
    try {
      const authToken = authService.getAccessToken();
      const response = await this.axiosInstance.post(
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
  
  async confirmKeywords(projectId: string, keywordIds: number[]): Promise<ApiConfirmationResponse> {
    const data = await this.request<ApiConfirmationResponse>(
      'post',
      `/api/projects/${projectId}/confirm`,
      { keywordIds }
    );
    this.cache.invalidate(`/api/projects/${projectId}/keywords`);
    this.cache.invalidate(`/api/projects/${projectId}/stats`);
    this.cache.invalidate('/api/projects/with-stats');
    
    return data;
  }

  async unconfirmKeywords(projectId: string, keywordIds: number[]): Promise<ApiConfirmationResponse> {
    const data = await this.request<ApiConfirmationResponse>(
      'post',
      `/api/projects/${projectId}/unconfirm`,
      { keywordIds }
    );
    
    this.cache.invalidate(`/api/projects/${projectId}/keywords`);
    this.cache.invalidate(`/api/projects/${projectId}/stats`);
    this.cache.invalidate('/api/projects/with-stats');
    
    return data;
  }

  async resetProcessing(projectId: string): Promise<{ message: string; cleared: Record<string, unknown> }> {
    const data = await this.request<{ message: string; cleared: Record<string, unknown> }>(
      'post',
      `/api/projects/${projectId}/reset-processing`
    );
    
    this.cache.invalidate(`/api/projects/${projectId}`);
    
    return data;
  }

  async runGrouping(projectId: string): Promise<{
    message: string;
    ungrouped_before: number;
    ungrouped_after: number;
    keywords_grouped: number;
  }> {
    const data = await this.request<{
      message: string;
      ungrouped_before: number;
      ungrouped_after: number;
      keywords_grouped: number;
    }>(
      'post',
      `/api/projects/${projectId}/run-grouping`
    );
    
    this.cache.invalidate(`/api/projects/${projectId}/keywords`);
    this.cache.invalidate(`/api/projects/${projectId}/stats`);
    
    return data;
  }
}

const apiClient = new ApiClient(BASE_URL);
export default apiClient;
