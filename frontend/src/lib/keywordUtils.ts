import { Keyword, GroupedKeywordsDisplay, SortParams } from '../lib/types';

/**
 * Create a unique cache key for filter combinations
 */
export const createFilterCacheKey = (
  tokens: string[], 
  include: string, 
  exclude: string
): string => {
  const tokensKey = tokens.sort().join(',');
  return `${tokensKey}|${include.trim()}|${exclude.trim()}`;
};

/**
 * Create a unique cache key for sort configurations
 */
export const createSortCacheKey = (
  column: string,
  direction: 'asc' | 'desc'
): string => {
  return `${column}-${direction}`;
};

/**
 * Filter keywords based on provided criteria
 */
export const filterKeywords = (
  keywords: Keyword[],
  tokens: string[],
  include: string,
  exclude: string
): Keyword[] => {
  if (!keywords || !Array.isArray(keywords)) return [];
  
  let filtered = [...keywords];
  
  // Apply token filtering
  if (tokens.length > 0) {
    filtered = filtered.filter(keyword => 
      tokens.every(token => 
        keyword.tokens && 
        Array.isArray(keyword.tokens) && 
        keyword.tokens.includes(token)
      )
    );
  }
  
  // Apply include filter
  const includeTrimmed = include.trim().toLowerCase();
  if (includeTrimmed) {
    filtered = filtered.filter(keyword => 
      keyword.keyword.toLowerCase().includes(includeTrimmed)
    );
  }
  
  // Apply exclude filter
  const excludeTrimmed = exclude.trim().toLowerCase();
  if (excludeTrimmed) {
    filtered = filtered.filter(keyword => 
      !keyword.keyword.toLowerCase().includes(excludeTrimmed)
    );
  }
  
  return filtered;
};

/**
 * Sort keywords based on column and direction
 */
export const sortKeywords = (
  keywords: Keyword[],
  sortParams: SortParams
): Keyword[] => {
  if (!keywords || !Array.isArray(keywords) || keywords.length === 0) return [];
  
  const { column, direction } = sortParams;
  const sorted = [...keywords];
  
  const sortMultiplier = direction === 'asc' ? 1 : -1;
  
  return sorted.sort((a, b) => {
    let comparison = 0;
    
    switch (column) {
      case 'keyword':
      case 'groupName':
        comparison = (a.keyword || '').localeCompare(b.keyword || '');
        break;
        
      case 'length':
        const lengthA = (a.keyword || '').length;
        const lengthB = (b.keyword || '').length;
        comparison = lengthA - lengthB;
        break;
        
      case 'volume':
        const volumeA = a.volume || 0;
        const volumeB = b.volume || 0;
        comparison = volumeA - volumeB;
        break;
        
      case 'difficulty':
        const difficultyA = a.difficulty || 0;
        const difficultyB = b.difficulty || 0;
        comparison = difficultyA - difficultyB;
        break;
        
      case 'childCount':
        const childCountA = a.childCount || 0;
        const childCountB = b.childCount || 0;
        comparison = childCountA - childCountB;
        break;
        
      default:
        // Default to sort by volume if column is not recognized
        comparison = (a.volume || 0) - (b.volume || 0);
    }
    
    return comparison * sortMultiplier;
  });
};

/**
 * Format keywords into grouped display format with parent/children
 */
export const formatKeywordsForDisplay = (
  parentKeywords: Keyword[],
  childrenCache: Record<string, Keyword[]>,
  expandedGroups: Set<string>
): GroupedKeywordsDisplay[] => {
  if (!parentKeywords || !Array.isArray(parentKeywords)) return [];
  
  return parentKeywords.map((parent) => {
    const groupId = parent.groupId;
    let children: Keyword[] = [];
    
    if (groupId && expandedGroups.has(groupId)) {
      children = childrenCache[groupId] || [];
    }
    
    return {
      parent,
      children,
      key: `${parent.status}-${parent.id}-${groupId ?? 'nogroup'}`
    };
  });
};

/**
 * Apply paging to keywords
 */
export const pageKeywords = (
  keywords: Keyword[],
  page: number,
  limit: number
): Keyword[] => {
  if (!keywords || !Array.isArray(keywords)) return [];
  
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;
  
  return keywords.slice(startIndex, endIndex);
};

/**
 * Check if all keywords are selected
 */
export const areAllKeywordsSelected = (
  keywords: Keyword[],
  selectedIds: Set<number>
): boolean => {
  if (!keywords || keywords.length === 0) return false;
  return keywords.every(keyword => selectedIds.has(keyword.id));
};

/**
 * Check if any keywords are selected
 */
export const areAnyKeywordsSelected = (
  keywords: Keyword[],
  selectedIds: Set<number>
): boolean => {
  if (!keywords || keywords.length === 0) return false;
  return keywords.some(keyword => selectedIds.has(keyword.id));
};

/**
 * Generate a proposed group name from selected keywords
 */
export const generateGroupName = (
  keywords: Keyword[],
  selectedIds: Set<number>
): string => {
  if (!keywords || keywords.length === 0 || selectedIds.size === 0) return '';
  
  const selectedKeywords = keywords.filter(k => selectedIds.has(k.id));
  if (selectedKeywords.length === 0) return '';
  
  // Sort by volume (highest first) and return the keyword of the first one
  selectedKeywords.sort((a, b) => (b.volume || 0) - (a.volume || 0));
  return selectedKeywords[0].keyword;
};