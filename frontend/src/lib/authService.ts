import apiClient from './apiClient';

interface AuthTokens {
  access_token: string;
  refresh_token: string;
}

class AuthService {
  private static instance: AuthService;
  private refreshPromise: Promise<AuthTokens> | null = null;

  private constructor() {}

  static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  // Store tokens in localStorage
  setTokens(tokens: AuthTokens): void {
    localStorage.setItem('access_token', tokens.access_token);
    localStorage.setItem('refresh_token', tokens.refresh_token);
  }

  // Get access token from localStorage
  getAccessToken(): string | null {
    return localStorage.getItem('access_token');
  }

  // Get refresh token from localStorage
  getRefreshToken(): string | null {
    return localStorage.getItem('refresh_token');
  }

  // Clear all tokens
  clearTokens(): void {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('token'); // Remove old token for backward compatibility
  }

  // Check if user is authenticated
  isAuthenticated(): boolean {
    return !!this.getAccessToken();
  }

  // Refresh access token using refresh token
  async refreshAccessToken(): Promise<AuthTokens> {
    const refresh_token = this.getRefreshToken();
    
    if (!refresh_token) {
      throw new Error('No refresh token available');
    }

    // If there's already a refresh in progress, return that promise
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    // Create new refresh promise
    this.refreshPromise = this.performRefresh(refresh_token);

    try {
      const tokens = await this.refreshPromise;
      this.setTokens(tokens);
      return tokens;
    } finally {
      this.refreshPromise = null;
    }
  }

  private async performRefresh(refresh_token: string): Promise<AuthTokens> {
    try {
      const response = await fetch('/api/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refresh_token }),
      });

      if (!response.ok) {
        throw new Error('Failed to refresh token');
      }

      const data = await response.json();
      return {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      };
    } catch (error) {
      this.clearTokens();
      throw error;
    }
  }

  // Login and store tokens
  async login(username: string, password: string): Promise<AuthTokens> {
    const response = await apiClient.login(username, password);
    const tokens = {
      access_token: response.access_token,
      refresh_token: response.refresh_token,
    };
    this.setTokens(tokens);
    return tokens;
  }

  // Logout and clear tokens
  logout(): void {
    this.clearTokens();
    // Redirect to login page
    if (typeof window !== 'undefined') {
      window.location.href = '/';
    }
  }
}

export default AuthService.getInstance();

