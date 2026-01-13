"use client";
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Header from './components/Header';
import CreateProjectForm from './components/CreateProjectForm';
import ProjectsTable from './components/ProjectsTable';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '../../store/store';
import apiClient from '../../lib/apiClient';
import authService from '../../lib/authService';
import { addProject, removeProject, setProjects, updateProject } from '../../store/projectSlice';
import { Project } from '@/lib/types';

function isError(error: unknown): error is Error {
  return error instanceof Error;
}
export interface ProjectStats {
  totalKeywords: number;
  ungroupedCount: number;
  groupedKeywordsCount: number;
  confirmedKeywordsCount: number;
  blockedCount: number;
  groupedPages: number;
  confirmedPages: number;
  totalParentKeywords: number;
}

export interface ProjectWithStats extends Project {
  stats?: ProjectStats;
}
export default function Projects() {
  const [newProjectName, setNewProjectName] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isLoadingProjects, setIsLoadingProjects] = useState<boolean>(true);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
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

  useEffect(() => {
    const fetchProjects = async () => {
      if (!authService.isAuthenticated()) {
        router.push('/');
        return;
      }

      try {
        setIsLoadingProjects(true);
        const response = await apiClient.fetchProjectsWithStats();
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
      const newProjectData = await apiClient.createProject(trimmedName);
      dispatch(addProject(newProjectData));
      setNewProjectName('');
      
      // Refresh the entire projects list with stats
      const response = await apiClient.fetchProjectsWithStats();
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
      const updatedProject = await apiClient.updateProject(projectId, trimmedName);
      dispatch(updateProject(updatedProject));
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
    setProjectToDelete(project);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!projectToDelete || isDeleting) return;

    setIsDeleting(true);
    setError('');
    try {
      await apiClient.deleteProject(projectToDelete.id);
      dispatch(removeProject({ projectId: projectToDelete.id }));
      setLocalProjects((prev) => prev.filter((p) => p.id !== projectToDelete.id));
      setShowDeleteModal(false);
      setProjectToDelete(null);
    } catch (deletionError: unknown) {
      const message = isError(deletionError) ? deletionError.message : 'Failed to delete project.';
      setError(message);
      setShowDeleteModal(false);
      console.error("Error deleting project:", deletionError);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-[1570px] mx-auto px-4 py-8">
        <CreateProjectForm
          newProjectName={newProjectName}
          setNewProjectName={setNewProjectName}
          isCreating={isCreating}
          handleCreateProject={handleCreateProject}
          error={error}
          setError={setError}
        />
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
          projectToDelete={projectToDelete}
          isDeleting={isDeleting}
          handleDeleteConfirm={handleDeleteConfirm}
          setShowDeleteModal={setShowDeleteModal}
          setEditingProject={setEditingProject}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          sortConfig={sortConfig}
          setSortConfig={setSortConfig}
        />
      </main>
    </div>
  );
}
