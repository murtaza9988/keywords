import apiClient from '@/lib/apiClient';
import authService from '@/lib/authService';

type MockAxiosInstance = {
  post: jest.Mock;
  request: jest.Mock;
  interceptors: { response: { use: jest.Mock } };
};

type MockAxiosModule = {
  __mockAxiosInstance: MockAxiosInstance;
  default: {
    create: jest.Mock;
    isAxiosError: jest.Mock;
  };
};

jest.mock('axios', () => {
  const mockAxiosInstance: MockAxiosInstance = {
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
    __mockAxiosInstance: mockAxiosInstance,
    default: {
      create: jest.fn(() => mockAxiosInstance),
      isAxiosError: jest.fn(),
    },
  };
});

const getMockAxiosInstance = (): MockAxiosInstance =>
  (jest.requireMock('axios') as MockAxiosModule).__mockAxiosInstance;

describe('apiClient.uploadCSV', () => {
  beforeEach(() => {
    const mockAxiosInstance = getMockAxiosInstance();
    mockAxiosInstance.post.mockResolvedValue({ data: { status: 'complete', message: 'ok' } });
    jest.spyOn(authService, 'getAccessToken').mockReturnValue('token');
  });

  afterEach(() => {
    jest.restoreAllMocks();
    const mockAxiosInstance = getMockAxiosInstance();
    mockAxiosInstance.post.mockClear();
    mockAxiosInstance.request.mockClear();
  });

  it('invalidates keyword and stats caches before upload', async () => {
    const cacheClient = apiClient as { cache: { invalidate: (pattern: string) => void } };
    const invalidateSpy = jest.spyOn(cacheClient.cache, 'invalidate');
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
