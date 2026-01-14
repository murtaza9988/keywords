"use client";
import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeft, ChevronRight } from 'lucide-react';

interface HeaderProps {
  projectName: string | undefined;
}

export const Header: React.FC<HeaderProps> = ({ projectName }) => {
  const pathname = usePathname();
  return (
    <header className="bg-surface/95 sticky top-0 z-30 border-b border-border backdrop-blur">
      <div className="w-full mx-auto px-4 sm:px-6 lg:px-8 flex flex-col gap-3 lg:flex-row lg:justify-between lg:items-center">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/projects"
            aria-label="Back to projects"
            className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-muted hover:text-foreground hover:bg-surface-muted transition-colors"
          >
            <ArrowLeft className="h-5 w-5" /> <span className="hidden sm:inline">Back</span>
          </Link>
          <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-muted min-w-0">
            <Link href="/projects" className="hover:text-foreground transition-colors">
              Projects
            </Link>
            <ChevronRight className="h-3.5 w-3.5 text-muted" />
            <span className="truncate text-foreground font-medium">
              {projectName || 'Project'}
            </span>
          </nav>
        </div>
        <nav className="flex items-center gap-2">
          {[
            { href: '/projects', label: 'Projects' },
            { href: '/backlog', label: 'Backlog' },
            { href: '/design-guidelines', label: 'Design Guidelines' },
          ].map((tab) => {
            const isActive = pathname === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
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
