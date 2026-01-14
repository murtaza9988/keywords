export interface Project {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface Keyword {
  original_volume: number;
  id: number;
  project_id: number;
  keyword: string;
  tokens: string[];
  volume: number;
  length: number;
  difficulty: number;
  rating?: number;
  isParent: boolean;
  groupId: string | null;
  groupName: string | null;
  status: "ungrouped" | "grouped" | "confirmed" | "blocked";
  childCount: number;
  serpFeatures: string[];
}

export interface GroupedKeywordsDisplay {
  parent: Keyword;
  children: Keyword[];
  key: string;
}

export interface PaginationInfo {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface KeywordChildrenData {
  children: Keyword[];
}


export interface ChildrenCache {
  [projectId: string]: {
    [groupId: string]: Keyword[];
  };
}


export interface FetchKeywordsResponse {
  ungroupedKeywords: Keyword[];
  groupedKeywords: Keyword[];
  confirmedKeywords: Keyword[];
  blockedKeywords: Keyword[];
  pagination: PaginationInfo;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export type CreateProjectResponse = Project;

export interface ProcessingKeyword {
  id?: number;
  keyword?: string;
  tokens?: string[] | string;
  volume?: number;
  difficulty?: number;
  status?: string;
  is_parent?: boolean;
  group_id?: string | null;
  group_name?: string | null;
  child_count?: number;
  original_volume?: number;
  blocked_by?: string | null;
  serp_features?: string[] | string;
}

export interface ProcessingStatusResponse {
  message?: string;
  status: ProcessingStatus;
  keywordCount: number;
  processedCount?: number;
  skippedCount?: number;
  keywords?: ProcessingKeyword[];
  complete?: boolean;
  totalRows?: number; 
  progress?: number; 
  currentFileName?: string | null;
  queuedFiles?: string[];
  queueLength?: number;
  uploadedFiles?: string[];
  processedFiles?: string[];
  uploadedFileCount?: number;
  processedFileCount?: number;
  validationError?: string | null;
}
export interface ProcessingKeyword {
  id?: number;
  keyword?: string;
  tokens?: string[] | string;
  volume?: number;
  difficulty?: number;
  is_parent?: boolean;
  group_id?: string | null;
  status?: string;
  child_count?: number;
  original_volume?: number;
  serpFeatures?: string[];
}
export interface GroupKeywordsResponse {
    message: string;
    groupName: string;
    groupId: string;
    count: number;
}

export interface BlockTokenResponse {
    message: string;
    count: number;
}

export interface UnblockKeywordsResponse {
    message: string;
    count: number;
}
export interface SortParams {
  column: string;
  direction: 'asc' | 'desc';
}

export interface SnackbarMessage {
  text: string;
  type: 'success' | 'error' | 'info';
  id: number;
  description?: string;
  stage?: ProcessingStatus;
}
export interface ProjectState {
  projects: Project[];
  groupedKeywords: Record<string, Keyword[]>;
  ungroupedKeywords: Record<string, Keyword[]>;
  confirmedKeywords: Record<string, Keyword[]>;
  blockedKeywords: Record<string, Keyword[]>;
  childrenCache: Record<string, Record<string, Keyword[]>>;
  keywordsCache: Record<string, Record<ActiveKeywordView, Keyword[]>>;
  sortedKeywordsCache: Record<string, Record<ActiveKeywordView, Record<string, Keyword[]>>>;
  filteredKeywordsCache: Record<string, Record<ActiveKeywordView, Record<string, Keyword[]>>>;
  metaData: Record<string, ProjectMetadata>;
  stats: Record<string, {
    ungroupedCount: number;
    groupedKeywordsCount: number;
    groupedPages: number;
    confirmedKeywordsCount?: number;
    confirmedPages?: number;
    blockedCount: number;
    totalKeywords: number;
    ungroupedPercent: number;
    groupedPercent: number;
    confirmedPercent?: number;
    blockedPercent: number;
  }>;
}

export interface ProjectMetadata {
  ungroupedCount?: number;
  groupedCount?: number;
  confirmedCount?: number;
  blockedCount?: number;
  [key: string]: number | undefined;
}
export type ProcessingStatus =
  | 'idle'
  | 'uploading'
  | 'combining'
  | 'queued'
  | 'processing'
  | 'complete'
  | 'error';
export type ActiveKeywordView = 'ungrouped' | 'grouped' | 'confirmed' | 'blocked';
export interface TokenData {
  tokenName: string;
  volume?: number;
  difficulty?: number;
  count?: string;
  tokens?: string[];
  isParent?: boolean;
  hasChildren?: boolean;
  childTokens?: string[];
  merged_token?: string;
}
export interface TokenListResponse {
  tokens: TokenData[];
  pagination: PaginationInfo;
}

export interface Note {
  id: number;
  project_id: number;
  note1: string | null;
  note2: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface CSVUpload {
  id: number;
  project_id: number;
  file_name: string;
  uploaded_at: string;
}

export interface ActivityLog {
  id: number;
  projectId: number;
  user: string;
  action: string;
  details?: Record<string, unknown> | null;
  createdAt: string;
}

export interface ActivityLogListResponse {
  logs: ActivityLog[];
  pagination: PaginationInfo;
}
