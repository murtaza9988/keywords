"use client";
import React from 'react';
import { useRouter } from 'next/navigation';
import { BarChart3, Calendar, Edit2, Trash2, Loader2, ArrowUpDown } from 'lucide-react';
import { Project } from '@/lib/types';
import { ProjectWithStats } from '../page';

interface ProjectsTableProps {
  projects: ProjectWithStats[];
  isLoadingProjects: boolean;
  editingProject: Project | null;
  editProjectName: string;
  setEditProjectName: (value: string) => void;
  isEditing: boolean;
  handleEditClick: (project: Project) => void;
  handleEditSubmit: (e: React.FormEvent<HTMLFormElement>, projectId: number) => void;
  handleDeleteClick: (project: Project) => void;
  showDeleteModal: boolean;
  projectToDelete: Project | null;
  isDeleting: boolean;
  handleDeleteConfirm: () => void;
  setShowDeleteModal: (value: boolean) => void;
  setEditingProject: (project: Project | null) => void;
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  sortConfig: { key: string; order: 'asc' | 'desc' };
  setSortConfig: (config: { key: string; order: 'asc' | 'desc' }) => void;
}

const formatDate = (dateString: string | undefined | null): string => {
  if (!dateString) return 'N/A';
  try {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch (e) {
    console.error("Error formatting date:", dateString, e);
    return 'Invalid Date';
  }
};

const formatNumber = (num: number | undefined): string => {
  if (num === undefined || num === null) return '0';
  return num.toLocaleString();
};

const StatsCell = ({ value }: { value: number | undefined }) => {
  return <span className="text-gray-800 font-light text-[13px]">{formatNumber(value)}</span>;
};

export default function ProjectsTable({
  projects,
  isLoadingProjects,
  editingProject,
  editProjectName,
  setEditProjectName,
  isEditing,
  handleEditClick,
  handleEditSubmit,
  handleDeleteClick,
  showDeleteModal,
  projectToDelete,
  isDeleting,
  handleDeleteConfirm,
  setShowDeleteModal,
  setEditingProject,
  searchTerm,
  setSearchTerm,
  sortConfig,
  setSortConfig,
}: ProjectsTableProps) {
  const router = useRouter();

  const filteredProjects = projects.filter(project =>
    project.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const sortedProjects = [...filteredProjects].sort((a, b) => {
    const order = sortConfig.order === 'asc' ? 1 : -1;
    switch (sortConfig.key) {
      case 'name':
        return order * a.name.localeCompare(b.name);
      case 'created_at':
        return order * (new Date(a.created_at || '').getTime() - new Date(b.created_at || '').getTime());
      case 'totalParentKeywords':
        return order * ((a.stats?.totalParentKeywords || 0) - (b.stats?.totalParentKeywords || 0));
      case 'ungroupedCount':
        return order * ((a.stats?.ungroupedCount || 0) - (b.stats?.ungroupedCount || 0));
      case 'groupedKeywordsCount':
        return order * ((a.stats?.groupedKeywordsCount || 0) - (b.stats?.groupedKeywordsCount || 0));
      case 'confirmedKeywordsCount':
        return order * ((a.stats?.confirmedKeywordsCount || 0) - (b.stats?.confirmedKeywordsCount || 0));
      case 'blockedCount':
        return order * ((a.stats?.blockedCount || 0) - (b.stats?.blockedCount || 0));
      default:
        return 0;
    }
  });

  const handleSort = (key: string) => {
    setSortConfig({
      key,
      order: sortConfig.key === key && sortConfig.order === 'asc' ? 'desc' : 'asc',
    });
  };

  const handleRowClick = (project: Project, event: React.MouseEvent) => {
    if (
      event.target instanceof Element && 
      (event.target.closest('button') || event.target.closest('form'))
    ) {
      return;
    }
    
    if (editingProject?.id === project.id) {
      return;
    }

    router.push(`/projects/${project.id}`);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden w-full">
      {isLoadingProjects ? (
        <div className="flex justify-center items-center py-20">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-gray-600">Loading projects...</p>
          </div>
        </div>
      ) : projects.length === 0 ? (
        <div className="p-12 text-center">
          <BarChart3 className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No projects yet</h3>
          <p className="text-gray-600">Create your first project to get started with keyword management.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="flex items-center justify-start gap-6 mb-6 px-6 pt-6">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900">Projects </h2>
              <p className="text-gray-600 mt-1">Manage your [{filteredProjects.length}] SEO keyword projects</p>
            </div>
            <div className="flex items-center mt-8 gap-4">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search projects..."
                className="px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-400 w-64"
              />
              
            </div>
          </div>
          <table className="w-full divide-y divide-[#eaeaea]">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/4">
                  <div className="flex items-center gap-2 cursor-pointer" onClick={() => handleSort('name')}>
                    <BarChart3 className="h-4 w-4" />
                    Project Name
                    <ArrowUpDown className="h-4 w-4" />
                  </div>
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/6">
                  <div className="flex items-center gap-2 cursor-pointer" onClick={() => handleSort('created_at')}>
                    <Calendar className="h-4 w-4" />
                    Date Created
                    <ArrowUpDown className="h-4 w-4" />
                  </div>
                </th>
                <th className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-1/8">
                  <div className="flex items-center justify-center gap-2 cursor-pointer" onClick={() => handleSort('totalParentKeywords')}>
                    Total Parent Keywords
                    <ArrowUpDown className="h-4 w-4" />
                  </div>
                </th>
                <th className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-1/8">
                  <div className="flex flex-col items-center cursor-pointer" onClick={() => handleSort('ungroupedCount')}>
                    <div className="flex items-center gap-2">
                      <span>Keywords</span>
                      <ArrowUpDown className="h-4 w-4" />
                    </div>
                    <span className="text-xs text-gray-400 font-normal">(View 1)</span>
                  </div>
                </th>
                <th className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-1/8">
                  <div className="flex flex-col items-center cursor-pointer" onClick={() => handleSort('groupedKeywordsCount')}>
                    <div className="flex items-center gap-2">
                      <span>Keywords</span>
                      <ArrowUpDown className="h-4 w-4" />
                    </div>
                    <span className="text-xs text-gray-400 font-normal">(View 2)</span>
                  </div>
                </th>
                <th className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-1/8">
                  <div className="flex flex-col items-center cursor-pointer" onClick={() => handleSort('confirmedKeywordsCount')}>
                    <div className="flex items-center gap-2">
                      <span>Keywords</span>
                      <ArrowUpDown className="h-4 w-4" />
                    </div>
                    <span className="text-xs text-gray-400 font-normal">(View 3)</span>
                  </div>
                </th>
                <th className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-1/8">
                  <div className="flex flex-col items-center cursor-pointer" onClick={() => handleSort('blockedCount')}>
                    <div className="flex items-center gap-2">
                      <span>Keywords</span>
                      <ArrowUpDown className="h-4 w-4" />
                    </div>
                    <span className="text-xs text-gray-400 font-normal">(View 4)</span>
                  </div>
                </th>
                <th className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-1/8">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eaeaea]">
              {sortedProjects.map((project, index) => {
                const rowBgClass = index % 2 === 0 ? 'bg-white' : 'bg-[#f4f4f4]';
                const isCurrentlyEditing = editingProject?.id === project.id;
                
                return (
                  <tr 
                    key={project.id} 
                    className={`${rowBgClass} ${!isCurrentlyEditing ? 'hover:bg-gray-50 cursor-pointer' : ''} transition-colors`}
                    onClick={(event) => handleRowClick(project, event)}
                  >
                    {isCurrentlyEditing ? (
                      <td className="px-6 py-4 whitespace-nowrap" colSpan={8}>
                        <form
                          onSubmit={(e) => handleEditSubmit(e, project.id)}
                          className="flex gap-2 items-center"
                        >
                          <input
                            type="text"
                            value={editProjectName}
                            onChange={(e) => setEditProjectName(e.target.value)}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            required
                          />
                          <button
                            type="submit"
                            disabled={isEditing}
                            className="px-4 py-2 cursor-pointer bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed flex items-center gap-2"
                          >
                            {isEditing ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Saving...
                              </>
                            ) : (
                              'Save'
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingProject(null)}
                            className="px-4 py-2 cursor-pointer bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                          >
                            Cancel
                          </button>
                        </form>
                      </td>
                    ) : (
                      <>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center group">
                            <div>
                              <div className="text-[14px] font-semibold text-gray-800 group-hover:text-blue-600 transition-colors">
                                {project.name}
                              </div>
                              <div className="text-[13px] font-light text-gray-800">
                                ID: {project.id}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-800 font-light text-[13px]">
                          {formatDate(project.created_at)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <StatsCell 
                            value={project.stats?.totalParentKeywords}
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <StatsCell 
                            value={project.stats?.ungroupedCount}
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <StatsCell 
                            value={project.stats?.groupedKeywordsCount}
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <StatsCell 
                            value={project.stats?.confirmedKeywordsCount}
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <StatsCell 
                            value={project.stats?.blockedCount}
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditClick(project);
                              }}
                              className="p-2 text-gray-500 hover:text-blue-600 cursor-pointer rounded-full hover:bg-blue-50 transition-colors"
                              aria-label={`Edit project ${project.name}`}
                            >
                              <Edit2 size={16} />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteClick(project);
                              }}
                              className="p-2 text-gray-500 hover:text-red-600 cursor-pointer rounded-full hover:bg-red-50 transition-colors"
                              aria-label={`Delete project ${project.name}`}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {showDeleteModal && projectToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Confirm Deletion</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete the project &ldquo;<strong className='font-medium'>{projectToDelete.name}</strong>&ldquo;? This action cannot be undone and will permanently remove all associated data.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeleting}
                className="px-4 py-2 text-sm cursor-pointer font-medium text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="px-4 py-2 cursor-pointer text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:bg-red-400 flex items-center gap-2 transition-colors"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    Delete
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}