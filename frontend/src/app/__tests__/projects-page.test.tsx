import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import projectReducer from '@/store/projectSlice';
import ProjectsPage from '@/app/projects/page';
import apiClient from '@/lib/apiClient';
import authService from '@/lib/authService';

const mockPush = jest.fn();
const mockRouter = { push: mockPush };

jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  usePathname: () => '/projects',
}));

jest.mock('@/lib/apiClient');
jest.mock('@/lib/authService');

const createTestStore = () =>
  configureStore({
    reducer: {
      project: projectReducer,
    },
  });

const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;
const mockAuthService = authService as jest.Mocked<typeof authService>;

const baseProjects = [
  {
    id: 1,
    name: 'Alpha Project',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-02T00:00:00Z',
    stats: {
      totalParentKeywords: 10,
      ungroupedCount: 5,
      groupedKeywordsCount: 3,
      confirmedKeywordsCount: 1,
      blockedCount: 1,
    },
  },
];

describe('Projects page', () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockAuthService.isAuthenticated.mockReturnValue(true);
    mockApiClient.fetchProjectsWithStats.mockResolvedValue({ projects: baseProjects });
  });

  it('renders project list and supports CRUD modals', async () => {
    mockApiClient.createProject.mockResolvedValue({
      id: 2,
      name: 'Beta Project',
      created_at: '2024-02-01T00:00:00Z',
      updated_at: '2024-02-01T00:00:00Z',
    });
    mockApiClient.updateProject.mockResolvedValue({
      id: 1,
      name: 'Alpha Renamed',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-02-10T00:00:00Z',
    });
    mockApiClient.deleteProject.mockResolvedValue(true);

    mockApiClient.fetchProjectsWithStats
      .mockResolvedValueOnce({ projects: baseProjects })
      .mockResolvedValueOnce({
        projects: [
          ...baseProjects,
          {
            id: 2,
            name: 'Beta Project',
            created_at: '2024-02-01T00:00:00Z',
            updated_at: '2024-02-01T00:00:00Z',
            stats: {
              totalParentKeywords: 0,
              ungroupedCount: 0,
              groupedKeywordsCount: 0,
              confirmedKeywordsCount: 0,
              blockedCount: 0,
            },
          },
        ],
      });

    render(
      <Provider store={createTestStore()}>
        <ProjectsPage />
      </Provider>
    );

    expect(await screen.findByText('Alpha Project')).toBeInTheDocument();

    const user = userEvent.setup();

    await user.type(screen.getByPlaceholderText(/enter project name/i), 'Beta Project');
    await user.click(screen.getByRole('button', { name: /create project/i }));

    await waitFor(() => {
      expect(mockApiClient.createProject).toHaveBeenCalledWith('Beta Project');
      expect(mockApiClient.fetchProjectsWithStats).toHaveBeenCalledTimes(2);
    });

    expect(await screen.findByText('Beta Project')).toBeInTheDocument();

    await user.click(screen.getByLabelText('Edit project Alpha Project'));
    const editInput = screen.getByDisplayValue('Alpha Project');
    await user.clear(editInput);
    await user.type(editInput, 'Alpha Renamed');
    await user.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(screen.getByText('Alpha Renamed')).toBeInTheDocument();
    });

    await user.click(screen.getByLabelText('Delete project Alpha Renamed'));
    expect(screen.getByText(/confirm deletion/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^delete$/i }));

    await waitFor(() => {
      expect(screen.queryByText('Alpha Renamed')).not.toBeInTheDocument();
    });
  });
});
