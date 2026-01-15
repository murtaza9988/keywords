import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import projectReducer from '@/store/projectSlice';
import ProjectDetail from '@/app/projects/[id]/components/ProjectDetail';
import * as keywordsApi from '@/lib/api/keywords';
import * as projectsApi from '@/lib/api/projects';

const mockPush = jest.fn();
const mockRouter = { push: mockPush };

jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  useParams: () => ({ id: '1' }),
}));

jest.mock('@/lib/api/keywords');
jest.mock('@/lib/api/projects');

jest.mock('../projects/[id]/components/Header', () => ({
  Header: () => <div data-testid="header">Header</div>,
}));

jest.mock('../projects/[id]/components/FiltersSection', () => ({
  FiltersSection: () => <div data-testid="filters">Filters</div>,
}));

jest.mock('../projects/[id]/components/MainContent', () => {
  const MockMainContent = ({
    tableState,
    tableHandlers,
  }: {
    tableState: { pagination: { page: number } };
    tableHandlers: { onPageChange: (page: number) => void };
  }) => (
    <div>
      <div data-testid="page">Page {tableState.pagination.page}</div>
      <button type="button" onClick={() => tableHandlers.onPageChange(2)}>
        Next Page
      </button>
    </div>
  );

  MockMainContent.displayName = 'MockMainContent';

  return { MainContent: MockMainContent };
});

jest.mock('../projects/[id]/components/Snackbar', () => ({
  Snackbar: () => null,
}));

jest.mock('../projects/[id]/components/token/TokenManagement', () => ({
  TokenManagement: () => <div data-testid="token-management">Tokens</div>,
}));

jest.mock('../projects/[id]/components/TextAreaInputs', () => ({
  TextAreaInputs: () => <div data-testid="notes">Notes</div>,
}));

jest.mock('../projects/[id]/components/CSVUploadDropdown', () => {
  const MockCSVUploadDropdown = () => <div data-testid="csv-upload">CSV</div>;
  MockCSVUploadDropdown.displayName = 'MockCSVUploadDropdown';
  return MockCSVUploadDropdown;
});

const createTestStore = () =>
  configureStore({
    reducer: {
      project: projectReducer,
    },
  });

const mockKeywordsApi = keywordsApi as jest.Mocked<typeof keywordsApi>;
const mockProjectsApi = projectsApi as jest.Mocked<typeof projectsApi>;

describe('ProjectDetail', () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockKeywordsApi.fetchInitialData.mockResolvedValue({
      stats: {
        ungroupedCount: 1,
        groupedKeywordsCount: 0,
        groupedPages: 0,
        blockedCount: 0,
        totalKeywords: 1,
        ungroupedPercent: 100,
        groupedPercent: 0,
        blockedPercent: 0,
        confirmedKeywordsCount: 0,
      },
      currentView: {
        keywords: [
          {
            id: 101,
            project_id: 1,
            keyword: 'alpha',
            tokens: ['alpha'],
            volume: 10,
            length: 5,
            difficulty: 0,
            isParent: false,
            groupId: null,
            groupName: null,
            status: 'ungrouped',
            childCount: 0,
            original_volume: 10,
            serpFeatures: [],
          },
        ],
      },
      pagination: { total: 300, page: 1, limit: 250, pages: 2 },
    });
    mockKeywordsApi.fetchKeywords.mockResolvedValue({
      ungroupedKeywords: [],
      groupedKeywords: [],
      confirmedKeywords: [],
      blockedKeywords: [],
      pagination: { total: 300, page: 1, limit: 250, pages: 2 },
    });
    mockProjectsApi.fetchProjectStats.mockResolvedValue({
      ungroupedCount: 1,
      groupedKeywordsCount: 0,
      groupedPages: 0,
      confirmedPages: 0,
      confirmedKeywordsCount: 0,
      blockedCount: 0,
      totalKeywords: 1,
      totalParentKeywords: 1,
      ungroupedPercent: 100,
      groupedPercent: 0,
      confirmedPercent: 0,
      blockedPercent: 0,
    });
  });

  it('loads initial data and handles pagination', async () => {
    render(
      <Provider store={createTestStore()}>
        <ProjectDetail />
      </Provider>
    );

    const main = screen.getByRole('main');
    const aside = screen.getByTestId('token-management').closest('aside');

    expect(main).toHaveClass('xl:basis-4/5', 'xl:flex-[4]');
    expect(aside).not.toBeNull();
    const asideElement = aside as HTMLElement;
    expect(asideElement).toHaveClass(
      'xl:basis-1/5',
      'xl:flex-[1]',
      'xl:min-w-[320px]',
      'xl:max-w-[420px]'
    );

    await waitFor(() => {
      expect(mockKeywordsApi.fetchInitialData).toHaveBeenCalled();
    });

    expect(mockKeywordsApi.fetchKeywords).toHaveBeenCalled();
    expect(await screen.findByTestId('page')).toHaveTextContent('Page 1');

    await userEvent.click(screen.getByRole('button', { name: /next page/i }));

    await waitFor(() => {
      const lastCall = mockKeywordsApi.fetchKeywords.mock.calls.at(-1);
      expect(lastCall?.[0]).toBe('1');
      expect(lastCall?.[2]).toBe(false);
      const params = lastCall?.[1] as URLSearchParams;
      expect(params.get('page')).toBe('2');
    });
  });
});
