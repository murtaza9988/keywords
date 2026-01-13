"use client";
import React from 'react';
import { Plus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';

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
        <div className="bg-red-500/10 border border-red-500/30 p-4 mb-6 rounded-lg">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-300" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-medium text-red-200">Error</h3>
              <div className="mt-2 text-sm text-red-100">
                <p>{error}</p>
              </div>
              <div className="mt-4">
                <Button
                  onClick={() => setError('')}
                  variant="outline"
                  size="sm"
                  className="border-red-500/40 text-red-100 hover:bg-red-500/20"
                >
                  Dismiss
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
      <Card className="mb-8 p-6">
        <CardTitle className="mb-4">Create New Project</CardTitle>
        <CardContent>
          <form onSubmit={handleCreateProject} className="flex flex-col sm:flex-row gap-4">
            <Input
              id="newProjectName"
              type="text"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              placeholder="Enter project name"
              className="w-full sm:w-64"
              required
              disabled={isCreating}
            />
            <Button
              type="submit"
              disabled={isCreating || !newProjectName.trim()}
              className="w-full sm:w-auto"
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
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
