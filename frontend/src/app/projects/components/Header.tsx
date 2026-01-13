"use client";
import React from 'react';
import { BarChart3, LogOut } from 'lucide-react';
import authService from '@/lib/authService';

export default function Header() {
  const handleLogout = () => {
    authService.logout();
  };

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-20 shadow-sm w-full">
      <div className="container mx-auto px-4 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-8 w-8 text-blue-600" />
          <h1 className="text-2xl font-bold text-gray-900">SEO Project Manager</h1>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          aria-label="Logout"
        >
          <LogOut size={18} />
          Logout
        </button>
      </div>
    </header>
  );
}