"use client";
import React from 'react';
import { useRouter } from 'next/navigation';
import { BarChart3, Calendar, Edit2, Trash2, Loader2, ArrowUpDown } from 'lucide-react';
import { Project } from '@/lib/types';
import { ProjectWithStats } from '../page';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';

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
  return <span className="text-foreground font-normal text-[13px]">{formatNumber(value)}</span>;
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
    <div className="overflow-hidden w-full text-[13px] text-foreground">
      {isLoadingProjects ? (
        <div className="flex justify-center items-center py-20">
          <div className="text-center">
            <Spinner size="lg" className="text-accent border-muted border-t-accent mx-auto mb-4" />
            <p className="text-muted">Loading projects...</p>
          </div>
        </div>
      ) : projects.length === 0 ? (
        <div className="p-12 text-center">
          <BarChart3 className="h-16 w-16 text-muted mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">No projects yet</h3>
          <p className="text-muted">Create your first project to get started with keyword management.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full divide-y divide-border text-[13px]">
            <thead className="bg-surface-muted">
              <tr>
                <th className="px-6 py-4 text-left text-[11px] font-semibold text-muted uppercase tracking-wider w-1/4">
                  <div className="flex items-center gap-2 cursor-pointer" onClick={() => handleSort('name')}>
                    <BarChart3 className="h-4 w-4" />
                    Project Name
                    <ArrowUpDown className="h-4 w-4" />
                  </div>
                </th>
                <th className="px-6 py-4 text-left text-[11px] font-semibold text-muted uppercase tracking-wider w-1/6">
                  <div className="flex items-center gap-2 cursor-pointer" onClick={() => handleSort('created_at')}>
                    <Calendar className="h-4 w-4" />
                    Date Created
                    <ArrowUpDown className="h-4 w-4" />
                  </div>
                </th>
                <th className="px-6 py-4 text-center text-[11px] font-semibold text-muted uppercase tracking-wider w-1/8">
                  <div className="flex items-center justify-center gap-2 cursor-pointer" onClick={() => handleSort('totalParentKeywords')}>
                    Total Parent Keywords
                    <ArrowUpDown className="h-4 w-4" />
                  </div>
                </th>
                <th className="px-6 py-4 text-center text-[11px] font-semibold text-muted uppercase tracking-wider w-1/8">
                  <div className="flex flex-col items-center cursor-pointer" onClick={() => handleSort('ungroupedCount')}>
                    <div className="flex items-center gap-2">
                      <span>Keywords</span>
                      <ArrowUpDown className="h-4 w-4" />
                    </div>
                    <span className="text-[11px] text-muted font-normal">(View 1)</span>
                  </div>
                </th>
                <th className="px-6 py-4 text-center text-[11px] font-semibold text-muted uppercase tracking-wider w-1/8">
                  <div className="flex flex-col items-center cursor-pointer" onClick={() => handleSort('groupedKeywordsCount')}>
                    <div className="flex items-center gap-2">
                      <span>Keywords</span>
                      <ArrowUpDown className="h-4 w-4" />
                    </div>
                    <span className="text-[11px] text-muted font-normal">(View 2)</span>
                  </div>
                </th>
                <th className="px-6 py-4 text-center text-[11px] font-semibold text-muted uppercase tracking-wider w-1/8">
                  <div className="flex flex-col items-center cursor-pointer" onClick={() => handleSort('confirmedKeywordsCount')}>
                    <div className="flex items-center gap-2">
                      <span>Keywords</span>
                      <ArrowUpDown className="h-4 w-4" />
                    </div>
                    <span className="text-[11px] text-muted font-normal">(View 3)</span>
                  </div>
                </th>
                <th className="px-6 py-4 text-center text-[11px] font-semibold text-muted uppercase tracking-wider w-1/8">
                  <div className="flex flex-col items-center cursor-pointer" onClick={() => handleSort('blockedCount')}>
                    <div className="flex items-center gap-2">
                      <span>Keywords</span>
                      <ArrowUpDown className="h-4 w-4" />
                    </div>
                    <span className="text-[11px] text-muted font-normal">(View 4)</span>
                  </div>
                </th>
                <th className="px-6 py-4 text-center text-[11px] font-semibold text-muted uppercase tracking-wider w-1/8">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sortedProjects.map((project, index) => {
                const rowBgClass = index % 2 === 0 ? 'bg-table-row' : 'bg-table-row-alt';
                const isCurrentlyEditing = editingProject?.id === project.id;
                
                return (
                  <tr 
                    key={project.id} 
                    className={`${rowBgClass} ${!isCurrentlyEditing ? 'hover:bg-surface-muted cursor-pointer' : ''} transition-colors`}
                    onClick={(event) => handleRowClick(project, event)}
                  >
                    {isCurrentlyEditing ? (
                      <td className="px-6 py-4 whitespace-nowrap" colSpan={8}>
                        <form
                          onSubmit={(e) => handleEditSubmit(e, project.id)}
                          className="flex gap-2 items-center"
                        >
                          <Input
                            type="text"
                            value={editProjectName}
                            onChange={(e) => setEditProjectName(e.target.value)}
                            className="flex-1"
                            required
                          />
                          <Button
                            type="submit"
                            disabled={isEditing}
                            className="flex items-center gap-2"
                          >
                            {isEditing ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Saving...
                              </>
                            ) : (
                              'Save'
                            )}
                          </Button>
                          <Button
                            type="button"
                            onClick={() => setEditingProject(null)}
                            variant="secondary"
                          >
                            Cancel
                          </Button>
                        </form>
                      </td>
                    ) : (
                      <>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center group">
                            <div>
                              <div className="text-[13px] font-semibold text-foreground group-hover:text-accent transition-colors">
                                {project.name}
                              </div>
                              <div className="text-[12px] font-normal text-muted">
                                ID: {project.id}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-foreground font-normal text-[13px]">
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
                            <Button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditClick(project);
                              }}
                              variant="ghost"
                              size="sm"
                              className="text-muted hover:text-accent"
                              aria-label={`Edit project ${project.name}`}
                            >
                              <Edit2 size={16} />
                            </Button>
                            <Button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteClick(project);
                              }}
                              variant="ghost"
                              size="sm"
                              className="text-muted hover:text-red-400"
                              aria-label={`Delete project ${project.name}`}
                            >
                              <Trash2 size={16} />
                            </Button>
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
        <div className="fixed inset-0 bg-overlay flex items-center justify-center z-50 p-4">
          <div className="bg-surface rounded-2xl p-6 max-w-md w-full shadow-xl border border-border">
            <h3 className="text-lg font-semibold text-foreground mb-4">Confirm Deletion</h3>
            <p className="text-muted mb-6">
              Are you sure you want to delete the project &ldquo;<strong className='font-medium text-foreground'>{projectToDelete.name}</strong>&ldquo;? This action cannot be undone and will permanently remove all associated data.
            </p>
            <div className="flex justify-end gap-3">
              <Button
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeleting}
                variant="secondary"
              >
                Cancel
              </Button>
              <Button
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                variant="danger"
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
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
