import React, { useState, useEffect } from 'react';
import { Upload, Trash2, Scissors, RotateCcw, Shirt, CheckCircle } from 'lucide-react';

export default function OutfitCatalogue() {
  const [outfits, setOutfits] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploadName, setUploadName] = useState('');
  const [uploadFile, setUploadFile] = useState(null);
  const [processingId, setProcessingId] = useState(null);
  const [dragActive, setDragActive] = useState(false);

  useEffect(() => {
    fetchOutfits();
  }, []);

  const fetchOutfits = () => {
    setLoading(true);
    fetch('/api/outfits')
      .then(res => res.json())
      .then(data => {
        setOutfits(data || []);
      })
      .catch(err => console.error('Error fetching outfits:', err))
      .finally(() => setLoading(false));
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('image/')) {
        setUploadFile(file);
        if (!uploadName) {
          // Pre-populate name with file name without extension
          const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
          setUploadName(baseName.replace(/[_-]/g, ' '));
        }
      } else {
        alert('Please upload an image file (PNG/JPG).');
      }
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setUploadFile(file);
      if (!uploadName) {
        const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
        setUploadName(baseName.replace(/[_-]/g, ' '));
      }
    }
  };

  const handleAddOutfit = (e) => {
    e.preventDefault();
    if (!uploadFile) return;

    const formData = new FormData();
    formData.append('outfit', uploadFile);
    formData.append('name', uploadName || 'Unnamed Outfit');

    setLoading(true);
    fetch('/api/outfits', {
      method: 'POST',
      body: formData
    })
      .then(res => {
        if (!res.ok) throw new Error('Upload failed');
        return res.json();
      })
      .then(newOutfit => {
        setOutfits(prev => [...prev, newOutfit]);
        setUploadName('');
        setUploadFile(null);
      })
      .catch(err => alert(err.message))
      .finally(() => setLoading(false));
  };

  const handleDeleteOutfit = (id) => {
    if (!confirm('Are you sure you want to delete this outfit?')) return;

    fetch(`/api/outfits/${id}`, {
      method: 'DELETE'
    })
      .then(res => {
        if (!res.ok) throw new Error('Deletion failed');
        setOutfits(prev => prev.filter(o => o.id !== id));
      })
      .catch(err => alert(err.message));
  };

  const handleRemoveBackground = (id) => {
    setProcessingId(id);
    fetch(`/api/outfits/${id}/remove-bg`, {
      method: 'POST'
    })
      .then(res => {
        if (!res.ok) throw new Error('Background removal failed');
        return res.json();
      })
      .then(() => {
        // Force refresh the image URL in state by adding a timestamp
        setOutfits(prev => prev.map(o => {
          if (o.id === id) {
            return { ...o, cacheBuster: Date.now() };
          }
          return o;
        }));
      })
      .catch(err => alert(err.message))
      .finally(() => setProcessingId(null));
  };

  return (
    <div className="outfits-container animated-fade-in flex-column gap-20 p-20 height-100 overflow-y-auto">
      <div className="section-header flex justify-between align-center">
        <div>
          <h2>👕 Outfits Catalogue</h2>
          <p className="text-muted">Manage clothing reference graphics. Upload transparent PNGs or use the AI Background Remover tool.</p>
        </div>
      </div>

      <div className="flex gap-20 align-start flex-wrap">
        {/* Upload Form Card */}
        <div className="glass-panel p-20 flex-column gap-15" style={{ width: '380px', flexShrink: 0 }}>
          <h4>Add New Outfit Reference</h4>
          <form onSubmit={handleAddOutfit} className="flex-column gap-15">
            <div className="form-group">
              <label className="text-muted font-semibold text-xs mb-5 display-block">Outfit Name:</label>
              <input
                type="text"
                placeholder="e.g. Red Leather Jacket"
                value={uploadName}
                onChange={(e) => setUploadName(e.target.value)}
                className="glass-input width-100"
                required
              />
            </div>

            <div 
              className={`dropzone border-dashed p-20 flex-column align-center justify-center cursor-pointer ${dragActive ? 'drag-active' : ''}`}
              style={{
                border: '2px dashed var(--border-glass)',
                borderRadius: 'var(--radius-md)',
                background: dragActive ? 'rgba(99, 102, 241, 0.05)' : 'rgba(255, 255, 255, 0.01)',
                minHeight: '150px'
              }}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => document.getElementById('outfit-file-input').click()}
            >
              <input 
                id="outfit-file-input"
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
              {uploadFile ? (
                <div className="flex-column align-center text-center">
                  <CheckCircle size={32} className="text-success mb-10" />
                  <span className="text-sm font-semibold">{uploadFile.name}</span>
                  <span className="text-muted text-xs">{(uploadFile.size / (1024 * 1024)).toFixed(2)} MB</span>
                </div>
              ) : (
                <div className="flex-column align-center text-center">
                  <Upload size={32} className="text-muted mb-10" />
                  <span className="text-sm font-semibold">Drag & Drop Image here</span>
                  <span className="text-muted text-xs">or click to browse local files</span>
                </div>
              )}
            </div>

            <button 
              type="submit" 
              className="btn btn-primary width-100 mt-5"
              disabled={!uploadFile || loading}
            >
              <Shirt size={16} />
              {loading ? 'Adding to Catalogue...' : 'Add to Catalogue'}
            </button>
          </form>
        </div>

        {/* Outfits Catalogue Grid */}
        <div className="glass-panel p-20 flex-grow" style={{ minWidth: '400px' }}>
          <h4>Catalogues ({outfits.length})</h4>
          {outfits.length === 0 ? (
            <div className="flex-column align-center justify-center py-50 text-muted">
              <Shirt size={48} className="text-muted mb-15" />
              <p>No outfits added yet. Use the upload panel to populate your reference wardrobe.</p>
            </div>
          ) : (
            <div className="grid mt-15" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '15px' }}>
              {outfits.map(outfit => {
                const isProcessing = processingId === outfit.id;
                const thumbUrl = `/outfits/${outfit.fileName}?t=${outfit.cacheBuster || outfit.createdAt}`;

                return (
                  <div 
                    key={outfit.id} 
                    className="glass-panel overflow-hidden flex-column"
                    style={{ background: 'rgba(255, 255, 255, 0.01)', border: '1px solid var(--border-glass)' }}
                  >
                    {/* Thumbnail View */}
                    <div 
                      className="flex align-center justify-center" 
                      style={{ 
                        aspectRatio: '1/1', 
                        background: '#0a0a0c', 
                        position: 'relative',
                        backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.1) 1px, transparent 0)',
                        backgroundSize: '16px 16px' 
                      }}
                    >
                      <img 
                        src={thumbUrl} 
                        alt={outfit.name} 
                        style={{ maxWidth: '90%', maxHeight: '90%', objectFit: 'contain' }}
                        loading="lazy"
                      />
                      {isProcessing && (
                        <div 
                          className="absolute flex-column align-center justify-center"
                          style={{
                            top: 0, left: 0, right: 0, bottom: 0,
                            background: 'rgba(0, 0, 0, 0.75)',
                            zIndex: 10
                          }}
                        >
                          <RotateCcw size={24} className="spin text-primary" />
                          <span className="text-xs text-muted mt-5">Removing BG...</span>
                        </div>
                      )}
                    </div>

                    {/* Meta info */}
                    <div className="p-10 flex-column gap-5 flex-grow">
                      <span className="font-semibold text-sm truncate" title={outfit.name}>{outfit.name}</span>
                      <span className="text-muted text-xxs">Created: {new Date(outfit.createdAt).toLocaleDateString()}</span>
                    </div>

                    {/* Actions */}
                    <div 
                      className="p-5 flex justify-between align-center border-glass-top" 
                      style={{ background: 'rgba(255, 255, 255, 0.01)' }}
                    >
                      <button
                        onClick={() => handleRemoveBackground(outfit.id)}
                        disabled={isProcessing}
                        className="btn-text text-primary flex align-center gap-5 btn-xs"
                        title="Remove background from PNG using rembg AI"
                      >
                        <Scissors size={12} />
                        Remove BG
                      </button>
                      
                      <button
                        onClick={() => handleDeleteOutfit(outfit.id)}
                        disabled={isProcessing}
                        className="btn-text text-danger flex align-center gap-5 btn-xs"
                      >
                        <Trash2 size={12} />
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
