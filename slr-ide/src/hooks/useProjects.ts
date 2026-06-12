import { useState, useCallback, useEffect } from 'react';
import { Project } from '@/types';
import { broadcastSync } from '@/lib/sync-utils';

export function useProjects(showToast: (msg: string, type: string) => void) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string>('default-project');
  const [loadingProjects, setLoadingProjects] = useState(true);

  const activeProject = projects.find(p => p.id === activeProjectId);

  const loadProjects = useCallback(async () => {
    setLoadingProjects(true);
    try {
      const res = await fetch('/api/projects');
      if (res.ok) {
        const data = await res.json();
        setProjects(data.projects || []);
        setActiveProjectId(data.activeProjectId || 'default-project');
        return { projects: data.projects, activeProjectId: data.activeProjectId };
      } else {
        showToast('Failed to load projects list', 'error');
      }
    } catch (err: any) {
      showToast(`Error loading projects: ${err.message || err}`, 'error');
    } finally {
      setLoadingProjects(false);
    }
    return null;
  }, [showToast]);

  const activateProject = useCallback(async (id: string, onActiveCallback?: () => void) => {
    try {
      const res = await fetch('/api/projects/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      if (res.ok) {
        showToast('Project switched successfully!', 'success');
        setActiveProjectId(id);
        await loadProjects();
        if (onActiveCallback) onActiveCallback();
        broadcastSync('SYNC_PROJECTS');
      } else {
        const data = await res.json();
        showToast(data.error || 'Failed to switch active project', 'error');
      }
    } catch (err: any) {
      showToast(`Error switching active project: ${err.message || err}`, 'error');
    }
  }, [loadProjects, showToast]);

  const createProject = useCallback(async (projectData: any, onSuccess?: (id: string) => void) => {
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(projectData)
      });

      if (res.ok) {
        const data = await res.json();
        showToast('Project created successfully!', 'success');
        await loadProjects();
        if (data.project && data.project.id) {
          await activateProject(data.project.id);
          if (onSuccess) onSuccess(data.project.id);
        }
        broadcastSync('SYNC_PROJECTS');
        return true;
      } else {
        const data = await res.json();
        showToast(data.error || 'Failed to create project', 'error');
        return false;
      }
    } catch (err: any) {
      showToast(`Error creating project: ${err.message || err}`, 'error');
      return false;
    }
  }, [loadProjects, activateProject, showToast]);

  const updateProject = useCallback(async (id: string, projectData: any, onSuccess?: () => void) => {
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(projectData)
      });
      if (res.ok) {
        showToast('Project details saved successfully!', 'success');
        await loadProjects();
        if (onSuccess) onSuccess();
        broadcastSync('SYNC_PROJECTS');
        return true;
      } else {
        const data = await res.json();
        showToast(data.error || 'Failed to save project details', 'error');
        return false;
      }
    } catch (err: any) {
      showToast(`Error saving project details: ${err.message || err}`, 'error');
      return false;
    }
  }, [loadProjects, showToast]);

  const deleteProject = useCallback(async (id: string, onSuccess?: () => void) => {
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        showToast('Project and its data deleted successfully', 'success');
        await loadProjects();
        if (onSuccess) onSuccess();
        broadcastSync('SYNC_PROJECTS');
        return true;
      } else {
        const data = await res.json();
        showToast(data.error || 'Failed to delete project', 'error');
        return false;
      }
    } catch (err: any) {
      showToast(`Error deleting project: ${err.message || err}`, 'error');
      return false;
    }
  }, [loadProjects, showToast]);

  return {
    projects,
    activeProjectId,
    activeProject,
    loadingProjects,
    loadProjects,
    activateProject,
    createProject,
    updateProject,
    deleteProject
  };
}
