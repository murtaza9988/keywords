"use client";
import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import authService from '@/lib/authService';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const router = useRouter();

  useEffect(() => {
    if (!authService.isAuthenticated()) {
      router.push('/');
      return;
    }
  }, [router]);

  return <>{children}</>;
};

export default Layout;