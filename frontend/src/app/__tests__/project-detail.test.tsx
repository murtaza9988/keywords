import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import projectReducer from '@/store/projectSlice';
import ProjectDetail from '@/app/projects/[id]/components/ProjectDetail';
import apiClient from '@/lib/apiClient';

const mockPush = jest.fn();
const mockRouter = { push: mockPush };

jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  useParams: () => ({ id: '1' }),
}));

jest.mock('@/lib/apiClient');

jest.mock('../projects/[id]/components/Header', () => ({
  Header: () => <div data-testid="header">Header</div>,
}));

jest.mock('../projects/[id]/components/FiltersSection', () => ({
  FiltersSection: () => <div data-testid="filters">Filters</div>,
}));

jest.mock('../projects/[id]/components/MainContent', () => {
  const MockMainContent = ({
    pagination,
    handlePageChange,
  }: {
    pagination: { page: number };
    handlePageChange: (page: number) => void;
  }) => (
    <div>
      <div data-testid="page">Page {pagination.page}</div>
      <button type="button" onClick={() => handlePageChange(2)}>
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

const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;

describe('ProjectDetail', () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockApiClient.fetchInitialData.mockResolvedValue({
      stats: {
        ungroupedCount: 1,
        groupedKeywordsCount: 0,
        confirmedKeywordsCount: 0,
        blockedCount: 0,
        totalKeywords: 1,
      },
      currentView: {
        keywords: [
          { id: 101, keyword: 'alpha', volume: 10, status: 'ungrouped' },
        ],
      },
      pagination: { total: 300, page: 1, limit: 250, pages: 2 },
    });
    mockApiClient.fetchKeywords.mockResolvedValue({
      ungroupedKeywords: [],
      groupedKeywords: [],
      confirmedKeywords: [],
      blockedKeywords: [],
      pagination: { total: 300, page: 1, limit: 250, pages: 2 },
    });
    mockApiClient.fetchSingleProjectStats.mockResolvedValue({
      ungroupedCount: 1,
      groupedKeywordsCount: 0,
      confirmedKeywordsCount: 0,
      blockedCount: 0,
      totalKeywords: 1,
    });
  });

  it('loads initial data and handles pagination', async () => {
    render(
      <Provider store={createTestStore()}>
        <ProjectDetail />
      </Provider>
    );

    await waitFor(() => {
      expect(mockApiClient.fetchInitialData).toHaveBeenCalled();
    });

    expect(mockApiClient.fetchKeywords).toHaveBeenCalled();
    expect(await screen.findByTestId('page')).toHaveTextContent('Page 1');

    await userEvent.click(screen.getByRole('button', { name: /next page/i }));

    await waitFor(() => {
      const lastCall = mockApiClient.fetchKeywords.mock.calls.at(-1);
      expect(lastCall?.[0]).toBe('1');
      expect(lastCall?.[2]).toBe(false);
      const params = lastCall?.[1] as URLSearchParams;
      expect(params.get('page')).toBe('2');
    });
  });
});
