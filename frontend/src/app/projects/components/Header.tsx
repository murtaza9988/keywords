"use client";
import React from 'react';
import { BarChart3, LogOut } from 'lucide-react';
import authService from '@/lib/authService';
import { Button } from '@/components/ui/Button';

export default function Header() {
  const handleLogout = () => {
    authService.logout();
  };

  return (
    <header className="bg-surface/95 backdrop-blur border-b border-border sticky top-0 z-20 shadow-sm w-full">
      <div className="container mx-auto px-4 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-8 w-8 text-accent" />
          <h1 className="text-2xl font-bold text-foreground">SEO Project Manager</h1>
        </div>
        <Button
          onClick={handleLogout}
          variant="ghost"
          className="text-muted hover:text-foreground"
          aria-label="Logout"
        >
          <LogOut size={18} />
          Logout
        </Button>
      </div>
    </header>
  );
}
