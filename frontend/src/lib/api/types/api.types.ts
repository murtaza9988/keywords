/**
 * API-specific type definitions
 * These types represent raw API responses before transformation to domain types
 */
import type { PaginationInfo, ProcessingStatus } from '../../types';

// ============================================================================
// Keyword API Types
// ============================================================================

export interface ApiKeyword {
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

export interface ApiKeywordListResponse {
  ungroupedKeywords?: ApiKeyword[];
  groupedKeywords?: ApiKeyword[];
  confirmedKeywords?: ApiKeyword[];
  blockedKeywords?: ApiKeyword[];
  pagination?: PaginationInfo;
}

export interface ApiKeywordChildrenResponse {
  children?: ApiKeyword[];
}

// ============================================================================
// Project API Types
// ============================================================================

export interface ApiProject {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface ApiProjectStats {
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

export interface ApiProjectWithStats extends ApiProject {
  stats?: ApiProjectStats;
}

export interface ApiProjectsWithStatsResponse {
  projects: ApiProjectWithStats[];
}

// ============================================================================
// Initial Data API Types
// ============================================================================

export interface ApiInitialProjectStats {
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
  totalChildKeywords?: number;
  groupCount?: number;
  parentTokenCount?: number;
  childTokenCount?: number;
}

export interface ApiInitialDataResponse {
  keywords?: Record<string, ApiKeyword[]>;
  stats?: ApiInitialProjectStats;
  pagination?: PaginationInfo;
  currentView?: {
    status?: string;
    keywords?: ApiKeyword[];
  };
  processingStatus?: {
    status?: ProcessingStatus;
    locked?: boolean;
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
    queuedJobs?: number;
    runningJobs?: number;
    succeededJobs?: number;
    failedJobs?: number;
  };
}

// ============================================================================
// Token API Types
// ============================================================================

export interface ApiTokenOperationResponse {
  message: string;
  affected_keywords?: number;
}

export interface ApiCreateTokenResponse extends ApiTokenOperationResponse {
  affected_keywords: number;
}

// ============================================================================
// Confirmation API Types
// ============================================================================

export interface ApiConfirmationResponse {
  message: string;
  count: number;
}

// ============================================================================
// Activity Log API Types
// ============================================================================

export interface ApiActivityLog {
  id: number;
  projectId?: number;
  project_id?: number;
  user: string;
  action: string;
  details?: Record<string, unknown> | null;
  createdAt?: string;
  created_at?: string;
}

export interface ApiActivityLogListResponse {
  logs: ApiActivityLog[];
  pagination: PaginationInfo;
}
