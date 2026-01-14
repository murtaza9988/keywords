import React from 'react';
import { render, waitFor } from '@testing-library/react';

import CSVUploadDropdown from '../projects/[id]/components/CSVUploadDropdown';
import apiClient from '@/lib/apiClient';

jest.mock('@/lib/apiClient', () => ({
  __esModule: true,
  default: {
    fetchCSVUploads: jest.fn(),
  },
}));

const mockedApiClient = apiClient as unknown as {
  fetchCSVUploads: jest.Mock;
};

describe('CSVUploadDropdown', () => {
  beforeEach(() => {
    mockedApiClient.fetchCSVUploads.mockReset();
    mockedApiClient.fetchCSVUploads.mockResolvedValue([]);
  });

  it('fetches CSV uploads on mount and when refreshKey changes', async () => {
    const { rerender } = render(<CSVUploadDropdown projectId="1" refreshKey={0} />);

    await waitFor(() => {
      expect(mockedApiClient.fetchCSVUploads).toHaveBeenCalledTimes(1);
    });

    rerender(<CSVUploadDropdown projectId="1" refreshKey={1} />);

    await waitFor(() => {
      expect(mockedApiClient.fetchCSVUploads).toHaveBeenCalledTimes(2);
    });
  });
});

