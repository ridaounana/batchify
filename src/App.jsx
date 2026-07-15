import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Film, AlertTriangle, Cpu, Shirt } from 'lucide-react';
import ProjectList from './components/ProjectList.jsx';
import ProjectDetails from './components/ProjectDetails.jsx';
import Settings from './components/Settings.jsx';
import OutfitCatalogue from './components/OutfitCatalogue.jsx';

export default function App() {
  const [projects, setProjects] = useState([]);
  const [activeProject, setActiveProject] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showCatalogue, setShowCatalogue] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Fetch projects on load
  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = () => {
    setLoading(true);
    fetch('/api/projects')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load projects');
        return res.json();
      })
      .then((data) => {
        setProjects(data);
        if (data.length > 0) {
          // Auto select first project
          setActiveProject(data[0]);
        }
      })
      .catch((err) => {
        setError(err.message);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  const handleCreateProject = (name) => {
    fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    })
      .then(res => res.json())
      .then(newProj => {
        setProjects(prev => [newProj, ...prev]);
        setActiveProject(newProj);
      })
      .catch(err => alert('Failed to create project: ' + err.message));
  };

  const handleDeleteProject = (id) => {
    fetch(`/api/projects/${id}`, {
      method: 'DELETE'
    })
      .then(res => res.json())
      .then(() => {
        setProjects(prev => prev.filter(p => p.id !== id));
        if (activeProject && activeProject.id === id) {
          setActiveProject(null);
        }
      })
      .catch(err => alert('Failed to delete project: ' + err.message));
  };

  const handleUpdateProject = (updatedProj) => {
    setProjects(prev => prev.map(p => p.id === updatedProj.id ? updatedProj : p));
    if (activeProject && activeProject.id === updatedProj.id) {
      setActiveProject(updatedProj);
    }
  };

  return (
    <div className="batchify-app dark-theme">
      {/* Background glowing decorations */}
      <div className="glow-sphere-1"></div>
      <div className="glow-sphere-2"></div>

      <header className="app-header glass-panel flex justify-between align-center p-15">
        <div className="logo flex align-center gap-10 select-none">
          <Cpu className="text-primary spin-slow" size={24} />
          <span className="brand-title">BATCHIFY</span>
          <span className="brand-version">v1.0.0</span>
        </div>

        <div className="flex align-center gap-15">
          {/* Main Tab Navigation */}
          <div className="tab-navigation flex gap-5 glass-panel p-5" style={{ borderRadius: 'var(--radius-sm)', background: 'rgba(255, 255, 255, 0.02)' }}>
            <button
              onClick={() => { setShowSettings(false); setShowCatalogue(false); }}
              className={`btn flex align-center gap-5 btn-xs px-10 py-5 ${(!showSettings && !showCatalogue) ? 'btn-primary' : 'btn-text text-muted'}`}
              style={{ borderRadius: 'var(--radius-xs)', fontSize: '12px', border: 'none' }}
            >
              <Film size={12} />
              Projects
            </button>
            <button
              onClick={() => { setShowSettings(false); setShowCatalogue(true); }}
              className={`btn flex align-center gap-5 btn-xs px-10 py-5 ${(showCatalogue && !showSettings) ? 'btn-primary' : 'btn-text text-muted'}`}
              style={{ borderRadius: 'var(--radius-xs)', fontSize: '12px', border: 'none' }}
            >
              <Shirt size={12} />
              Wardrobe Catalogue
            </button>
          </div>

          <button
            onClick={() => { setShowSettings(!showSettings); }}
            className={`btn-settings flex align-center gap-5 btn-secondary-outline ${showSettings ? 'active' : ''}`}
          >
            <SettingsIcon size={16} />
            Configure Server
          </button>
        </div>
      </header>

      <main className="app-main flex-grow flex gap-20 p-20 overflow-hidden">
        {!showCatalogue && !showSettings && (
          <ProjectList
            projects={projects}
            activeProject={activeProject}
            onSelectProject={setActiveProject}
            onCreateProject={handleCreateProject}
            onDeleteProject={handleDeleteProject}
          />
        )}

        <div className="main-content-panel flex-grow overflow-hidden flex-column">
          {showSettings ? (
            <Settings onClose={() => setShowSettings(false)} />
          ) : showCatalogue ? (
            <OutfitCatalogue />
          ) : activeProject ? (
            <ProjectDetails
              project={activeProject}
              onUpdateProject={handleUpdateProject}
            />
          ) : (
            <div className="glass-panel empty-project-state flex-column align-center justify-center flex-grow p-40">
              <Film size={64} className="text-muted mb-20" />
              <h2>No Project Selected</h2>
              <p className="text-muted mt-5">Select an existing video project from the sidebar, or create a new one to begin frame treatment.</p>
            </div>
          )}
        </div>
      </main>

      {error && (
        <div className="error-toast flex align-center gap-10 p-15 glass-panel">
          <AlertTriangle className="text-danger" size={18} />
          <span>{error}</span>
          <button onClick={() => setError('')} className="btn-text">Dismiss</button>
        </div>
      )}
    </div>
  );
}
