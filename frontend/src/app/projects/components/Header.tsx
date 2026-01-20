"use client";
import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, LogOut } from 'lucide-react';
import authService from '@/lib/authService';
import { cn } from '@/lib/cn';

/**
 * M3 Top App Bar Specifications:
 * - Height: 64dp (small)
 * - Navigation icon: 24dp, 16dp from start
 * - Title text style: Title Large (22sp)
 * - Action icons: 24dp, 12dp gap between
 * - Horizontal padding: 16dp
 * - Elevation (scrolled): Level 2 (3dp)
 *
 * M3 Tab Specifications:
 * - Height: 48dp (text only)
 * - Indicator height: 3dp
 * - Indicator color: Primary
 * - Text style: Title Small (14sp, Medium)
 */

export default function Header() {
  const pathname = usePathname();
  const handleLogout = () => {
    authService.logout();
  };

  const navItems = [
    { href: '/projects', label: 'Projects' },
    { href: '/logs', label: 'Logs' },
    { href: '/backlog', label: 'Backlog' },
    { href: '/design-guidelines', label: 'Design Guidelines' },
  ];

  return (
    <header className={cn(
      // M3 Top App Bar
      "sticky top-0 z-20 w-full",
      // M3 Surface Container background
      "bg-surface-container",
      // M3 elevation when scrolled (Level 2)
      "shadow-[0_1px_2px_rgba(0,0,0,0.3),0_2px_6px_2px_rgba(0,0,0,0.15)]",
      // Border for additional definition
      "border-b border-outline-variant"
    )}>
      <div className="container mx-auto px-4">
        {/* Top row with logo and logout */}
        <div className="flex items-center justify-between h-16">
          {/* Logo and title */}
          <div className="flex items-center gap-3">
            <BarChart3 className="h-7 w-7 text-primary" />
            <h1 className="text-title-large text-on-surface font-normal">
              SEO Project Manager
            </h1>
          </div>

          {/* Logout button - M3 text button */}
          <button
            onClick={handleLogout}
            className={cn(
              // M3 text button
              "inline-flex items-center justify-center gap-2",
              "h-10 px-4",
              "rounded-full",
              "text-label-large font-medium",
              "bg-transparent text-on-surface-variant",
              // Hover state
              "hover:bg-[color-mix(in_srgb,transparent_92%,var(--md-sys-color-on-surface-variant)_8%)]",
              // Focus state
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-container",
              // Active state
              "active:bg-[color-mix(in_srgb,transparent_88%,var(--md-sys-color-on-surface-variant)_12%)]",
              // Transition
              "transition-all duration-200 ease-[cubic-bezier(0.2,0,0,1)]"
            )}
            aria-label="Logout"
          >
            <LogOut className="h-5 w-5" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>

        {/* M3 Tabs (Secondary tabs style) */}
        <nav className="flex items-center -mb-px">
          {navItems.map((tab) => {
            const isActive = pathname === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  // M3 tab base
                  "relative flex items-center justify-center",
                  "h-12 px-4 min-w-[90px]",
                  // M3 Title Small typography
                  "text-title-small font-medium",
                  // Colors based on state
                  isActive
                    ? "text-primary"
                    : "text-on-surface-variant",
                  // Hover state
                  !isActive && "hover:text-on-surface hover:bg-[color-mix(in_srgb,transparent_92%,var(--md-sys-color-on-surface)_8%)]",
                  // Focus state
                  "focus-visible:outline-none focus-visible:bg-[color-mix(in_srgb,transparent_90%,var(--md-sys-color-primary)_10%)]",
                  // Transition
                  "transition-all duration-200 ease-[cubic-bezier(0.2,0,0,1)]"
                )}
              >
                {tab.label}
                {/* M3 Active indicator */}
                {isActive && (
                  <span className={cn(
                    "absolute bottom-0 left-0 right-0",
                    // M3 indicator height: 3dp, rounded top corners
                    "h-[3px] rounded-t-[3px]",
                    "bg-primary"
                  )} />
                )}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
