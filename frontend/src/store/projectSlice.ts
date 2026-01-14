import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Project, Keyword, ActiveKeywordView, ProjectMetadata, ProjectState } from '../lib/types';
import { createSelector } from 'reselect';

const initialState: ProjectState = {
  projects: [],
  groupedKeywords: {},
  ungroupedKeywords: {},
  confirmedKeywords: {},
  blockedKeywords: {},
  childrenCache: {},
  keywordsCache: {},
  sortedKeywordsCache: {},
  filteredKeywordsCache: {},
  metaData: {},
  stats: {}
};

const projectSlice = createSlice({
  name: 'project',
  initialState,
  reducers: {
    setProjects: (state, action: PayloadAction<Project[]>) => {
      state.projects = action.payload;
    },
    
    setKeywordsForView: (state, action: PayloadAction<{ 
      projectId: string; 
      view: ActiveKeywordView; 
      keywords: Keyword[];
      totalCount?: number;
    }>) => {
      const { projectId, view, keywords, totalCount } = action.payload;
      
      switch (view) {
        case 'grouped':
          state.groupedKeywords[projectId] = keywords;
          break;
        case 'ungrouped':
          state.ungroupedKeywords[projectId] = keywords;
          break;
        case 'confirmed':
          state.confirmedKeywords[projectId] = keywords;
          break;
        case 'blocked':
          state.blockedKeywords[projectId] = keywords;
          break;
      }
      
      if (!state.keywordsCache[projectId]) {
        state.keywordsCache[projectId] = {
          ungrouped: [],
          grouped: [],
          confirmed: [],
          blocked: []
        };
      }
      state.keywordsCache[projectId][view] = keywords;
      
      if (totalCount !== undefined) {
        if (!state.metaData[projectId]) {
          state.metaData[projectId] = {};
        }
        state.metaData[projectId][`${view}Count`] = totalCount;
      }
    },
    
    setChildrenForGroup: (state, action: PayloadAction<{ 
      projectId: string; 
      groupId: string; 
      children: Keyword[];
    }>) => {
      const { projectId, groupId, children } = action.payload;
      if (!state.childrenCache[projectId]) {
        state.childrenCache[projectId] = {};
      }
      state.childrenCache[projectId][groupId] = children;
    },
    
    clearChildrenForGroup: (state, action: PayloadAction<{ 
      projectId: string; 
      groupId: string;
    }>) => {
      const { projectId, groupId } = action.payload;
      if (state.childrenCache[projectId]) {
        delete state.childrenCache[projectId][groupId];
      }
    },
    
    clearProjectKeywords: (state, action: PayloadAction<{ 
      projectId: string;
    }>) => {
      const { projectId } = action.payload;
      delete state.groupedKeywords[projectId];
      delete state.ungroupedKeywords[projectId];
      delete state.confirmedKeywords[projectId];
      delete state.blockedKeywords[projectId];
      delete state.childrenCache[projectId];
      delete state.keywordsCache[projectId];
      delete state.sortedKeywordsCache[projectId];
      delete state.filteredKeywordsCache[projectId];
      delete state.metaData[projectId];
    },
    
    addProject: (state, action: PayloadAction<Project>) => {
      if (!state.projects.some(p => p.id === action.payload.id)) {
        state.projects.push(action.payload);
        state.projects.sort((a, b) => a.name.localeCompare(b.name));
      }
    },
    
    removeProject: (state, action: PayloadAction<{ 
      projectId: number;
    }>) => {
      const { projectId } = action.payload;
      state.projects = state.projects.filter(p => p.id !== projectId);
      const projectIdStr = String(projectId);
      delete state.groupedKeywords[projectIdStr];
      delete state.ungroupedKeywords[projectIdStr];
      delete state.confirmedKeywords[projectIdStr];
      delete state.blockedKeywords[projectIdStr];
      delete state.childrenCache[projectIdStr];
      delete state.keywordsCache[projectIdStr];
      delete state.sortedKeywordsCache[projectIdStr];
      delete state.filteredKeywordsCache[projectIdStr];
      delete state.metaData[projectIdStr];
    },

    updateProject: (state, action: PayloadAction<Project>) => {
      const index = state.projects.findIndex((p) => p.id === action.payload.id);
      if (index !== -1) {
        state.projects[index] = action.payload;
        state.projects.sort((a, b) => a.name.localeCompare(b.name));
      }
    },

    setCachedKeywords: (state, action: PayloadAction<{
      projectId: string;
      view: ActiveKeywordView;
      keywords: Keyword[];
      isComplete: boolean;
    }>) => {
      const { projectId, view, keywords, isComplete } = action.payload;
      
      if (!state.keywordsCache[projectId]) {
        state.keywordsCache[projectId] = {
          ungrouped: [],
          grouped: [],
          confirmed: [],
          blocked: []
        };
      }
      
      if (!state.keywordsCache[projectId][view] || isComplete) {
        state.keywordsCache[projectId][view] = keywords;
      } else {
        const existingIds = new Set(state.keywordsCache[projectId][view].map(k => k.id));
        const newKeywords = keywords.filter(k => !existingIds.has(k.id));
        state.keywordsCache[projectId][view] = [
          ...state.keywordsCache[projectId][view],
          ...newKeywords
        ];
      }
      
      switch (view) {
        case 'grouped':
          state.groupedKeywords[projectId] = keywords;
          break;
        case 'ungrouped':
          state.ungroupedKeywords[projectId] = keywords;
          break;
        case 'confirmed':
          state.confirmedKeywords[projectId] = keywords;
          break;
        case 'blocked':
          state.blockedKeywords[projectId] = keywords;
          break;
      }
    },
    
    setCachedSortedKeywords: (state, action: PayloadAction<{
      projectId: string;
      view: ActiveKeywordView;
      sortKey: string;
      sortDirection: 'asc' | 'desc';
      keywords: Keyword[];
    }>) => {
      const { projectId, view, sortKey, sortDirection, keywords } = action.payload;
      
      if (!state.sortedKeywordsCache[projectId]) {
        state.sortedKeywordsCache[projectId] = {
          ungrouped: {},
          grouped: {},
          confirmed: {},
          blocked: {}
        };
      }
      
      if (!state.sortedKeywordsCache[projectId][view]) {
        state.sortedKeywordsCache[projectId][view] = {};
      }
      
      const cacheKey = `${sortKey}-${sortDirection}`;
      state.sortedKeywordsCache[projectId][view][cacheKey] = keywords;
    },

    setProjectStats: (state, action: PayloadAction<{
      projectId: string;
      stats: {
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
      }
    }>) => {
      const { projectId, stats } = action.payload;
      state.stats[projectId] = stats;
    },

    setCachedFilteredKeywords: (state, action: PayloadAction<{
      projectId: string;
      view: ActiveKeywordView;
      filterKey: string;
      keywords: Keyword[];
    }>) => {
      const { projectId, view, filterKey, keywords } = action.payload;
      
      if (!state.filteredKeywordsCache[projectId]) {
        state.filteredKeywordsCache[projectId] = {
          ungrouped: {},
          grouped: {},
          confirmed: {},
          blocked: {}
        };
      }
      
      if (!state.filteredKeywordsCache[projectId][view]) {
        state.filteredKeywordsCache[projectId][view] = {};
      }
      
      state.filteredKeywordsCache[projectId][view][filterKey] = keywords;
    },
    
    updateKeyword: (state, action: PayloadAction<{
      projectId: string;
      keyword: Keyword;
    }>) => {
      const { projectId, keyword } = action.payload;
      const { id } = keyword;
      
      const updateInCollection = (collection: Keyword[]) => {
        const index = collection.findIndex(k => k.id === id);
        if (index !== -1) {
          collection[index] = { ...collection[index], ...keyword };
        }
        return collection;
      };
      
      if (state.ungroupedKeywords[projectId]) {
        state.ungroupedKeywords[projectId] = updateInCollection([...state.ungroupedKeywords[projectId]]);
      }
      if (state.groupedKeywords[projectId]) {
        state.groupedKeywords[projectId] = updateInCollection([...state.groupedKeywords[projectId]]);
      }
      if (state.confirmedKeywords[projectId]) {
        state.confirmedKeywords[projectId] = updateInCollection([...state.confirmedKeywords[projectId]]);
      }
      if (state.blockedKeywords[projectId]) {
        state.blockedKeywords[projectId] = updateInCollection([...state.blockedKeywords[projectId]]);
      }
      
      if (state.keywordsCache[projectId]) {
        for (const view of ['ungrouped', 'grouped', 'confirmed', 'blocked'] as ActiveKeywordView[]) {
          if (state.keywordsCache[projectId][view]) {
            state.keywordsCache[projectId][view] = 
              updateInCollection([...state.keywordsCache[projectId][view]]);
          }
        }
      }
      
      if (state.sortedKeywordsCache[projectId]) {
        delete state.sortedKeywordsCache[projectId];
      }
      
      if (state.filteredKeywordsCache[projectId]) {
        delete state.filteredKeywordsCache[projectId];
      }
    },
    
    setProjectMetadata: (state, action: PayloadAction<{
      projectId: string;
      metadata: ProjectMetadata;
    }>) => {
      const { projectId, metadata } = action.payload;
      
      if (!state.metaData[projectId]) {
        state.metaData[projectId] = {};
      }
      
      state.metaData[projectId] = {
        ...state.metaData[projectId],
        ...metadata
      };
    },
    
    clearCaches: (state, action: PayloadAction<{
      projectId?: string;
      view?: ActiveKeywordView;
    }>) => {
      const { projectId, view } = action.payload;
      
      if (projectId) {
        if (view) {
          if (state.sortedKeywordsCache[projectId]?.[view]) {
            delete state.sortedKeywordsCache[projectId][view];
          }
          if (state.filteredKeywordsCache[projectId]?.[view]) {
            delete state.filteredKeywordsCache[projectId][view];
          }
        } else {
          delete state.sortedKeywordsCache[projectId];
          delete state.filteredKeywordsCache[projectId];
        }
      } else {
        state.sortedKeywordsCache = {};
        state.filteredKeywordsCache = {};
      }
    }
  },
});

