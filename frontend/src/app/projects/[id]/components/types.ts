export type { 
  Keyword, 
  GroupedKeywordsDisplay, 
  ProcessingStatus, 
  SnackbarMessage, 
  SortParams
} from '@/lib/types';

export interface PaginationInfo {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

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

export type ActiveKeywordView = 'ungrouped' | 'grouped' | 'confirmed' | 'blocked';

export type TokenActiveView = 'current' | 'blocked' | 'all' | 'merged';

export interface TokenSortParams {
  column: string;
  direction: 'asc' | 'desc';
}

export interface TokensResponse {
  tokens: TokenData[];
  pagination: PaginationInfo;
}

export interface BlockTokensResponse {
  message: string;
  count: number;
}

export interface UnblockTokensResponse {
  message: string;
  count: number;
}

export interface MergeTokensResponse {
  message: string;
  count: number;
  parentToken: string;
}

export interface UnmergeTokensResponse {
  message: string;
  count: number;
}