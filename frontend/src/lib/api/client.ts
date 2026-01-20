/**
 * Core API client module
 * Contains axios instance setup, interceptors, caching, and base request method
 */
import axios, { AxiosInstance, AxiosResponse } from 'axios';
import authService from '../authService';

// IMPORTANT: This client uses origin-relative URLs (`/api/...`) and relies on the
// Next.js Route Handler proxy in `src/app/api/[...path]/route.ts` to reach the backend.
// Keeping this as same-origin avoids CORS and prevents deployment env mismatch issues.
const BASE_URL = '';

function isError(error: unknown): error is Error {
  return error instanceof Error;
}

// ============================================================================
// Cache Implementation
// ============================================================================

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
    const keys = Array.from(this.cache.keys());

    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      if (key.includes(keyPattern)) {
        keysToDelete.push(key);
      }
    }

    for (let i = 0; i < keysToDelete.length; i++) {
      this.cache.delete(keysToDelete[i]);
    }

    console.log(`Invalidated ${keysToDelete.length} cache entries matching "${keyPattern}"`);
  }

  clear(): void {
    this.cache.clear();
  }
}

// ============================================================================
// Axios Instance & Interceptors
// ============================================================================

const axiosInstance: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Response interceptor for handling 401 errors with automatic token refresh
axiosInstance.interceptors.response.use(
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
          return axiosInstance.request(originalRequest);
        }
      } catch {
        // If refresh fails, logout user
        authService.logout();
        return Promise.reject(new Error('Session expired. Please login again.'));
      }
    }

    const message =
      error.response?.data?.detail || error.response?.data?.message || error.message || 'Unknown error';
    return Promise.reject(new Error(message));
  }
);

// ============================================================================
// Singleton Cache Instance
// ============================================================================

const cache = new ApiCache();

// ============================================================================
// Base Request Method
// ============================================================================

export async function request<T>(
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
        const cachedData = cache.get<T>(cacheKey);
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

      const response: AxiosResponse<T> = await axiosInstance.request(config);
      const responseData = response.status === 204 ? ({} as T) : response.data;

      if (useCache) {
        cache.set<T>(cacheKey, responseData);
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

// ============================================================================
// Cache Management Exports
// ============================================================================

export function invalidateCache(pattern: string): void {
  cache.invalidate(pattern);
}

export function clearCache(pattern?: string): void {
  if (pattern) {
    cache.invalidate(pattern);
  } else {
    cache.clear();
  }
}

export function getCachedData<T>(key: string): T | null {
  return cache.get<T>(key);
}

export function setCachedData<T>(key: string, data: T, ttlMs?: number): void {
  cache.set(key, data, ttlMs);
}

// ============================================================================
// Axios Instance Export (for special cases like file uploads)
// ============================================================================

export { axiosInstance, isError };