const selectProjectState = (state: { project: ProjectState }) => state.project;

export const selectProjects = createSelector(
  [selectProjectState],
  (project) => project.projects
);

export const selectKeywordsForView = createSelector(
  [selectProjectState, (_: unknown, projectId: string, view: ActiveKeywordView) => ({ projectId, view })],
  (project, { projectId, view }) => {
    switch (view) {
      case 'grouped':
        return project.groupedKeywords[projectId] || [];
      case 'ungrouped':
        return project.ungroupedKeywords[projectId] || [];
      case 'confirmed':
        return project.confirmedKeywords[projectId] || [];
      case 'blocked':
        return project.blockedKeywords[projectId] || [];
      default:
        return [];
    }
  }
);

export const selectChildrenForGroup = createSelector(
  [selectProjectState, (_: unknown, projectId: string, groupId: string) => ({ projectId, groupId })],
  (project, { projectId, groupId }) => project.childrenCache[projectId]?.[groupId] || []
);

export const selectCachedKeywords = createSelector(
  [selectProjectState, (_: unknown, projectId: string, view: ActiveKeywordView) => ({ projectId, view })],
  (project, { projectId, view }) => project.keywordsCache[projectId]?.[view] || []
);

export const selectCachedSortedKeywords = createSelector(
  [selectProjectState, (_: unknown, projectId: string, view: ActiveKeywordView, sortKey: string, sortDirection: 'asc' | 'desc') => ({ projectId, view, sortKey, sortDirection })],
  (project, { projectId, view, sortKey, sortDirection }) => {
    const cacheKey = `${sortKey}-${sortDirection}`;
    return project.sortedKeywordsCache[projectId]?.[view]?.[cacheKey] || [];
  }
);

