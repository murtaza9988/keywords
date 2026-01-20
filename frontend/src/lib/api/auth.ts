/**
 * Auth API module
 * Handles authentication-related API operations
 */
import type { LoginResponse } from '../types';
import { request } from './client';

// ============================================================================
// Authentication
// ============================================================================

export async function login(username: string, password: string): Promise<LoginResponse> {
  return request<LoginResponse>('post', '/api/login', { username, password });
}
