import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import projectReducer from '@/store/projectSlice';
import Login from '@/app/page';
import apiClient from '@/lib/apiClient';
import authService from '@/lib/authService';
import { useAuth } from '@/components/AuthProvider';

const mockPush = jest.fn();
const mockRouter = { push: mockPush };

jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
}));

jest.mock('@/lib/apiClient');
jest.mock('@/lib/authService');
jest.mock('@/components/AuthProvider');

const createTestStore = () =>
  configureStore({
    reducer: {
      project: projectReducer,
    },
  });

const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;
const mockAuthService = authService as jest.Mocked<typeof authService>;
const mockUseAuth = useAuth as jest.Mock;

describe('Login page', () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockApiClient.fetchProjects.mockResolvedValue([]);
    mockAuthService.login.mockReset();
    mockUseAuth.mockReturnValue({ isAuthenticated: false, isLoading: false });
    localStorage.clear();
  });

  it('logs in successfully, stores tokens, and redirects', async () => {
    mockAuthService.login.mockImplementation(async () => {
      localStorage.setItem('access_token', 'access-token');
      localStorage.setItem('refresh_token', 'refresh-token');
      return { access_token: 'access-token', refresh_token: 'refresh-token' };
    });

    render(
      <Provider store={createTestStore()}>
        <Login />
      </Provider>
    );

    await userEvent.type(screen.getByLabelText(/username/i), 'demo');
    await userEvent.type(screen.getByLabelText(/password/i, { selector: 'input' }), 'password');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(mockAuthService.login).toHaveBeenCalledWith('demo', 'password');
    });

    expect(localStorage.getItem('access_token')).toBe('access-token');
    expect(localStorage.getItem('refresh_token')).toBe('refresh-token');
    expect(mockApiClient.fetchProjects).toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith('/projects');
  });

  it('shows an error when login fails', async () => {
    mockAuthService.login.mockRejectedValue(new Error('Invalid credentials'));

    render(
      <Provider store={createTestStore()}>
        <Login />
      </Provider>
    );

    await userEvent.type(screen.getByLabelText(/username/i), 'bad');
    await userEvent.type(screen.getByLabelText(/password/i, { selector: 'input' }), 'bad');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid credentials');
    expect(mockPush).not.toHaveBeenCalled();
  });
});
