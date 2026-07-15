import React, { useState, useEffect } from 'react';
import { Trash2, RotateCcw, AlertTriangle, Eye, Image as ImageIcon, ChevronLeft, ChevronRight, X } from 'lucide-react';

export default function FrameEditor({ project, onUpdateProject }) {
  const [frames, setFrames] = useState([]);
  const [omittedFrames, setOmittedFrames] = useState([]);
  const [selectedFrame, setSelectedFrame] = useState(null);
  const [sliderPos, setSliderPos] = useState(50);
  const [loading, setLoading] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(24);
  const [selectedFrameIndices, setSelectedFrameIndices] = useState([]);

  useEffect(() => {
    setCurrentPage(1);
    setSelectedFrameIndices([]);
    fetchFrames();
  }, [project.id, project.editedCount, project.extractedCount]);

  const fetchFrames = () => {
    setLoading(true);
    fetch(`/api/projects/${project.id}/frames`)
      .then(res => res.json())
      .then(data => {
        setFrames(data.frames || []);
        setOmittedFrames(data.omittedFrames || []);
      })
      .catch(err => {
        console.error('Error fetching frames:', err);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  const handleOmitFrame = (index, e) => {
    if (e) e.stopPropagation();
    fetch(`/api/projects/${project.id}/frames/${index}`, {
      method: 'DELETE'
    })
      .then(res => res.json())
      .then(data => {
        setOmittedFrames(data.omittedFrames);
        setFrames(prev => prev.map(f => f.index === index ? { ...f, omitted: true } : f));
        onUpdateProject({ ...project, omittedFrames: data.omittedFrames });
      })
      .catch(err => console.error(err));
  };

  const handleRestoreFrame = (index, e) => {
    if (e) e.stopPropagation();
    fetch(`/api/projects/${project.id}/frames/${index}/restore`, {
      method: 'POST'
    })
      .then(res => res.json())
      .then(data => {
        setOmittedFrames(data.omittedFrames);
        setFrames(prev => prev.map(f => f.index === index ? { ...f, omitted: false } : f));
        onUpdateProject({ ...project, omittedFrames: data.omittedFrames });
      })
      .catch(err => console.error(err));
  };

  const handleToggleSelect = (index) => {
    setSelectedFrameIndices(prev => {
      if (prev.includes(index)) {
        return prev.filter(idx => idx !== index);
      } else {
        return [...prev, index];
      }
    });
  };

  const handleBulkOmit = () => {
    if (selectedFrameIndices.length === 0) return;
    setLoading(true);
    Promise.all(
      selectedFrameIndices.map(index =>
        fetch(`/api/projects/${project.id}/frames/${index}`, { method: 'DELETE' }).then(res => res.json())
      )
    )
      .then(results => {
        const lastResult = results[results.length - 1];
        setOmittedFrames(lastResult.omittedFrames);
        setFrames(prev => prev.map(f => selectedFrameIndices.includes(f.index) ? { ...f, omitted: true } : f));
        onUpdateProject({ ...project, omittedFrames: lastResult.omittedFrames });
        setSelectedFrameIndices([]);
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  };

  const handleBulkRestore = () => {
    if (selectedFrameIndices.length === 0) return;
    setLoading(true);
    Promise.all(
      selectedFrameIndices.map(index =>
        fetch(`/api/projects/${project.id}/frames/${index}/restore`, { method: 'POST' }).then(res => res.json())
      )
    )
      .then(results => {
        const lastResult = results[results.length - 1];
        setOmittedFrames(lastResult.omittedFrames);
        setFrames(prev => prev.map(f => selectedFrameIndices.includes(f.index) ? { ...f, omitted: false } : f));
        onUpdateProject({ ...project, omittedFrames: lastResult.omittedFrames });
        setSelectedFrameIndices([]);
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  };

  const handlePrevFrame = () => {
    const currIdx = frames.findIndex(f => f.index === selectedFrame.index);
    if (currIdx > 0) {
      setSelectedFrame(frames[currIdx - 1]);
    }
  };

  const handleNextFrame = () => {
    const currIdx = frames.findIndex(f => f.index === selectedFrame.index);
    if (currIdx < frames.length - 1) {
      setSelectedFrame(frames[currIdx + 1]);
    }
  };

  const getOriginalUrl = (filename) => `/api/projects/${project.id}/frames/original/${filename}`;
  const getEditedUrl = (filename) => `/api/projects/${project.id}/frames/edited/${filename}`;

  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedFrames = frames.slice(startIndex, endIndex);
  const maxPages = Math.ceil(frames.length / pageSize);

  return (
    <div className="frame-editor-container flex-column height-100">
      <div className="section-header flex justify-between align-center mb-15">
        <div>
          <h3>Frames Timeline</h3>
          <p className="text-muted">Review, compare, and delete bad frames from AI outputs.</p>
        </div>
        <div className="flex gap-10">
          <span className="info-badge">Extracted: {project.extractedCount}</span>
          <span className="info-badge success">Processed: {project.editedCount}</span>
          <span className="info-badge warning">Omitted: {omittedFrames.length}</span>
        </div>
      </div>

      {selectedFrameIndices.length > 0 && (
        <div className="bulk-actions-toolbar flex justify-between align-center p-10 mb-15 glass-panel animated-slide-down" style={{ background: 'rgba(99, 102, 241, 0.05)', borderColor: 'var(--primary)' }}>
          <div className="flex align-center gap-10">
            <span className="text-muted font-semibold text-xs" style={{ color: 'var(--text-main)' }}>
              Selected {selectedFrameIndices.length} frames
            </span>
            <button
              onClick={() => {
                const pageIndices = paginatedFrames.map(f => f.index);
                const allSelected = pageIndices.every(idx => selectedFrameIndices.includes(idx));
                if (allSelected) {
                  setSelectedFrameIndices(prev => prev.filter(idx => !pageIndices.includes(idx)));
                } else {
                  setSelectedFrameIndices(prev => {
                    const next = [...prev];
                    pageIndices.forEach(idx => {
                      if (!next.includes(idx)) next.push(idx);
                    });
                    return next;
                  });
                }
              }}
              className="btn btn-secondary btn-xs"
            >
              Select All Page
            </button>
            <button onClick={() => setSelectedFrameIndices([])} className="btn btn-secondary btn-xs">
              Clear Selection
            </button>
          </div>
          <div className="flex gap-10">
            <button onClick={handleBulkOmit} className="btn btn-danger btn-xs" style={{ background: 'var(--danger)' }}>
              Omit Selected
            </button>
            <button onClick={handleBulkRestore} className="btn btn-success btn-xs" style={{ background: 'var(--success)' }}>
              Restore Selected
            </button>
          </div>
        </div>
      )}

      {loading && frames.length === 0 ? (
        <div className="flex justify-center align-center flex-grow py-50">
          <div className="spin-container">
            <RotateCcw size={32} className="spin text-primary" />
            <p className="mt-10 text-muted">Loading frame history...</p>
          </div>
        </div>
      ) : frames.length === 0 ? (
        <div className="empty-frames-state flex-grow flex-column align-center justify-center py-50">
          <ImageIcon size={48} className="text-muted mb-15" />
          <p className="text-muted">No frames extracted yet. Complete the extraction step above.</p>
        </div>
      ) : (
        <div className="frames-grid-wrapper flex-grow">
          <div className="frames-grid">
            {paginatedFrames.map((frame) => {
              const hasEdited = !!frame.edited;
              const isOmitted = omittedFrames.includes(frame.index);
              const isSelected = selectedFrameIndices.includes(frame.index);

              return (
                <div
                  key={frame.index}
                  className={`frame-card-item ${isOmitted ? 'omitted' : ''} ${hasEdited ? 'has-edited' : ''} ${isSelected ? 'selected' : ''}`}
                  onClick={() => handleToggleSelect(frame.index)}
                >
                  <div className="frame-thumb-container">
                    <img
                      src={hasEdited ? getEditedUrl(frame.edited) : getOriginalUrl(frame.original)}
                      alt={`Frame ${frame.index}`}
                      loading="lazy"
                      className="frame-thumb-img"
                    />
                    <div className="frame-badge flex align-center gap-5">
                      <span className="frame-num">#{String(frame.index).padStart(4, '0')}</span>
                      {hasEdited && <span className="ai-tag">AI</span>}
                    </div>

                    <div className="frame-select-indicator" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSelect(frame.index)}
                      />
                    </div>

                    {isOmitted && (
                      <div className="omitted-overlay flex align-center justify-center">
                        <AlertTriangle size={20} className="text-warning" />
                        <span>OMITTED</span>
                      </div>
                    )}
                  </div>

                  <div className="frame-card-actions flex justify-between align-center p-8">
                    <button
                      className="btn-text flex align-center gap-5 btn-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedFrame(frame);
                      }}
                    >
                      <Eye size={12} />
                      Compare
                    </button>

                    {isOmitted ? (
                      <button
                        className="btn-text text-success flex align-center gap-5 btn-xs"
                        onClick={(e) => handleRestoreFrame(frame.index, e)}
                      >
                        <RotateCcw size={12} />
                        Restore
                      </button>
                    ) : (
                      <button
                        className="btn-text text-danger flex align-center gap-5 btn-xs"
                        onClick={(e) => handleOmitFrame(frame.index, e)}
                      >
                        <Trash2 size={12} />
                        Omit
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination Controls */}
          {frames.length > pageSize && (
            <div className="pagination-footer flex justify-between align-center mt-15 pt-10" style={{ borderTop: '1px solid var(--border-glass)' }}>
              <div className="text-muted" style={{ fontSize: '12px' }}>
                Showing {startIndex + 1} - {Math.min(endIndex, frames.length)} of {frames.length} frames
              </div>

              <div className="flex align-center gap-10">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="btn btn-secondary btn-xs"
                >
                  <ChevronLeft size={12} />
                  Prev
                </button>
                <span className="text-muted" style={{ fontSize: '12px' }}>
                  Page {currentPage} of {maxPages}
                </span>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, maxPages))}
                  disabled={currentPage === maxPages}
                  className="btn btn-secondary btn-xs"
                >
                  Next
                  <ChevronRight size={12} />
                </button>
              </div>

              <div className="flex align-center gap-5 text-muted" style={{ fontSize: '12px' }}>
                <span>Frames per page:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(parseInt(e.target.value, 10));
                    setCurrentPage(1);
                  }}
                  className="speed-select-box"
                  style={{ padding: '2px 5px', fontSize: '11px' }}
                >
                  <option value="12">12</option>
                  <option value="24">24</option>
                  <option value="48">48</option>
                  <option value="96">96</option>
                  <option value="200">200</option>
                </select>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modern Comparison Modal */}
      {selectedFrame && (
        <div className="modal-overlay compare-modal animated-fade-in" onClick={() => setSelectedFrame(null)}>
          <div className="glass-modal compare-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="compare-modal-header flex justify-between align-center">
              <div>
                <h3>Frame #{String(selectedFrame.index).padStart(4, '0')} Comparison</h3>
                <p className="text-muted">Drag the slider to compare original frames with AI-edited frames.</p>
              </div>
              <button className="btn-icon text-muted" onClick={() => setSelectedFrame(null)}>
                <X size={20} />
              </button>
            </div>

            <div className="compare-workspace flex justify-between align-center gap-20">
              <button
                className="btn-icon arrow-nav"
                onClick={handlePrevFrame}
                disabled={frames.findIndex(f => f.index === selectedFrame.index) === 0}
              >
                <ChevronLeft size={24} />
              </button>

              <div className="comparison-slider-container">
                <div className="image-compare-viewport">
                  {/* Background: Original Frame */}
                  <img
                    src={getOriginalUrl(selectedFrame.original)}
                    alt="Original Frame"
                    className="compare-base"
                    draggable={false}
                  />

                  {/* Foreground: Edited Frame (with clip-path based on slider position) */}
                  {selectedFrame.edited ? (
                    <div
                      className="compare-overlay-layer"
                      style={{ clipPath: `polygon(0 0, ${sliderPos}% 0, ${sliderPos}% 100%, 0 100%)` }}
                    >
                      <img
                        src={getEditedUrl(selectedFrame.edited)}
                        alt="Edited Frame"
                        className="compare-overlay-img"
                        draggable={false}
                      />
                    </div>
                  ) : (
                    <div className="no-edited-overlay flex-column justify-center align-center">
                      <ImageIcon size={36} className="text-muted" />
                      <p>AI treatment not yet completed for this frame</p>
                    </div>
                  )}

                  {/* Labels */}
                  <div className="compare-label label-original">Original</div>
                  {selectedFrame.edited && <div className="compare-label label-edited">AI Edited</div>}
                </div>

                {selectedFrame.edited && (
                  <div className="slider-control-wrapper">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={sliderPos}
                      onChange={(e) => setSliderPos(parseInt(e.target.value, 10))}
                      className="slider-range-input"
                    />
                  </div>
                )}
              </div>

              <button
                className="btn-icon arrow-nav"
                onClick={handleNextFrame}
                disabled={frames.findIndex(f => f.index === selectedFrame.index) === frames.length - 1}
              >
                <ChevronRight size={24} />
              </button>
            </div>

            <div className="compare-modal-footer flex justify-between align-center">
              <span className="text-muted">
                Status:{' '}
                {selectedFrame.edited ? (
                  <span className="text-success font-semibold">Processed</span>
                ) : (
                  <span className="text-warning font-semibold">Pending</span>
                )}
                {omittedFrames.includes(selectedFrame.index) && (
                  <span className="text-danger font-semibold ml-10">Omitted</span>
                )}
              </span>

              <div className="flex gap-10">
                {omittedFrames.includes(selectedFrame.index) ? (
                  <button
                    className="btn btn-success btn-sm"
                    onClick={() => handleRestoreFrame(selectedFrame.index)}
                  >
                    <RotateCcw size={14} />
                    Restore Frame
                  </button>
                ) : (
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => handleOmitFrame(selectedFrame.index)}
                  >
                    <Trash2 size={14} />
                    Omit Bad Frame
                  </button>
                )}
                <button className="btn btn-secondary btn-sm" onClick={() => setSelectedFrame(null)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
