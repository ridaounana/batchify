import React, { useState, useEffect, useRef } from 'react';
import { Upload, Scissors, Zap, Film, RefreshCw, Layers, CheckCircle, AlertCircle, Play, Eye, Shirt, Sparkles } from 'lucide-react';
import FrameEditor from './FrameEditor.jsx';
import VideoPlayer from './VideoPlayer.jsx';

export default function ProjectDetails({ project, onUpdateProject }) {
  const [videoFile, setVideoFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [fps, setFps] = useState(project.fps || 16);
  const [comfyLoading, setComfyLoading] = useState(false);
  const [pollingActive, setPollingActive] = useState(false);
  const [activeTab, setActiveTab] = useState('frames'); // 'frames' | 'preview'
  const [comfyBatchSize, setComfyBatchSize] = useState(1);
  const [promptText, setPromptText] = useState('Wearikng a short dress');
  const [includeAudio, setIncludeAudio] = useState(true);
  const [schedulerSteps, setSchedulerSteps] = useState(20);
  const [loraStrength, setLoraStrength] = useState(0.7);
  const [seedMode, setSeedMode] = useState('fixed');
  const [noiseSeed, setNoiseSeed] = useState('1122879734307696');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [outfits, setOutfits] = useState([]);
  const [selectedOutfitId, setSelectedOutfitId] = useState('');
  const [showOutfitDrawer, setShowOutfitDrawer] = useState(false);

  useEffect(() => {
    fetch('/api/outfits')
      .then(res => res.json())
      .then(data => setOutfits(data || []))
      .catch(err => console.error('Error fetching outfits for selector:', err));
  }, []);
  const [progressData, setProgressData] = useState({
    status: project.status,
    extractedCount: project.extractedCount,
    editedCount: project.editedCount,
    percent: 0
  });

  const pollIntervalRef = useRef(null);

  // Poll for progress updates if Comfy is processing or compiling
  useEffect(() => {
    setProgressData({
      status: project.status,
      extractedCount: project.extractedCount,
      editedCount: project.editedCount,
      percent: project.extractedCount > 0 ? Math.round((project.editedCount / project.extractedCount) * 100) : 0
    });

    if (project.status === 'processing' || project.status === 'compiling' || pollingActive) {
      startPolling();
    } else {
      stopPolling();
    }

    return () => stopPolling();
  }, [project.id, project.status, pollingActive]);

  const startPolling = () => {
    if (pollIntervalRef.current) return;
    setPollingActive(true);
    pollIntervalRef.current = setInterval(checkProgress, 2000);
  };

  const stopPolling = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  };

  const checkProgress = () => {
    fetch(`/api/projects/${project.id}/progress`)
      .then(res => res.json())
      .then(data => {
        setProgressData(data);
        if (data.status !== project.status || data.editedCount !== project.editedCount || data.extractedCount !== project.extractedCount) {
          onUpdateProject({
            ...project,
            status: data.status,
            editedCount: data.editedCount,
            extractedCount: data.extractedCount
          });
        }
        if (data.status === 'processed' || data.status === 'completed' || data.status === 'error') {
          stopPolling();
          setPollingActive(false);
        }
      })
      .catch(err => {
        console.error('Error polling progress:', err);
      });
  };

  const handleUpload = (e) => {
    e.preventDefault();
    if (!videoFile) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('projectId', project.id);
    formData.append('video', videoFile);

    fetch(`/api/projects/${project.id}/upload?projectId=${project.id}`, {
      method: 'POST',
      body: formData
    })
      .then(res => {
        if (!res.ok) throw new Error('Upload failed');
        return res.json();
      })
      .then(updatedProject => {
        onUpdateProject(updatedProject);
        setVideoFile(null);
      })
      .catch(err => {
        alert(err.message);
      })
      .finally(() => {
        setUploading(false);
      });
  };

  const handleExtract = () => {
    setExtracting(true);
    fetch(`/api/projects/${project.id}/extract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fps })
    })
      .then(res => {
        if (!res.ok) throw new Error('Extraction request failed');
        return res.json();
      })
      .then(() => {
        // Mock status to extracting immediately
        onUpdateProject({ ...project, status: 'extracting', fps });
        // Start polling directory to find when it is finished
        startPolling();
      })
      .catch(err => {
        alert(err.message);
        setExtracting(false);
      });
  };

  const handleTriggerComfy = () => {
    setComfyLoading(true);
    fetch(`/api/projects/${project.id}/trigger-comfy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        batchSize: comfyBatchSize,
        promptText,
        schedulerSteps,
        loraStrength,
        seedMode,
        noiseSeed,
        outfitId: selectedOutfitId || null
      })
    })
      .then(res => {
        if (!res.ok) throw new Error('Failed to start ComfyUI workflow. Ensure ComfyUI server is running and accessible.');
        return res.json();
      })
      .then(data => {
        onUpdateProject({ ...project, status: 'processing', comfyJobId: data.promptId });
        startPolling();
      })
      .catch(err => {
        alert(err.message);
      })
      .finally(() => {
        setComfyLoading(false);
      });
  };

  const handlePauseComfy = () => {
    if (!confirm('Are you sure you want to pause ComfyUI processing? This will cancel the active queue.')) return;
    fetch(`/api/projects/${project.id}/pause-comfy`, {
      method: 'POST'
    })
      .then(res => {
        if (!res.ok) throw new Error('Pause request failed');
        return res.json();
      })
      .then(() => {
        onUpdateProject({ ...project, status: 'extracted' });
        stopPolling();
        setPollingActive(false);
      })
      .catch(err => {
        alert(err.message);
      });
  };

  const handleCompile = () => {
    fetch(`/api/projects/${project.id}/compile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ includeAudio })
    })
      .then(res => {
        if (!res.ok) throw new Error('Compilation request failed');
        return res.json();
      })
      .then(() => {
        onUpdateProject({ ...project, status: 'compiling' });
        startPolling();
      })
      .catch(err => {
        alert(err.message);
      });
  };

  // Render Status Panel Content
  const renderWorkflowStatus = () => {
    const { status, extractedCount, editedCount, percent } = progressData;

    switch (status) {
      case 'waiting_upload':
        return (
          <div className="status-flow-card waiting animated-slide-down">
            <div className="card-icon"><Upload size={28} /></div>
            <div className="card-info">
              <h4>Upload Source Video</h4>
              <p>Upload the original video to initialize frame extraction. Supported format: MP4, MOV, WebM.</p>
              <form onSubmit={handleUpload} className="flex gap-10 mt-15">
                <input
                  type="file"
                  accept="video/*"
                  onChange={(e) => setVideoFile(e.target.files[0])}
                  className="glass-file-input"
                  required
                />
                <button type="submit" disabled={uploading} className="btn btn-primary">
                  {uploading ? 'Uploading...' : 'Upload Video'}
                </button>
              </form>
            </div>
          </div>
        );

      case 'uploaded':
        return (
          <div className="status-flow-card ready animated-slide-down">
            <div className="card-icon"><Scissors size={28} /></div>
            <div className="card-info">
              <h4>Frame Extraction Settings</h4>
              <p>Extract frames from the video. Choose your target processing framerate (16 FPS is recommended for this workflow).</p>
              <div className="flex align-center gap-15 mt-15">
                <div className="fps-selector">
                  <label>Target FPS:</label>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={fps}
                    onChange={(e) => setFps(parseInt(e.target.value, 10))}
                    className="glass-input-sm"
                  />
                </div>
                <button onClick={handleExtract} disabled={extracting} className="btn btn-primary">
                  <Scissors size={16} />
                  Extract Whole Frames
                </button>
              </div>
            </div>
          </div>
        );

      case 'extracting':
        return (
          <div className="status-flow-card active animated-slide-down">
            <div className="card-icon spin"><RefreshCw size={28} /></div>
            <div className="card-info">
              <h4>Extracting Frames...</h4>
              <p>FFmpeg is extracting video frames at {fps} FPS. This may take a few seconds.</p>
              <div className="progress-bar-container mt-15">
                <div className="progress-bar infinite-loading"></div>
              </div>
            </div>
          </div>
        );

      case 'extracted':
        return (
          <div className="status-flow-card ready animated-slide-down">
            <div className="card-icon"><Zap size={28} /></div>
            <div className="card-info width-100">
              <div className="flex gap-15 mt-10">
                <div className="form-group mb-5 flex-grow">
                  <label className="text-muted font-semibold">Custom Edit Query Prompt (Node 22):</label>
                  <input
                    type="text"
                    value={promptText}
                    onChange={(e) => setPromptText(e.target.value)}
                    placeholder="e.g. Wearing a short dress, cyberpunk style, neon accents"
                    className="glass-input width-100"
                  />
                </div>
                <div className="form-group mb-5" style={{ width: '150px', flexShrink: 0 }}>
                  <label className="text-muted font-semibold">Scheduler Steps (Node 393):</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={schedulerSteps}
                    onChange={(e) => setSchedulerSteps(parseInt(e.target.value, 10))}
                    className="glass-input width-100"
                  />
                </div>
              </div>

              {/* Call-to-Action for V1 Multi-Ref Outfit Workflow */}
              {!selectedOutfitId ? (
                <div 
                  className="glass-panel p-15 mt-15 flex justify-between align-center hover-scale" 
                  style={{ 
                    background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.05) 0%, rgba(20, 20, 25, 0.3) 100%)', 
                    cursor: 'pointer',
                    border: '1px solid var(--border-glass)'
                  }} 
                  onClick={() => setShowOutfitDrawer(!showOutfitDrawer)}
                >
                  <div className="flex align-center gap-15">
                    <div className="p-10 rounded-full" style={{ background: 'rgba(99, 102, 241, 0.1)' }}>
                      <Shirt className="text-primary" size={20} />
                    </div>
                    <div>
                      <h5 className="font-semibold text-sm m-0" style={{ color: 'var(--text-main)' }}>Add AI Outfit Fitting? (V1 Multi-Ref Model)</h5>
                      <p className="text-xs text-muted m-0">Apply a transparent wardrobe outfit on top of your video frames.</p>
                    </div>
                  </div>
                  <button className="btn btn-xs btn-primary-outline" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <Sparkles size={12} />
                    Choose Outfit
                  </button>
                </div>
              ) : (
                <div 
                  className="glass-panel p-15 mt-15 flex justify-between align-center" 
                  style={{ 
                    border: '1px solid rgba(16, 185, 129, 0.3)', 
                    background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.04) 0%, rgba(20, 20, 25, 0.3) 100%)' 
                  }}
                >
                  <div className="flex align-center gap-15">
                    <div className="p-10 rounded-full" style={{ background: 'rgba(16, 185, 129, 0.1)' }}>
                      <Shirt className="text-success" size={20} />
                    </div>
                    <div>
                      <h5 className="font-semibold text-sm m-0" style={{ color: 'var(--color-success)' }}>AI Outfit Fitting Active</h5>
                      <p className="text-xs text-muted m-0">Dressing frames in: <strong className="text-white">{outfits.find(o => o.id === selectedOutfitId)?.name}</strong></p>
                    </div>
                  </div>
                  <button 
                    className="btn btn-xs btn-secondary-outline" 
                    style={{ borderColor: 'var(--color-danger)', color: 'var(--color-danger)' }}
                    onClick={() => { 
                      setSelectedOutfitId(''); 
                      // Reset prompt text to remove the proposed wearing text if they cancel it
                      const cleanPrompt = promptText.replace(/,?\s*Wearing\s+[^,]+/gi, '').trim();
                      setPromptText(cleanPrompt);
                    }}
                  >
                    Remove Outfit
                  </button>
                </div>
              )}

              {/* Horizontal Wardrobe Selection Drawer */}
              {showOutfitDrawer && !selectedOutfitId && (
                <div className="glass-panel p-15 mt-10 animated-slide-down flex-column gap-10" style={{ background: 'rgba(255, 255, 255, 0.01)' }}>
                  <div className="flex justify-between align-center">
                    <span className="text-xs font-semibold text-muted">Select reference graphic from your Wardrobe:</span>
                    <button className="btn-text btn-xs text-muted" onClick={() => setShowOutfitDrawer(false)}>Close Drawer</button>
                  </div>
                  {outfits.length === 0 ? (
                    <div className="text-center py-15 text-muted text-xs">
                      No outfits in wardrobe. Go to <strong>Wardrobe Catalogue</strong> to upload clothing references first.
                    </div>
                  ) : (
                    <div className="flex gap-10 overflow-x-auto py-5 scrollbar-thin" style={{ whiteSpace: 'nowrap' }}>
                      {outfits.map(outfit => (
                        <div 
                          key={outfit.id} 
                          className="glass-panel p-5 cursor-pointer hover-scale flex-column align-center text-center select-none"
                          style={{ width: '100px', flexShrink: 0, border: '1px solid var(--border-glass)', background: 'rgba(255, 255, 255, 0.01)' }}
                          onClick={() => {
                            setSelectedOutfitId(outfit.id);
                            setShowOutfitDrawer(false);
                            // Propose suffix: check if it already has the wearing text
                            let basePrompt = promptText.trim();
                            basePrompt = basePrompt.replace(/,?\s*Wearing\s+[^,]+/gi, '');
                            if (basePrompt) {
                              setPromptText(`${basePrompt}, Wearing ${outfit.name}`);
                            } else {
                              setPromptText(`Wearing ${outfit.name}`);
                            }
                          }}
                        >
                          <img 
                            src={`/outfits/${outfit.fileName}`} 
                            alt={outfit.name} 
                            style={{ width: '80px', height: '80px', objectFit: 'contain', background: '#0a0a0c', borderRadius: 'var(--radius-sm)' }}
                          />
                          <span className="text-xxs font-semibold truncate display-block mt-5 width-100" style={{ fontSize: '10px' }}>{outfit.name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Advanced Sampler Consistency Controls */}
              <div className="mt-10 pt-10" style={{ borderTop: '1px solid var(--border-glass)' }}>
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="btn-text text-primary flex align-center gap-5 text-xs font-semibold"
                  style={{ textDecoration: 'none', cursor: 'pointer', padding: 0 }}
                >
                  {showAdvanced ? '▼ Hide Consistency Controls (Deflicker)' : '▶ Show Consistency Controls (Deflicker / Seed / LoRA)'}
                </button>

                {showAdvanced && (
                  <div className="flex gap-15 mt-10 p-10 glass-panel animated-slide-down" style={{ background: 'rgba(255, 255, 255, 0.01)', flexWrap: 'wrap' }}>
                    <div className="form-group mb-5" style={{ width: '160px' }}>
                      <label className="text-muted text-xs font-semibold" style={{ display: 'block', marginBottom: '4px' }}>Seed Mode (Node 31):</label>
                      <select
                        value={seedMode}
                        onChange={(e) => setSeedMode(e.target.value)}
                        className="speed-select-box width-100"
                        style={{ height: '32px', padding: '0 8px' }}
                      >
                        <option value="fixed">Fixed Seed (Default)</option>
                        <option value="random">Randomize Seed</option>
                      </select>
                    </div>

                    {seedMode === 'fixed' && (
                      <div className="form-group mb-5 flex-grow" style={{ minWidth: '150px' }}>
                        <label className="text-muted text-xs font-semibold" style={{ display: 'block', marginBottom: '4px' }}>Fixed Seed Value:</label>
                        <input
                          type="text"
                          value={noiseSeed}
                          onChange={(e) => setNoiseSeed(e.target.value.replace(/\D/g, ''))}
                          className="glass-input width-100"
                          style={{ height: '32px', fontSize: '12px', padding: '0 10px' }}
                        />
                      </div>
                    )}

                    <div className="form-group mb-5" style={{ width: '220px', flexShrink: 0 }}>
                      <label className="text-muted text-xs font-semibold flex justify-between" style={{ display: 'flex', marginBottom: '4px' }}>
                        <span>LoRA Strength (Node 264):</span>
                        <span className="text-primary font-semibold">{loraStrength}</span>
                      </label>
                      <div className="flex align-center gap-10" style={{ height: '32px' }}>
                        <input
                          type="range"
                          min="0"
                          max="1.5"
                          step="0.1"
                          value={loraStrength}
                          onChange={(e) => setLoraStrength(parseFloat(e.target.value))}
                          style={{ flexGrow: 1, accentColor: 'var(--primary)' }}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex justify-between align-center width-100 mt-15 flex-wrap gap-15">
                <div>
                  <p className="text-muted">Extracted frames are ready. Configure VRAM settings and queue ComfyUI.</p>
                </div>
                <div className="flex align-center gap-15">
                  <div className="speed-controller flex align-center gap-5">
                    <label className="text-muted">Batch Size:</label>
                    <select
                      value={comfyBatchSize}
                      onChange={(e) => setComfyBatchSize(parseInt(e.target.value, 10))}
                      className="speed-select-box"
                    >
                      <option value="1">1 Frame (Safe / Low VRAM)</option>
                      <option value="4">4 Frames (Medium VRAM)</option>
                      <option value="8">8 Frames (High VRAM)</option>
                      <option value="0">All at Once (High Risk)</option>
                    </select>
                  </div>
                  <div className="flex gap-10">
                    <button onClick={startPolling} className="btn btn-secondary" title="Watch folder changes if running ComfyUI manually">
                      <Eye size={16} />
                      Watch Directory
                    </button>
                    <button onClick={handleTriggerComfy} disabled={comfyLoading} className="btn btn-primary">
                      <Zap size={16} />
                      {comfyLoading ? 'Queuing ComfyUI...' : 'Send to ComfyUI (Auto)'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case 'processing':
        return (
          <div className="status-flow-card active animated-slide-down">
            <div className="card-icon spin"><RefreshCw size={28} /></div>
            <div className="card-info width-100">
              <div className="flex justify-between align-center">
                <h4>ComfyUI AI Processing Active</h4>
                <span className="badge badge-primary">{percent}% Complete</span>
              </div>
              <p>Watching outputs. Transferring processed frames back to workspace project folder ({editedCount} / {extractedCount} frames).</p>
              <div className="progress-bar-container mt-15">
                <div className="progress-bar" style={{ width: `${percent}%` }}></div>
              </div>
              <div className="flex justify-between align-center mt-15">
                <small className="text-muted">Job ID: {project.comfyJobId || 'Active watcher'}</small>
                <div className="flex align-center gap-10">
                  <button onClick={handlePauseComfy} className="btn btn-danger btn-xs">
                    Pause Treatment
                  </button>
                  <small className="text-muted">Remaining: {Math.round((extractedCount - editedCount) * 1.5)}s</small>
                </div>
              </div>
            </div>
          </div>
        );

      case 'processed':
        return (
          <div className="status-flow-card success animated-slide-down">
            <div className="card-icon"><Layers size={28} /></div>
            <div className="card-info flex justify-between align-center flex-wrap gap-15 width-100">
              <div>
                <h4>AI Frame Treatment Completed</h4>
                <p>All <strong>{editedCount} frames</strong> have been edited by ComfyUI. Review the frames list below, delete any bad frame errors, and compile the final output.</p>
              </div>
              <div className="flex align-center gap-15">
                <label className="loop-check flex align-center gap-5 select-none cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeAudio}
                    onChange={(e) => setIncludeAudio(e.target.checked)}
                  />
                  <span>Include Original Audio</span>
                </label>
                <button onClick={handleCompile} className="btn btn-success">
                  <Film size={16} />
                  Compile Final Video
                </button>
              </div>
            </div>
          </div>
        );

      case 'compiling':
        return (
          <div className="status-flow-card active animated-slide-down">
            <div className="card-icon spin"><RefreshCw size={28} /></div>
            <div className="card-info">
              <h4>Compiling Video File...</h4>
              <p>FFmpeg is weaving frames back to video at {fps} FPS and blending the original audio sequence. Please wait.</p>
              <div className="progress-bar-container mt-15">
                <div className="progress-bar infinite-loading"></div>
              </div>
            </div>
          </div>
        );

      case 'completed':
        return (
          <div className="status-flow-card completed animated-slide-down">
            <div className="card-icon"><CheckCircle size={28} /></div>
            <div className="card-info flex justify-between align-center flex-wrap gap-15 width-100">
              <div>
                <h4>Final Video Generated Successfully!</h4>
                <p>Video compiled cleanly with original audio sync. The file is ready in the player view.</p>
              </div>
              <div className="flex align-center gap-15">
                <label className="loop-check flex align-center gap-5 select-none cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeAudio}
                    onChange={(e) => setIncludeAudio(e.target.checked)}
                  />
                  <span>Include Original Audio</span>
                </label>
                <div className="flex gap-10">
                  <button onClick={() => setActiveTab('preview')} className="btn btn-primary">
                    <Play size={16} />
                    Open Video Player
                  </button>
                  <button onClick={handleCompile} className="btn btn-secondary">
                    Re-Compile Video
                  </button>
                </div>
              </div>
            </div>
          </div>
        );

      case 'error':
        return (
          <div className="status-flow-card error animated-slide-down">
            <div className="card-icon"><AlertCircle size={28} /></div>
            <div className="card-info">
              <h4>Process Stopped with Error</h4>
              <p className="text-danger">{project.error || 'Unknown execution failure'}</p>
              <div className="flex gap-10 mt-15">
                <button onClick={handleExtract} className="btn btn-primary btn-sm">Retry Extraction</button>
                <button onClick={handleCompile} className="btn btn-success btn-sm">Retry Compile</button>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="project-detail-view flex-column">
      <div className="detail-header flex justify-between align-center">
        <div>
          <span className="breadcrumb">Projects / {project.name}</span>
          <h1>{project.name}</h1>
        </div>

        <div className="tabs flex gap-5">
          <button
            onClick={() => setActiveTab('frames')}
            className={`tab-btn ${activeTab === 'frames' ? 'active' : ''}`}
            disabled={project.status === 'waiting_upload'}
          >
            Frames Manager
          </button>
          <button
            onClick={() => setActiveTab('preview')}
            className={`tab-btn ${activeTab === 'preview' ? 'active' : ''}`}
            disabled={project.status === 'waiting_upload'}
          >
            Video Player
          </button>
        </div>
      </div>

      {renderWorkflowStatus()}

      <div className="detail-content flex-grow">
        {activeTab === 'frames' && project.status !== 'waiting_upload' && (
          <FrameEditor project={project} onUpdateProject={onUpdateProject} />
        )}
        {activeTab === 'preview' && project.status !== 'waiting_upload' && (
          <VideoPlayer project={project} />
        )}
      </div>
    </div>
  );
}
