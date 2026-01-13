"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Eye, EyeOff } from 'lucide-react';
import { useDispatch } from 'react-redux';
import { setProjects } from '@/store/projectSlice';
import apiClient from '@/lib/apiClient';
import authService from '@/lib/authService';
import { useAuth } from '@/components/AuthProvider';
import { AppDispatch } from '@/store/store';
import { Project } from '@/lib/types';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/lib/cn';

function isError(error: unknown): error is Error {
  return error instanceof Error;
}

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const router = useRouter();
  const dispatch: AppDispatch = useDispatch();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      router.push('/projects');
    }
  }, [isAuthenticated, isLoading, router]);

  const fetchInitialData = async (): Promise<void> => {
    try {
      const projectsData: Project[] = await apiClient.fetchProjects();
      dispatch(setProjects(projectsData));
    } catch (fetchError: unknown) {
      const errorMessage = isError(fetchError) ? fetchError.message : 'Failed to fetch projects after login.';
      setError(`Login successful, but failed to load project list: ${errorMessage}`);
      console.error("Post-login data fetch error:", fetchError);
      dispatch(setProjects([]));
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      await authService.login(username, password);
      await fetchInitialData();
      router.push('/projects');
    } catch (loginError: unknown) {
      const errorMessage = isError(loginError) ? loginError.message : 'An unexpected error occurred during login.';
      setError(errorMessage);
      console.error("Login error:", loginError);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUsername(e.target.value);
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
  };

  const toggleShowPassword = () => {
    setShowPassword(prev => !prev);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(148,163,184,0.12)_1px,transparent_1px)] bg-[length:24px_24px] opacity-70" />
        <div className="flex items-center justify-center z-10">
          <Spinner size="lg" className="border-muted border-t-accent" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(148,163,184,0.12)_1px,transparent_1px)] bg-[length:24px_24px] opacity-70" />

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md z-10"
      >
        <Card className="bg-surface/80 backdrop-blur-md border border-border p-8">
          <CardHeader className="text-center mb-8">
            <CardTitle className="text-3xl font-bold bg-gradient-to-r from-violet-400 to-pink-400 bg-clip-text text-transparent">
              Manager
            </CardTitle>
            <CardDescription className="mt-2 text-muted">
              Advanced Keyword Processing
            </CardDescription>
          </CardHeader>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-red-500/10 text-red-200 px-4 py-3 rounded-lg mb-6 border border-red-500/30"
              role="alert"
            >
              {error}
            </motion.div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="mb-6">
              <label htmlFor="username" className="block text-sm font-medium text-muted mb-2">
                Username
              </label>
              <Input
                type="text"
                id="username"
                value={username}
                onChange={handleUsernameChange}
                required
                disabled={isSubmitting}
                className="px-4 py-3"
                placeholder="Enter username"
                autoComplete="username"
              />
            </div>

            <div className="mb-8 relative">
              <label htmlFor="password" className="block text-sm font-medium text-muted mb-2">
                Password
              </label>
              <Input
                type={showPassword ? 'text' : 'password'}
                id="password"
                value={password}
                onChange={handlePasswordChange}
                required
                disabled={isSubmitting}
                className="px-4 py-3 pr-12"
                placeholder="Enter password"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={toggleShowPassword}
                className={cn(
                  "absolute right-3 top-10 text-muted hover:text-foreground transition-colors disabled:opacity-60",
                )}
                disabled={isSubmitting}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>

            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full"
            >
              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <Spinner size="sm" className="border-white/40 border-t-white" />
                    Signing In...
                  </span>
                ) : (
                  'Sign In'
                )}
              </Button>
            </motion.div>
          </form>
        </Card>
      </motion.div>
    </div>
  );
}
