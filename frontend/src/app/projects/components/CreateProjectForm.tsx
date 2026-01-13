"use client";
import React from 'react';
import { Plus, Loader2 } from 'lucide-react';

interface CreateProjectFormProps {
  newProjectName: string;
  setNewProjectName: (value: string) => void;
  isCreating: boolean;
  handleCreateProject: (e: React.FormEvent<HTMLFormElement>) => void;
  error: string;
  setError: (value: string) => void;
}

export default function CreateProjectForm({
  newProjectName,
  setNewProjectName,
  isCreating,
  handleCreateProject,
  error,
  setError,
}: CreateProjectFormProps) {
  return (
    <div className="mb-8">
      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6 rounded-r-lg">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{error}</p>
              </div>
              <div className="mt-4">
                <button
                  onClick={() => setError('')}
                  className="text-sm bg-red-100 px-3 py-1 rounded-md text-red-800 hover:bg-red-200 transition-colors"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mb-8">
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Create New Project</h3>
        </div>
        <form onSubmit={handleCreateProject} className="flex flex-col sm:flex-row gap-4">
          <input
            id="newProjectName"
            type="text"
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
            placeholder="Enter project name"
            className="w-64 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-400 disabled:bg-gray-100"
            required
            disabled={isCreating}
          />
          <button
            type="submit"
            disabled={isCreating || !newProjectName.trim()}
            className="bg-blue-600 hover:bg-blue-700 cursor-pointer text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:bg-blue-400 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {isCreating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" />
                Create Project
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}