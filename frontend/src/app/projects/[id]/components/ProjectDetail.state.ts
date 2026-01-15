import { ProjectDetailTab } from './ProjectDetailTabs';
import {
  ActiveKeywordView,
  PaginationInfo,
  ProcessingFileError,
  ProcessingStatus,
  SnackbarMessage,
  SortParams,
} from './types';

export interface FiltersState {
  selectedTokens: string[];
  includeFilter: string;
  excludeFilter: string;
  includeMatchType: 'any' | 'all';
  excludeMatchType: 'any' | 'all';
  minVolume: string;
  maxVolume: string;
  minLength: string;
  maxLength: string;
  minDifficulty: string;
  maxDifficulty: string;
  minRating: string;
  maxRating: string;
  selectedSerpFeatures: string[];
}

export interface PaginationState {
  sortParams: SortParams;
  pagination: PaginationInfo;
}

export interface SelectionState {
  selectedKeywordIds: Set<number>;
  expandedGroups: Set<string>;
  loadingChildren: Set<string>;
  groupName: string;
}

export interface ProcessingState {
  isTableLoading: boolean;
  isLoadingData: boolean;
  isUploading: boolean;
  uploadSuccess: boolean;
  processingStatus: ProcessingStatus;
  isProcessingAction: boolean;
  snackbarMessages: SnackbarMessage[];
  processingProgress: number;
  processingMessage: string;
  processingStage?: string | null;
  processingStageDetail?: string | null;
  processingCurrentFile: string | null;
  processingQueue: string[];
  processingUploadedFiles: string[];
  processingProcessedFiles: string[];
  processingFileErrors: ProcessingFileError[];
  displayProgress: number;
  isExportingParent: boolean;
  isImportingParent: boolean;
  isExporting: boolean;
}

export interface ViewState {
  activeView: ActiveKeywordView;
  activeTab: ProjectDetailTab;
  logsRefreshKey: number;
}

export interface StatsState {
  ungroupedCount: number;
  groupedKeywordsCount: number;
  confirmedKeywordsCount: number;
  confirmedPages: number;
  groupedPages: number;
  blockedCount: number;
  totalKeywords: number;
  totalParentKeywords: number;
  totalChildKeywords: number;
  groupCount: number;
  parentTokenCount: number;
  childTokenCount: number;
}

export interface ProjectDetailState {
  view: ViewState;
  filters: FiltersState;
  pagination: PaginationState;
  selection: SelectionState;
  processing: ProcessingState;
  stats: StatsState;
}

export type ProjectDetailAction =
  | { type: 'updateView'; payload: Partial<ViewState> }
  | { type: 'bumpLogsRefresh' }
  | { type: 'updateFilters'; payload: Partial<FiltersState> }
  | { type: 'updatePagination'; payload: Partial<PaginationState> }
  | { type: 'updateSelection'; payload: Partial<SelectionState> }
  | { type: 'updateProcessing'; payload: Partial<ProcessingState> }
  | { type: 'addSnackbarMessage'; payload: SnackbarMessage }
  | { type: 'removeSnackbarMessage'; payload: number }
  | { type: 'setStats'; payload: StatsState };

export const initialProjectDetailState: ProjectDetailState = {
  view: {
    activeView: 'ungrouped',
    activeTab: 'group',
    logsRefreshKey: 0,
  },
  filters: {
    selectedTokens: [],
    includeFilter: '',
    excludeFilter: '',
    includeMatchType: 'any',
    excludeMatchType: 'any',
    minVolume: '',
    maxVolume: '',
    minLength: '',
    maxLength: '',
    minDifficulty: '',
    maxDifficulty: '',
    minRating: '',
    maxRating: '',
    selectedSerpFeatures: [],
  },
  pagination: {
    sortParams: {
      column: 'volume',
      direction: 'desc',
    },
    pagination: {
      total: 0,
      page: 1,
      limit: 250,
      pages: 0,
    },
  },
  selection: {
    selectedKeywordIds: new Set(),
    expandedGroups: new Set(),
    loadingChildren: new Set(),
    groupName: '',
  },
  processing: {
    isTableLoading: false,
    isLoadingData: false,
    isUploading: false,
    uploadSuccess: false,
    processingStatus: 'idle',
    isProcessingAction: false,
    snackbarMessages: [],
    processingProgress: 0,
    processingMessage: '',
    processingStage: null,
    processingStageDetail: null,
    processingCurrentFile: null,
    processingQueue: [],
    processingUploadedFiles: [],
    processingProcessedFiles: [],
    processingFileErrors: [],
    displayProgress: 0,
    isExportingParent: false,
    isImportingParent: false,
    isExporting: false,
  },
  stats: {
    ungroupedCount: 0,
    groupedKeywordsCount: 0,
    confirmedKeywordsCount: 0,
    confirmedPages: 0,
    groupedPages: 0,
    blockedCount: 0,
    totalKeywords: 0,
    totalParentKeywords: 0,
    totalChildKeywords: 0,
    groupCount: 0,
    parentTokenCount: 0,
    childTokenCount: 0,
  },
};

export function projectDetailReducer(
  state: ProjectDetailState,
  action: ProjectDetailAction
): ProjectDetailState {
  switch (action.type) {
    case 'updateView':
      return {
        ...state,
        view: { ...state.view, ...action.payload },
      };
    case 'bumpLogsRefresh':
      return {
        ...state,
        view: {
          ...state.view,
          logsRefreshKey: state.view.logsRefreshKey + 1,
        },
      };
    case 'updateFilters':
      return {
        ...state,
        filters: { ...state.filters, ...action.payload },
      };
    case 'updatePagination':
      return {
        ...state,
        pagination: { ...state.pagination, ...action.payload },
      };
    case 'updateSelection':
      return {
        ...state,
        selection: { ...state.selection, ...action.payload },
      };
    case 'updateProcessing':
      return {
        ...state,
        processing: { ...state.processing, ...action.payload },
      };
    case 'addSnackbarMessage':
      return {
        ...state,
        processing: {
          ...state.processing,
          snackbarMessages: [...state.processing.snackbarMessages, action.payload],
        },
      };
    case 'removeSnackbarMessage':
      return {
        ...state,
        processing: {
          ...state.processing,
          snackbarMessages: state.processing.snackbarMessages.filter(
            (message) => message.id !== action.payload
          ),
        },
      };
    case 'setStats':
      return {
        ...state,
        stats: action.payload,
      };
    default:
      return state;
  }
}
