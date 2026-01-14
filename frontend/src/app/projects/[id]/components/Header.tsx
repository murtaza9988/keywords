"use client";
import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

interface HeaderProps {
  projectName: string | undefined;
}

export const Header: React.FC<HeaderProps> = ({ projectName }) => {
  const pathname = usePathname();
  const websiteUrl = `https://seo-front-git-develop-new-team-13.vercel.app/projects/${projectName}`;

  return (
    <header className="bg-surface/95 sticky top-0 z-30 border-b border-border backdrop-blur">
      <div className="w-full max-w-full mx-auto px-4 sm:px-6 lg:px-8 flex flex-col gap-4 lg:flex-row lg:justify-between lg:items-center">
        <div className="flex items-center space-x-4 min-w-0">
          <Link
            href="/projects"
            aria-label="Back to projects"
            className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted hover:text-foreground hover:bg-surface-muted transition-colors"
          >
            <ArrowLeft className="h-5 w-5" /> <span className="hidden sm:inline">Back</span>
          </Link>
          <span className="mx-1 truncate text-muted">{websiteUrl}</span>
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
      </div>
    </header>
  );
};
