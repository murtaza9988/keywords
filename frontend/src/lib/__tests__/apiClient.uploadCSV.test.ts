import apiClient from '@/lib/apiClient';
import authService from '@/lib/authService';

var mockAxiosInstance: {
  post: jest.Mock;
  request: jest.Mock;
  interceptors: { response: { use: jest.Mock } };
};

jest.mock('axios', () => {
  mockAxiosInstance = {
    post: jest.fn(),
    request: jest.fn(),
    interceptors: {
      response: {
        use: jest.fn(),
      },
    },
  };

  return {
    __esModule: true,
    default: {
      create: jest.fn(() => mockAxiosInstance),
      isAxiosError: jest.fn(),
    },
  };
});

describe('apiClient.uploadCSV', () => {
  beforeEach(() => {
    mockAxiosInstance.post.mockResolvedValue({ data: { status: 'complete', message: 'ok' } });
    jest.spyOn(authService, 'getAccessToken').mockReturnValue('token');
  });

  afterEach(() => {
    jest.restoreAllMocks();
    mockAxiosInstance.post.mockClear();
    mockAxiosInstance.request.mockClear();
  });

  it('invalidates keyword and stats caches before upload', async () => {
    const invalidateSpy = jest.spyOn((apiClient as unknown as { cache: { invalidate: (pattern: string) => void } }).cache, 'invalidate');
    const formData = new FormData();
    formData.append('file', new Blob(['keyword,volume\n'], { type: 'text/csv' }), 'test.csv');

    await apiClient.uploadCSV('147', formData);

    expect(invalidateSpy).toHaveBeenCalledWith('/api/projects/147');
    expect(invalidateSpy).toHaveBeenCalledWith('/api/projects/147/csv-uploads');
    expect(invalidateSpy).toHaveBeenCalledWith('/api/projects/147/keywords');
    expect(invalidateSpy).toHaveBeenCalledWith('/api/projects/147/stats');
    expect(invalidateSpy).toHaveBeenCalledWith('/api/projects/147/tokens');
    expect(invalidateSpy).toHaveBeenCalledWith('/api/projects/147/initial-data');
    expect(invalidateSpy).toHaveBeenCalledWith('/api/projects/with-stats');
  });
});
