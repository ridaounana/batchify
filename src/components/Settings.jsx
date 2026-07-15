import React, { useState, useEffect } from 'react';
import { Save, Settings as SettingsIcon, AlertCircle, Check } from 'lucide-react';

export default function Settings({ onClose }) {
  const [comfyUrl, setComfyUrl] = useState('');
  const [comfyOutputDir, setComfyOutputDir] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        setComfyUrl(data.comfyUrl);
        setComfyOutputDir(data.comfyOutputDir);
      })
      .catch(err => {
        setError('Failed to load settings');
        console.error(err);
      });
  }, []);

  const handleSave = (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(false);

    fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ comfyUrl, comfyOutputDir })
    })
      .then(res => {
        if (!res.ok) throw new Error('Failed to save settings');
        return res.json();
      })
      .then(() => {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      })
      .catch(err => {
        setError(err.message);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  return (
    <div className="glass-panel settings-panel animated-fade-in">
      <div className="panel-header">
        <div className="flex align-center gap-10">
          <SettingsIcon size={20} className="text-primary" />
          <h2>System Configuration</h2>
        </div>
      </div>

      <form onSubmit={handleSave} className="settings-form">
        <div className="form-group">
          <label>ComfyUI WebSocket/API URL</label>
          <input
            type="text"
            value={comfyUrl}
            onChange={(e) => setComfyUrl(e.target.value)}
            placeholder="http://127.0.0.1:8188"
            required
            className="glass-input"
          />
          <small>Address where ComfyUI is running locally</small>
        </div>

        <div className="form-group">
          <label>ComfyUI Output Directory</label>
          <input
            type="text"
            value={comfyOutputDir}
            onChange={(e) => setComfyOutputDir(e.target.value)}
            placeholder="C:\Users\ovh\Documents\AI\ComfyUI-Easy-Install\ComfyUI-Easy-Install\ComfyUI\output"
            required
            className="glass-input"
          />
          <small>Absolute path to ComfyUI's outputs folder. Used to scan and fetch newly processed frames.</small>
        </div>

        <div className="form-group">
          <label>Workflow API File Location</label>
          <input
            type="text"
            value="C:\Users\ovh\Documents\AI\batchify\Batchify.json"
            disabled
            className="glass-input text-muted"
          />
          <small>Workflow file loaded automatically on queuing</small>
        </div>

        {error && (
          <div className="alert alert-error">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="alert alert-success">
            <Check size={16} />
            <span>Settings saved successfully!</span>
          </div>
        )}

        <div className="flex justify-end gap-10 mt-20">
          {onClose && (
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Close
            </button>
          )}
          <button type="submit" disabled={loading} className="btn btn-primary">
            <Save size={16} />
            {loading ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
      </form>
    </div>
  );
}
