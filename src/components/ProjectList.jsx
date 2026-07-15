import React, { useState } from 'react';
import { Plus, Trash2, Folder, Film, Clock, CheckCircle, RefreshCw, AlertCircle } from 'lucide-react';

export default function ProjectList({ projects, activeProject, onSelectProject, onCreateProject, onDeleteProject }) {
  const [newProjectName, setNewProjectName] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  const getStatusIcon = (status) => {
    switch (status) {
      case 'waiting_upload': return <Film size={16} className="text-warning" />;
      case 'uploaded': return <Clock size={16} className="text-info" />;
      case 'extracting': return <RefreshCw size={16} className="text-primary spin" />;
      case 'extracted': return <Folder size={16} className="text-secondary" />;
      case 'processing': return <RefreshCw size={16} className="text-primary spin" />;
      case 'processed': return <Folder size={16} className="text-success" />;
      case 'compiling': return <RefreshCw size={16} className="text-primary spin" />;
      case 'completed': return <CheckCircle size={16} className="text-success" />;
      case 'error': return <AlertCircle size={16} className="text-danger" />;
      default: return <Folder size={16} className="text-muted" />;
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'waiting_upload': return 'Waiting Video';
      case 'uploaded': return 'Ready to Extract';
      case 'extracting': return 'Extracting...';
      case 'extracted': return 'Frames Extracted';
      case 'processing': return 'AI Editing...';
      case 'processed': return 'AI Done';
      case 'compiling': return 'Compiling...';
      case 'completed': return 'Completed';
      case 'error': return 'Error';
      default: return 'New';
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    onCreateProject(newProjectName);
    setNewProjectName('');
    setShowCreateModal(false);
  };

  return (
    <div className="project-sidebar glass-panel">
      <div className="sidebar-header flex justify-between align-center">
        <h2>Workspace Projects</h2>
        <button onClick={() => setShowCreateModal(true)} className="btn-icon btn-primary-outline" title="New Project">
          <Plus size={18} />
        </button>
      </div>

      {showCreateModal && (
        <div className="modal-overlay animated-fade-in">
          <div className="glass-modal modal-content">
            <h3>Create New Video Project</h3>
            <form onSubmit={handleSubmit}>
              <input
                type="text"
                placeholder="Project Name (e.g., Cyberpunk Edit)"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                required
                autoFocus
                className="glass-input"
              />
              <div className="modal-actions">
                <button type="button" onClick={() => setShowCreateModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Create Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="project-items-list">
        {projects.length === 0 ? (
          <div className="empty-state">
            <Film size={32} className="text-muted" />
            <p>No projects found.</p>
            <button onClick={() => setShowCreateModal(true)} className="btn btn-primary-outline btn-sm">
              Create One
            </button>
          </div>
        ) : (
          projects.map((project) => {
            const isActive = activeProject && activeProject.id === project.id;
            return (
              <div
                key={project.id}
                className={`project-card ${isActive ? 'active' : ''}`}
                onClick={() => onSelectProject(project)}
              >
                <div className="card-top flex justify-between align-center">
                  <span className="project-title">{project.name}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Are you sure you want to delete "${project.name}"?`)) {
                        onDeleteProject(project.id);
                      }
                    }}
                    className="btn-delete"
                    title="Delete Project"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="card-bottom flex align-center gap-10">
                  <span className="status-badge flex align-center gap-5">
                    {getStatusIcon(project.status)}
                    {getStatusLabel(project.status)}
                  </span>
                  {project.extractedCount > 0 && (
                    <span className="card-info">
                      {project.editedCount}/{project.extractedCount} frames
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
