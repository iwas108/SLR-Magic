import { useState, useCallback, useEffect } from 'react';
import { Project } from '@/types';
import { broadcastSync } from '@/lib/sync-utils';

export function useProjects(showToast: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string>('');
  const [loadingProjects, setLoadingProjects] = useState(true);

  // Connection testing states
  const [testingProjectConnection, setTestingProjectConnection] = useState(false);
  const [projectConnectionTestResult, setProjectConnectionTestResult] = useState<{ success: boolean; message: string; details?: string } | null>(null);

  const activeProject = projects.find(p => String(p.id) === String(activeProjectId));

  const loadProjects = useCallback(async () => {
    setLoadingProjects(true);
    try {
      const res = await fetch('/api/projects');
      if (res.ok) {
        const data = await res.json();
        setProjects(data.projects || []);
        setActiveProjectId(data.activeProjectId || '');
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

  // Load projects on mount
  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

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
      const res = await fetch(`/api/projects`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...projectData })
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

  const handleTestProjectConnection = useCallback(async (provider: string, remoteName: string) => {
    setTestingProjectConnection(true);
    setProjectConnectionTestResult(null);
    try {
      const res = await fetch('/api/config/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cloud_provider: provider,
          rclone_remote_name: remoteName || (provider === 'onedrive' ? 'onedrive' : 'gdrive')
        })
      });
      const data = await res.json();
      setProjectConnectionTestResult({
        success: data.success,
        message: data.message,
        details: data.details
      });
    } catch (err: any) {
      setProjectConnectionTestResult({
        success: false,
        message: 'Network error occurred while testing connection.',
        details: err.message
      });
    } finally {
      setTestingProjectConnection(false);
    }
  }, []);

  const archiveProject = useCallback(async (
    projectId: string, 
    options: { destination: 'local' | 'cloud'; keepPdfZip: boolean }, 
    onSuccess?: () => void
  ) => {
    try {
      if (options.destination === 'local') {
        // Trigger direct browser download for SLR Archive
        window.location.href = `/api/projects/archive?projectId=${projectId}&type=slr`;
        
        // If user elected to keep PDF zip, trigger second download after brief delay
        if (options.keepPdfZip) {
          setTimeout(() => {
            window.location.href = `/api/projects/archive?projectId=${projectId}&type=pdf_zip`;
          }, 1500);
        }
      }

      // Execute the server-side purge & optimization
      const res = await fetch('/api/projects/archive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          destination: options.destination,
          keepPdfZip: options.keepPdfZip,
          executePurge: true
        })
      });

      if (res.ok) {
        const data = await res.json();
        showToast(
          options.destination === 'cloud'
            ? `Project archived & synced to cloud! Database space reclaimed.`
            : `Project archived & purged cleanly! Database space reclaimed.`,
          'success'
        );
        await loadProjects();
        if (onSuccess) onSuccess();
        broadcastSync('SYNC_PROJECTS');
        broadcastSync('SYNC_PAPERS');
        return true;
      } else {
        const data = await res.json();
        showToast(data.error || 'Failed to archive project', 'error');
        return false;
      }
    } catch (err: any) {
      showToast(`Error archiving project: ${err.message || err}`, 'error');
      return false;
    }
  }, [loadProjects, showToast]);

  const importProject = useCallback(async (archiveData: any, onSuccess?: (newId: string) => void) => {
    try {
      const res = await fetch('/api/projects/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archiveData })
      });

      if (res.ok) {
        const data = await res.json();
        let successMsg = `Project '${data.project?.name}' restored successfully!`;
        if (data.remappedPapersCount > 0) {
          successMsg += ` (${data.remappedPapersCount} papers deconflicted)`;
        }
        showToast(successMsg, 'success');
        await loadProjects();
        if (data.project?.id) {
          await activateProject(data.project.id);
          if (onSuccess) onSuccess(data.project.id);
        }
        broadcastSync('SYNC_PROJECTS');
        broadcastSync('SYNC_PAPERS');
        return true;
      } else {
        const data = await res.json();
        showToast(data.error || 'Failed to import project archive', 'error');
        return false;
      }
    } catch (err: any) {
      showToast(`Error importing project: ${err.message || err}`, 'error');
      return false;
    }
  }, [loadProjects, activateProject, showToast]);

  return {
    projects,
    setProjects,
    activeProjectId,
    setActiveProjectId,
    activeProject,
    loadingProjects,
    testingProjectConnection,
    setTestingProjectConnection,
    projectConnectionTestResult,
    setProjectConnectionTestResult,
    loadProjects,
    activateProject,
    createProject,
    updateProject,
    deleteProject,
    archiveProject,
    importProject,
    handleTestProjectConnection
  };
}
