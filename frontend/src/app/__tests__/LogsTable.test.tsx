import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { LogsTable } from '@/app/projects/[id]/components/LogsTable';
import apiClient from '@/lib/apiClient';

jest.mock('@/lib/apiClient', () => ({
  __esModule: true,
  default: {
    fetchProjectLogs: jest.fn(),
    fetchAllActivityLogs: jest.fn(),
  },
}));

const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;

describe('LogsTable', () => {
  beforeEach(() => {
    mockApiClient.fetchProjectLogs.mockResolvedValue({
      logs: [],
      pagination: { total: 0, page: 1, limit: 200, pages: 0 },
    });
    mockApiClient.fetchAllActivityLogs.mockResolvedValue({
      logs: [],
      pagination: { total: 0, page: 1, limit: 200, pages: 0 },
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('uses the project logs endpoint when scoped to a project', async () => {
    render(<LogsTable scope="project" projectId="123" />);

    await waitFor(() => {
      expect(mockApiClient.fetchProjectLogs).toHaveBeenCalledWith('123', {
        page: 1,
        limit: 200,
      });
    });
    expect(mockApiClient.fetchAllActivityLogs).not.toHaveBeenCalled();
  });

  it('uses the global logs endpoint when scoped globally', async () => {
    render(<LogsTable scope="global" />);

    await waitFor(() => {
      expect(mockApiClient.fetchAllActivityLogs).toHaveBeenCalledWith({
        page: 1,
        limit: 200,
      });
    });
    expect(mockApiClient.fetchProjectLogs).not.toHaveBeenCalled();
  });
});
