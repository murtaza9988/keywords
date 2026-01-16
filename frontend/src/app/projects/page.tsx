"use client";
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Header from './components/Header';
import CreateProjectForm from './components/CreateProjectForm';
import ProjectsTable from './components/ProjectsTable';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '../../store/store';
import {
  createProject,
  deleteProject,
  fetchProjectsWithStats,
  updateProject as updateProjectApi,
} from '../../lib/api/projects';
import authService from '../../lib/authService';
import { addProject, removeProject, setProjects, updateProject as updateProjectAction } from '../../store/projectSlice';
import { Project, ProjectWithStats } from '@/lib/types';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';

function isError(error: unknown): error is Error {
  return error instanceof Error;
}
export default function Projects() {
  const [newProjectName, setNewProjectName] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isLoadingProjects, setIsLoadingProjects] = useState<boolean>(true);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [projectsToDelete, setProjectsToDelete] = useState<Project[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [projects, setLocalProjects] = useState<ProjectWithStats[]>([]);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editProjectName, setEditProjectName] = useState<string>('');
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [sortConfig, setSortConfig] = useState<{ key: string; order: 'asc' | 'desc' }>({ key: 'created_at', order: 'desc' });
  const router = useRouter();
  const dispatch: AppDispatch = useDispatch();
  const filteredProjectCount = projects.filter((project) =>
    project.name.toLowerCase().includes(searchTerm.toLowerCase())
  ).length;

  useEffect(() => {
    const fetchProjects = async () => {
      if (!authService.isAuthenticated()) {
        router.push('/');
        return;
      }

      try {
        setIsLoadingProjects(true);
        const response = await fetchProjectsWithStats();
        const projectsWithStats = response.projects;
        setLocalProjects(projectsWithStats);
        dispatch(setProjects(projectsWithStats.map(p => ({ id: p.id, name: p.name, created_at: p.created_at, updated_at: p.updated_at }))));
      } catch (fetchError: unknown) {
        const message = isError(fetchError) ? fetchError.message : 'Failed to load projects.';
        setError(message);
        console.error("Error fetching projects:", fetchError);
      } finally {
        setIsLoadingProjects(false);
      }
    };

    fetchProjects();
  }, [dispatch, router]);

  const handleCreateProject = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmedName = newProjectName.trim();
    if (!trimmedName || isCreating) return;

    setIsCreating(true);
    setError('');
    try {
      const newProjectData = await createProject(trimmedName);
      dispatch(addProject(newProjectData));
      setNewProjectName('');
      
      // Refresh the entire projects list with stats
      const response = await fetchProjectsWithStats();
      setLocalProjects(response.projects);
    } catch (creationError: unknown) {
      const message = isError(creationError) ? creationError.message : 'Failed to create project.';
      setError(message);
      console.error("Error creating project:", creationError);
    } finally {
      setIsCreating(false);
    }
  };

  const handleEditClick = (project: Project) => {
    setEditingProject(project);
    setEditProjectName(project.name);
  };

  const handleEditSubmit = async (e: React.FormEvent<HTMLFormElement>, projectId: number) => {
    e.preventDefault();
    const trimmedName = editProjectName.trim();
    if (!trimmedName || !editingProject) return;

    setIsEditing(true);
    setError('');
    try {
      const updatedProject = await updateProjectApi(projectId, trimmedName);
      dispatch(updateProjectAction(updatedProject));
      setLocalProjects((prev) =>
        prev.map((p) => (p.id === projectId ? { ...p, ...updatedProject } : p))
      );
      setEditingProject(null);
      setEditProjectName('');
    } catch (updateError: unknown) {
      const message = isError(updateError) ? updateError.message : 'Failed to update project.';
      setError(message);
      console.error("Error updating project:", updateError);
    } finally {
      setIsEditing(false);
    }
  };

  const handleDeleteClick = (project: Project) => {
    setProjectsToDelete([project]);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (projectsToDelete.length === 0 || isDeleting) return;

    setIsDeleting(true);
    setError('');
    try {
      // Use Promise.all to delete all selected projects in parallel
      await Promise.all(projectsToDelete.map(p => deleteProject(p.id)));

      // Update Redux and local state for each deleted project
      projectsToDelete.forEach(project => {
        dispatch(removeProject({ projectId: project.id }));
      });

      const deletedIds = new Set(projectsToDelete.map(p => p.id));
      setLocalProjects((prev) => prev.filter((p) => !deletedIds.has(p.id)));

      setShowDeleteModal(false);
      setProjectsToDelete([]);
      setSelectedIds([]);
    } catch (deletionError: unknown) {
      const message = isError(deletionError) ? deletionError.message : 'Failed to delete project(s).';
      setError(message);
      setShowDeleteModal(false);
      console.error("Error deleting project(s):", deletionError);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-[1100px] mx-auto px-4 py-4">
        <Card className="p-6">
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-3">
              <nav aria-label="Breadcrumb" className="text-ui-meta">
                <ol className="flex items-center gap-2">
                  <li>
                    <Link href="/" className="transition-colors hover:text-foreground">
                      Home
                    </Link>
                  </li>
                  <li className="text-muted">/</li>
                  <li className="text-foreground">Projects</li>
                </ol>
              </nav>
              <div className="flex flex-col gap-4">
                <div>
                  <h2 className="text-ui-page">Projects</h2>
                  <p className="text-ui-muted mt-1">
                    Manage your SEO keyword projects
                  </p>
                </div>
                
                {/* Stats Cards */}
                <div className="grid gap-4 md:grid-cols-3">
                  <Card className="p-4 bg-surface border-border">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-accent">{projects.length}</div>
                      <div className="text-ui-meta">Total Projects</div>
                    </div>
                  </Card>
                  <Card className="p-4 bg-surface border-border">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-accent">{filteredProjectCount}</div>
                      <div className="text-ui-meta">Filtered Projects</div>
                    </div>
                  </Card>
                  <Card className="p-4 bg-surface border-border">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-accent">
                        {projects.reduce((sum, p) => sum + (p.stats?.totalKeywords || 0), 0)}
                      </div>
                      <div className="text-ui-meta">Total Keywords</div>
                    </div>
                  </Card>
                </div>

                <div className="flex flex-row gap-4 items-end">
                  <Input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search projects..."
                    className="w-full max-w-[240px] text-ui-body"
                  />
                  <CreateProjectForm
                    newProjectName={newProjectName}
                    setNewProjectName={setNewProjectName}
                    isCreating={isCreating}
                    handleCreateProject={handleCreateProject}
                    error={error}
                    setError={setError}
                  />
                </div>
              </div>
            </div>
            <ProjectsTable
              projects={projects}
              isLoadingProjects={isLoadingProjects}
              editingProject={editingProject}
              editProjectName={editProjectName}
              setEditProjectName={setEditProjectName}
              isEditing={isEditing}
              handleEditClick={handleEditClick}
              handleEditSubmit={handleEditSubmit}
              handleDeleteClick={handleDeleteClick}
              showDeleteModal={showDeleteModal}
              projectsToDelete={projectsToDelete}
              setProjectsToDelete={setProjectsToDelete}
              selectedIds={selectedIds}
              setSelectedIds={setSelectedIds}
              isDeleting={isDeleting}
              handleDeleteConfirm={handleDeleteConfirm}
              setShowDeleteModal={setShowDeleteModal}
              setEditingProject={setEditingProject}
              searchTerm={searchTerm}
              sortConfig={sortConfig}
              setSortConfig={setSortConfig}
            />
          </div>
        </Card>
      </main>
    </div>
  );
}
