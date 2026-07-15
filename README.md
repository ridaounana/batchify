# Batchify ⚡

**Batchify** is a professional video frame-by-frame processing management hub designed for workflows involving ComfyUI, Stable Diffusion, and ffmpeg. It automates video frame extraction, folder structures, ComfyUI execution queueing via API, progress monitoring, manual frame reviews/exclusions, and final video assembly with original audio synchronization.

---

## Key Features

1. **Structured Workspace Management**: Auto-creates projects containing individual directories for inputs, original extracted frames, AI-edited outputs, and final renders.
2. **Secure Fast Frame Extraction**: Uses low-level `ffmpeg` spawning with explicit arguments to quickly extract video frames at target framerates (e.g., 16 FPS).
3. **Automated ComfyUI API Injection**: Loads your workflow (`Batchify.json`), automatically overrides the directory loader (`AILab_LoadImageBatch` node `394`) to point to the project frames, updates the save path (`SaveImage` node `32`) to the project workspace, and queues execution automatically.
4. **Real-time Folder Watcher**: Automatically polls and watches output directories to track ComfyUI progress frame-by-frame.
5. **Interactive Timeline & Exclusions**: View thumbnails of original vs. edited frames. Omit "bad frames" (AI generation glitches) from compilation. 
6. **Smart Audio-Synced Concat**: When compiling frames, deleted frames are seamlessly filled by duplicating the preceding frame. This ensures the timeline remains intact and original audio tracks remain in perfect synchronization.
7. **Custom Sync Comparative Video Player**: Play the original vs. AI-processed videos side-by-side in lockstep sync, with playback speed controls (0.25x - 4x) and looping.

---

## Setup & Running

### Prerequisites
Make sure you have **Node.js** (v18+) and **FFmpeg** installed and added to your system's PATH.

### 1. Install Dependencies
Run in your command line:
```bash
npm install
```

### 2. Start Application (Production Mode)
First, compile the frontend assets, then start the Express server:
```bash
npm run build
npm start
```
The application will start, serving the UI at:
**[http://localhost:3000](http://localhost:3000)**

### 3. Development Mode
To run with live reloading and HMR:
```bash
# In one terminal start the backend server
node server.js

# In another terminal start Vite dev server
npm run dev
```
Open the dev server url: `http://localhost:5173`.

---

## Configuration Settings
Once loaded, click **"Configure Server"** in the header to set up:
- **ComfyUI API URL**: The URL where your local ComfyUI server is hosting (default: `http://127.0.0.1:8188`).
- **ComfyUI Output Directory**: The absolute path to your ComfyUI outputs folder (typically `<comfyui-install-dir>/output`). This allows the backend to find and harvest frames.

---

## Architecture & Security (Pentest Highlights)
- **Injection Mitigation**: The server executes FFmpeg and child processes without invoking raw command shells. By spawning processes via argument lists rather than raw formatted strings, the application remains fully immune to command injection.
- **Path Traversal Shield**: All file-serving and extraction endpoints strictly validate paths. Input IDs and image names are verified using strict regex matching, and target paths must reside within the resolved projects root, preventing traversal read attacks.