export const selectCachedFilteredKeywords = createSelector(
  [selectProjectState, (_: unknown, projectId: string, view: ActiveKeywordView, filterKey: string) => ({ projectId, view, filterKey })],
  (project, { projectId, view, filterKey }) => project.filteredKeywordsCache[projectId]?.[view]?.[filterKey] || []
);

export const selectProjectMetadata = createSelector(
  [selectProjectState, (_: unknown, projectId: string) => projectId],
  (project, projectId) => project.metaData[projectId] || {}
);

export const selectProjectStats = createSelector(
  [selectProjectState, (_: unknown, projectId: string) => projectId],
  (project, projectId) => project.stats[projectId] || {}
);

// Memoized selectors for token management to prevent unnecessary re-renders
export const selectUngroupedKeywordsForProject = createSelector(
  [selectProjectState, (_: unknown, projectId: string) => projectId],
  (project, projectId) => project.ungroupedKeywords[projectId] || []
);

export const selectGroupedKeywordsForProject = createSelector(
  [selectProjectState, (_: unknown, projectId: string) => projectId],
  (project, projectId) => project.groupedKeywords[projectId] || []
);

export const selectBlockedKeywordsForProject = createSelector(
  [selectProjectState, (_: unknown, projectId: string) => projectId],
  (project, projectId) => project.blockedKeywords[projectId] || []
);

export const selectConfirmedKeywordsForProject = createSelector(
  [selectProjectState, (_: unknown, projectId: string) => projectId],
  (project, projectId) => project.confirmedKeywords[projectId] || []
);

export const selectChildrenCacheForProject = createSelector(
  [selectProjectState, (_: unknown, projectId: string) => projectId],
  (project, projectId) => project.childrenCache[projectId] || {}
);

export const selectProjectById = createSelector(
  [selectProjectState, (_: unknown, projectId: number) => projectId],
  (project, projectId) => project.projects.find((p) => p.id === projectId)
);

export const {
  setProjects,
  setKeywordsForView,
  setChildrenForGroup,
  clearChildrenForGroup,
  clearProjectKeywords,
  addProject,
  removeProject,
  updateProject,
  setCachedKeywords,
  setCachedSortedKeywords,
  setCachedFilteredKeywords,
  updateKeyword,
  setProjectMetadata,
  clearCaches,
  setProjectStats,
} = projectSlice.actions;

export default projectSlice.reducer;
