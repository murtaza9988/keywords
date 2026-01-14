"use client";
import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, LogOut } from 'lucide-react';
import authService from '@/lib/authService';
import { Button } from '@/components/ui/Button';

export default function Header() {
  const pathname = usePathname();
  const handleLogout = () => {
    authService.logout();
  };

  return (
    <header className="bg-surface/95 backdrop-blur border-b border-border sticky top-0 z-20 shadow-sm w-full">
      <div className="container mx-auto px-4 py-4 flex flex-col gap-4 lg:flex-row lg:justify-between lg:items-center">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-8 w-8 text-accent" />
          <h1 className="text-2xl font-bold text-foreground">SEO Project Manager</h1>
        </div>
        <nav className="flex items-center gap-2">
          {[
            { href: '/projects', label: 'Projects' },
            { href: '/design-guidelines', label: 'Design Guidelines' },
          ].map((tab) => {
            const isActive = pathname === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors border ${
                  isActive
                    ? 'bg-accent text-white border-accent shadow-sm'
                    : 'text-muted border-transparent hover:text-foreground hover:bg-surface-muted'
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
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
