import React from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

interface HeaderProps {
  projectName: string | undefined;
}

export const Header: React.FC<HeaderProps> = ({ projectName }) => {
  const websiteUrl = `https://seo-front-git-develop-new-team-13.vercel.app/projects/${projectName}`;

  return (
    <header className="bg-white  sticky top-0 z-30">
      <div className="w-full max-w-full mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center">
        <div className="flex items-center space-x-4 min-w-0">
          <Link href="/projects" className="text-blue-600 hover:text-blue-800 flex items-center p-2 rounded hover:bg-blue-50" aria-label="Back to projects">
            <ArrowLeft className="h-5 w-5 mr-1" /> <span className="hidden sm:inline">Back</span>
          </Link>
          <span className="mx-1 truncate">{websiteUrl}</span>
        </div>
      </div>
    </header>
  );
};