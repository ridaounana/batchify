import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import chokidar from 'chokidar';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Path validation helper (to prevent path traversal attacks)
const PROJECTS_DIR = path.resolve(__dirname, 'projects');
const CONFIG_FILE = path.resolve(__dirname, 'config.json');

// Ensure Projects Directory exists
if (!fs.existsSync(PROJECTS_DIR)) {
  fs.mkdirSync(PROJECTS_DIR, { recursive: true });
}

const OUTFITS_DIR = path.resolve(__dirname, 'outfits');
const OUTFITS_JSON = path.join(OUTFITS_DIR, 'catalogue.json');

// Ensure Outfits Directory exists
if (!fs.existsSync(OUTFITS_DIR)) {
  fs.mkdirSync(OUTFITS_DIR, { recursive: true });
}
if (!fs.existsSync(OUTFITS_JSON)) {
  fs.writeFileSync(OUTFITS_JSON, JSON.stringify([], null, 2), 'utf8');
}

function readCatalogue() {
  try {
    return JSON.parse(fs.readFileSync(OUTFITS_JSON, 'utf8'));
  } catch (e) {
    return [];
  }
}

function writeCatalogue(data) {
  fs.writeFileSync(OUTFITS_JSON, JSON.stringify(data, null, 2), 'utf8');
}

// Default configuration
const DEFAULT_CONFIG = {
  comfyUrl: 'http://127.0.0.1:8188',
  comfyOutputDir: 'C:\\Users\\ovh\\Documents\\AI\\ComfyUI-Easy-Install\\ComfyUI-Easy-Install\\ComfyUI\\output'
};

function readConfig() {
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      return { ...DEFAULT_CONFIG, ...JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')) };
    } catch (e) {
      console.error('Error reading config, using defaults:', e);
    }
  }
  return DEFAULT_CONFIG;
}

function writeConfig(config) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
}

// Validate project path
function validateProjectPath(projectId) {
  if (!projectId || typeof projectId !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(projectId)) {
    throw new Error('Invalid project ID format');
  }
  const projectPath = path.resolve(PROJECTS_DIR, projectId);
  if (!projectPath.startsWith(PROJECTS_DIR)) {
    throw new Error('Path traversal detected');
  }
  return projectPath;
}

// Safe metadata reader with automatic crash/corruption repair
function readProjectInfo(projectId) {
  const projectPath = validateProjectPath(projectId);
  const infoPath = path.join(projectPath, 'info.json');
  
  if (fs.existsSync(infoPath)) {
    try {
      const content = fs.readFileSync(infoPath, 'utf8').trim();
      if (content) {
        const info = JSON.parse(content);
        if (!info.omittedFrames) info.omittedFrames = [];
        return info;
      }
    } catch (e) {
      console.error(`Error parsing info.json for project ${projectId}, initiating repair:`, e);
    }
  }

  // File is missing, empty, or corrupt. Scan workspace to rebuild metadata state.
  const info = {
    id: projectId,
    name: projectId,
    status: 'error',
    error: 'Metadata recovered from workspace',
    createdAt: new Date().toISOString(),
    fps: 16,
    extractedCount: 0,
    editedCount: 0,
    omittedFrames: [],
    comfyJobId: null
  };

  try {
    const extDir = path.join(projectPath, 'extracted_frames');
    const editDir = path.join(projectPath, 'edited_frames');
    
    if (fs.existsSync(extDir)) {
      const extFiles = fs.readdirSync(extDir).filter(f => f.endsWith('.png'));
      info.extractedCount = extFiles.length;
      if (info.extractedCount > 0) info.status = 'extracted';
    }
    
    if (fs.existsSync(editDir)) {
      const editFiles = fs.readdirSync(editDir).filter(f => f.endsWith('.png'));
      info.editedCount = editFiles.length;
      if (info.editedCount >= info.extractedCount && info.extractedCount > 0) {
        info.status = 'processed';
      } else if (info.editedCount > 0) {
        info.status = 'processing';
      }
    }
    
    const inputVideo = path.join(projectPath, 'input_video.mp4');
    if (fs.existsSync(inputVideo) && info.status === 'error') {
      info.status = 'uploaded';
    }
    
    const finalVideo = path.join(projectPath, 'output_final.mp4');
    if (fs.existsSync(finalVideo)) {
      info.status = 'completed';
    }

    fs.writeFileSync(infoPath, JSON.stringify(info, null, 2), 'utf8');
  } catch (err) {
    console.error(`Failed to repair info.json for ${projectId}:`, err);
  }

  return info;
}

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      const projectId = req.params.id || req.query.projectId || req.body.projectId || 'temp';
      const projectPath = validateProjectPath(projectId);
      if (!fs.existsSync(projectPath)) {
        fs.mkdirSync(projectPath, { recursive: true });
      }
      cb(null, projectPath);
    } catch (err) {
      cb(err, '');
    }
  },
  filename: (req, file, cb) => {
    cb(null, 'input_video.mp4');
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB limit
  fileFilter: (req, file, cb) => {
    // Only accept video formats
    if (file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only video files are allowed'));
    }
  }
});

// Multer storage configuration for Outfit catalogue
const outfitStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, OUTFITS_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueId = 'outfit_' + Date.now();
    cb(null, `${uniqueId}.png`);
  }
});

const uploadOutfit = multer({
  storage: outfitStorage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// GET Settings
app.get('/api/settings', (req, res) => {
  res.json(readConfig());
});

// POST Settings
app.post('/api/settings', (req, res) => {
  const { comfyUrl, comfyOutputDir } = req.body;
  if (!comfyUrl || !comfyOutputDir) {
    return res.status(400).json({ error: 'Missing required configuration parameters' });
  }
  const newConfig = { comfyUrl, comfyOutputDir };
  writeConfig(newConfig);
  res.json(newConfig);
});

// GET list of projects
app.get('/api/projects', (req, res) => {
  try {
    const projectDirs = fs.readdirSync(PROJECTS_DIR).filter(file => {
      return fs.statSync(path.join(PROJECTS_DIR, file)).isDirectory();
    });

    const projects = projectDirs.map(id => {
      return readProjectInfo(id);
    });

    res.json(projects);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST Create project
app.post('/api/projects', (req, res) => {
  const id = 'project_' + Date.now();
  const name = req.body.name || id;

  try {
    const projectPath = validateProjectPath(id);
    fs.mkdirSync(projectPath, { recursive: true });
    fs.mkdirSync(path.join(projectPath, 'extracted_frames'), { recursive: true });
    fs.mkdirSync(path.join(projectPath, 'edited_frames'), { recursive: true });

    const info = {
      id,
      name,
      status: 'waiting_upload',
      createdAt: new Date().toISOString(),
      fps: 16,
      extractedCount: 0,
      editedCount: 0,
      omittedFrames: [],
      comfyJobId: null
    };

    fs.writeFileSync(path.join(projectPath, 'info.json'), JSON.stringify(info, null, 2), 'utf8');
    res.json(info);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST Upload video to project
app.post('/api/projects/:id/upload', upload.single('video'), (req, res) => {
  try {
    const { id } = req.params;
    const projectPath = validateProjectPath(id);
    const infoPath = path.join(projectPath, 'info.json');

    if (!fs.existsSync(infoPath)) {
      return res.status(404).json({ error: 'Project metadata not found' });
    }

    const info = readProjectInfo(id);
    info.status = 'uploaded';
    info.originalVideoPath = path.join(projectPath, 'input_video.mp4');

    fs.writeFileSync(infoPath, JSON.stringify(info, null, 2), 'utf8');
    res.json(info);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE Project
app.delete('/api/projects/:id', (req, res) => {
  try {
    const { id } = req.params;
    const projectPath = validateProjectPath(id);

    if (fs.existsSync(projectPath)) {
      fs.rmSync(projectPath, { recursive: true, force: true });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST Extract frames
app.post('/api/projects/:id/extract', async (req, res) => {
  try {
    const { id } = req.params;
    const fps = parseInt(req.body.fps, 10) || 16;
    const projectPath = validateProjectPath(id);
    const infoPath = path.join(projectPath, 'info.json');

    if (!fs.existsSync(infoPath)) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const info = readProjectInfo(id);
    const inputVideo = path.join(projectPath, 'input_video.mp4');

    if (!fs.existsSync(inputVideo)) {
      return res.status(400).json({ error: 'Input video file not found' });
    }

    // Clean previous extracted frames
    const extDir = path.join(projectPath, 'extracted_frames');
    fs.rmSync(extDir, { recursive: true, force: true });
    fs.mkdirSync(extDir, { recursive: true });

    info.status = 'extracting';
    info.fps = fps;
    fs.writeFileSync(infoPath, JSON.stringify(info, null, 2), 'utf8');

    // Run FFmpeg to extract frames securely (arguments in array, no shell execution)
    const ffmpegArgs = [
      '-i', inputVideo,
      '-vf', `fps=${fps}`,
      '-vsync', '0',
      '-q:v', '2', // High quality jpg/png scale
      path.join(extDir, 'frame_%04d.png')
    ];

    const ffmpeg = spawn('ffmpeg', ffmpegArgs);
    let errorLog = '';

    ffmpeg.stderr.on('data', (data) => {
      errorLog += data.toString();
    });

    ffmpeg.on('close', (code) => {
      if (code === 0) {
        // Read how many frames were extracted
        const files = fs.readdirSync(extDir).filter(f => f.startsWith('frame_') && f.endsWith('.png'));
        info.extractedCount = files.length;
        info.status = 'extracted';
        fs.writeFileSync(infoPath, JSON.stringify(info, null, 2), 'utf8');
      } else {
        console.error('FFmpeg extraction failed:', errorLog);
        info.status = 'error';
        info.error = 'Frame extraction failed';
        fs.writeFileSync(infoPath, JSON.stringify(info, null, 2), 'utf8');
      }
    });

    res.json({ success: true, message: 'Extraction started' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Helper: Parse frame index from filename supporting both simple and batch suffix naming
function getFrameNumberFromFilename(filename) {
  // Matches: frame_0005_00002_.png -> prefix 5, batch index 2 -> 5 + 2 - 1 = 6
  const batchMatch = filename.match(/frame_(\d+)_(\d+)_?\./i);
  if (batchMatch) {
    const prefixNum = parseInt(batchMatch[1], 10);
    const batchIndex = parseInt(batchMatch[2], 10);
    return prefixNum + batchIndex - 1;
  }

  const match = filename.match(/frame_(\d+)/i) || filename.match(/(\d+)/);
  if (match) {
    return parseInt(match[1], 10);
  }
  return null;
}

// POST Trigger ComfyUI workflow (with chunked batch queueing)
app.post('/api/projects/:id/trigger-comfy', async (req, res) => {
  try {
    const { id } = req.params;
    const batchSize = parseInt(req.body.batchSize, 10) !== undefined ? parseInt(req.body.batchSize, 10) : 1;
    const promptText = req.body.promptText || null;
    const schedulerSteps = parseInt(req.body.schedulerSteps, 10) || null;
    const loraStrength = req.body.loraStrength !== undefined ? parseFloat(req.body.loraStrength) : null;
    const seedMode = req.body.seedMode || 'fixed';
    const noiseSeed = req.body.noiseSeed !== undefined && req.body.noiseSeed !== '' ? parseInt(req.body.noiseSeed, 10) : 1122879734307696;
    const outfitId = req.body.outfitId || null;

    const projectPath = validateProjectPath(id);
    const infoPath = path.join(projectPath, 'info.json');

    if (!fs.existsSync(infoPath)) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const info = readProjectInfo(id);
    const config = readConfig();

    let workflowFilename = 'Batchify.json';
    let isOutfitWorkflow = false;
    let selectedOutfit = null;

    if (outfitId) {
      const catalogue = readCatalogue();
      selectedOutfit = catalogue.find(o => o.id === outfitId);
      if (selectedOutfit) {
        workflowFilename = 'Batchify-V1.json';
        isOutfitWorkflow = true;

        // Copy outfit file to ComfyUI input folder
        const comfyInputDir = config.comfyOutputDir.replace(/output\/?$/, 'input');
        if (!fs.existsSync(comfyInputDir)) {
          fs.mkdirSync(comfyInputDir, { recursive: true });
        }
        const srcOutfitPath = path.join(OUTFITS_DIR, selectedOutfit.fileName);
        const destOutfitPath = path.join(comfyInputDir, selectedOutfit.fileName);
        fs.copyFileSync(srcOutfitPath, destOutfitPath);
      }
    }

    const workflowPath = path.join(__dirname, workflowFilename);
    const finalWorkflowPath = fs.existsSync(workflowPath) ? workflowPath : `C:\\Users\\ovh\\Documents\\AI\\batchify\\${workflowFilename}`;

    if (!fs.existsSync(finalWorkflowPath)) {
      return res.status(500).json({ error: `Workflow API file ${workflowFilename} not found.` });
    }

    let workflow = JSON.parse(fs.readFileSync(finalWorkflowPath, 'utf8'));

    // Dynamic Node Mapping based on workflow version
    const promptNodeId = isOutfitWorkflow ? '48' : '22';
    const schedulerNodeId = isOutfitWorkflow ? '50' : '393';
    const noiseNodeId = isOutfitWorkflow ? '53' : '31';
    const loraNodeId = '264';
    const batchLoaderNodeId = '394';
    const saveImageNodeId = isOutfitWorkflow ? '56' : '32';

    // Inject outfit image if using outfit workflow
    if (isOutfitWorkflow && selectedOutfit) {
      if (workflow['43'] && workflow['43'].inputs) {
        workflow['43'].inputs.image = selectedOutfit.fileName;
      }
    }

    // Inject custom prompt query text if provided
    if (promptText && typeof promptText === 'string') {
      if (workflow[promptNodeId] && workflow[promptNodeId].inputs) {
        workflow[promptNodeId].inputs.text = promptText;
      }
    }

    // Inject custom scheduler steps if provided
    if (schedulerSteps && schedulerSteps > 0) {
      if (workflow[schedulerNodeId] && workflow[schedulerNodeId].inputs) {
        workflow[schedulerNodeId].inputs.steps = schedulerSteps;
      }
    }

    // Inject custom LoRA strength if provided
    if (loraStrength !== null && !isNaN(loraStrength)) {
      if (workflow[loraNodeId] && workflow[loraNodeId].inputs) {
        workflow[loraNodeId].inputs.strength_model = loraStrength;
        workflow[loraNodeId].inputs.strength_clip = loraStrength;
      }
    }

    // Inject initial seed in case of batch size = 0
    if (workflow[noiseNodeId] && workflow[noiseNodeId].inputs) {
      if (seedMode === 'random') {
        workflow[noiseNodeId].inputs.noise_seed = Math.floor(Math.random() * 1000000000000000);
      } else {
        workflow[noiseNodeId].inputs.noise_seed = noiseSeed;
      }
    }

    // Check which frames have already been processed
    const editDir = path.join(projectPath, 'edited_frames');
    const editFiles = fs.existsSync(editDir) ? fs.readdirSync(editDir).filter(f => f.endsWith('.png')) : [];
    const editMap = {};
    editFiles.forEach(f => {
      const idx = getFrameNumberFromFilename(f);
      if (idx !== null) editMap[idx] = f;
    });

    // Find pending frames that need treatment
    const pendingFrames = [];
    for (let i = 1; i <= info.extractedCount; i++) {
      if (!editMap[i]) {
        pendingFrames.push(i);
      }
    }

    if (pendingFrames.length === 0) {
      return res.json({ success: true, message: 'All frames already processed.', promptId: 'skipped' });
    }

    info.status = 'processing';
    fs.writeFileSync(infoPath, JSON.stringify(info, null, 2), 'utf8');

    // Create Comfy output folder if not exists inside Comfy output dir
    const comfyProjOutDir = path.join(config.comfyOutputDir, 'batchify', `project_${id}`);
    if (!fs.existsSync(comfyProjOutDir)) {
      fs.mkdirSync(comfyProjOutDir, { recursive: true });
    }

    let lastPromptId = null;

    if (batchSize === 0) {
      // Original behavior: Queue all at once
      workflow[batchLoaderNodeId].inputs.path_or_urls = path.join(projectPath, 'extracted_frames');
      workflow[batchLoaderNodeId].inputs.start_from = 1;
      workflow[batchLoaderNodeId].inputs.batch_size = 0;
      workflow[saveImageNodeId].inputs.filename_prefix = `batchify\\project_${id}\\frame`;

      const response = await fetch(`${config.comfyUrl}/prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: workflow })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`ComfyUI API returned error: ${errText}`);
      }

      const resJson = await response.json();
      lastPromptId = resJson.prompt_id;
    } else {
      // Chunked Queueing: Queue in loops to ComfyUI's queue
      for (let i = 0; i < pendingFrames.length; i += batchSize) {
        const chunk = pendingFrames.slice(i, i + batchSize);
        const startFrame = chunk[0];
        const size = chunk.length;

        // Clone the workflow template
        const clonedWorkflow = JSON.parse(JSON.stringify(workflow));

        // Inject directories, start frame, and chunk size
        clonedWorkflow[batchLoaderNodeId].inputs.path_or_urls = path.join(projectPath, 'extracted_frames');
        clonedWorkflow[batchLoaderNodeId].inputs.start_from = startFrame;
        clonedWorkflow[batchLoaderNodeId].inputs.batch_size = size;

        // Save with padded frame index prefix so backend resolves frame number from prefix + index
        const zeroPadded = String(startFrame).padStart(4, '0');
        clonedWorkflow[saveImageNodeId].inputs.filename_prefix = `batchify\\project_${id}\\frame_${zeroPadded}`;

        // Inject seed mode inside each chunk
        if (clonedWorkflow[noiseNodeId] && clonedWorkflow[noiseNodeId].inputs) {
          if (seedMode === 'random') {
            clonedWorkflow[noiseNodeId].inputs.noise_seed = Math.floor(Math.random() * 1000000000000000);
          } else {
            clonedWorkflow[noiseNodeId].inputs.noise_seed = noiseSeed;
          }
        }

        const response = await fetch(`${config.comfyUrl}/prompt`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: clonedWorkflow })
        });

        if (!response.ok) {
          const errText = await response.text();
          console.error(`ComfyUI API error for chunk starting at ${startFrame}: ${errText}`);
          continue;
        }

        const resJson = await response.json();
        lastPromptId = resJson.prompt_id;
      }
    }

    info.comfyJobId = lastPromptId || 'batch_queue';
    fs.writeFileSync(infoPath, JSON.stringify(info, null, 2), 'utf8');

    res.json({ success: true, promptId: info.comfyJobId, queuedCount: pendingFrames.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST Pause ComfyUI processing
app.post('/api/projects/:id/pause-comfy', async (req, res) => {
  try {
    const { id } = req.params;
    const projectPath = validateProjectPath(id);
    const infoPath = path.join(projectPath, 'info.json');

    if (!fs.existsSync(infoPath)) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const info = readProjectInfo(id);
    const config = readConfig();

    // 1. Interrupt current execution
    try {
      await fetch(`${config.comfyUrl}/interrupt`, { method: 'POST' });
    } catch (e) {
      console.warn('ComfyUI interrupt failed:', e.message);
    }

    // 2. Clear remaining queue
    try {
      await fetch(`${config.comfyUrl}/queue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clear: true })
      });
    } catch (e) {
      console.warn('ComfyUI queue clear failed:', e.message);
    }

    info.status = 'extracted';
    fs.writeFileSync(infoPath, JSON.stringify(info, null, 2), 'utf8');

    res.json({ success: true, message: 'ComfyUI processing paused' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET/POST Watcher / Directory Sync API
app.get('/api/projects/:id/progress', (req, res) => {
  try {
    const { id } = req.params;
    const projectPath = validateProjectPath(id);
    const infoPath = path.join(projectPath, 'info.json');

    if (!fs.existsSync(infoPath)) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const info = readProjectInfo(id);
    const config = readConfig();

    // Check if Comfy output dir exists
    const comfyProjOutDir = path.join(config.comfyOutputDir, 'batchify', `project_${id}`);
    const editedDir = path.join(projectPath, 'edited_frames');

    let newFramesAdded = false;

    if (fs.existsSync(comfyProjOutDir)) {
      // Scan Comfy Output folder for new frames
      const comfyFiles = fs.readdirSync(comfyProjOutDir).filter(f => f.endsWith('.png'));

      comfyFiles.forEach(file => {
        const sourcePath = path.join(comfyProjOutDir, file);
        const targetPath = path.join(editedDir, file);

        // Copy frame to our local project workspace if it doesn't exist
        if (!fs.existsSync(targetPath)) {
          fs.copyFileSync(sourcePath, targetPath);
          newFramesAdded = true;
        }
      });
    }

    // Recount local edited files
    const localEditedFiles = fs.readdirSync(editedDir).filter(f => f.endsWith('.png'));
    info.editedCount = localEditedFiles.length;

    // Auto update status if we reach the target amount of extracted frames
    if (info.status === 'processing' && info.extractedCount > 0 && info.editedCount >= info.extractedCount) {
      info.status = 'processed';
    }

    fs.writeFileSync(infoPath, JSON.stringify(info, null, 2), 'utf8');

    res.json({
      status: info.status,
      extractedCount: info.extractedCount,
      editedCount: info.editedCount,
      percent: info.extractedCount > 0 ? Math.round((info.editedCount / info.extractedCount) * 100) : 0
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET List of frames (Original vs Edited metadata)
app.get('/api/projects/:id/frames', (req, res) => {
  try {
    const { id } = req.params;
    const projectPath = validateProjectPath(id);
    const infoPath = path.join(projectPath, 'info.json');

    if (!fs.existsSync(infoPath)) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const info = readProjectInfo(id);
    const extDir = path.join(projectPath, 'extracted_frames');
    const editDir = path.join(projectPath, 'edited_frames');

    const extFiles = fs.existsSync(extDir) ? fs.readdirSync(extDir).filter(f => f.endsWith('.png')) : [];
    const editFiles = fs.existsSync(editDir) ? fs.readdirSync(editDir).filter(f => f.endsWith('.png')) : [];

    // Map extracted frames by index
    const frameMap = {};

    extFiles.forEach(file => {
      const idx = getFrameNumberFromFilename(file);
      if (idx !== null) {
        frameMap[idx] = {
          index: idx,
          original: file,
          edited: null,
          omitted: info.omittedFrames.includes(idx)
        };
      }
    });

    // Map edited frames by index
    editFiles.forEach(file => {
      const idx = getFrameNumberFromFilename(file);
      if (idx !== null) {
        if (!frameMap[idx]) {
          frameMap[idx] = { index: idx, original: null, edited: file, omitted: info.omittedFrames.includes(idx) };
        } else {
          frameMap[idx].edited = file;
        }
      }
    });

    const frames = Object.values(frameMap).sort((a, b) => a.index - b.index);
    res.json({ frames, omittedFrames: info.omittedFrames });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE Omit frame
app.delete('/api/projects/:id/frames/:index', (req, res) => {
  try {
    const { id } = req.params;
    const index = parseInt(req.params.index, 10);
    const projectPath = validateProjectPath(id);
    const infoPath = path.join(projectPath, 'info.json');

    if (!fs.existsSync(infoPath)) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const info = readProjectInfo(id);
    if (!info.omittedFrames.includes(index)) {
      info.omittedFrames.push(index);
      info.omittedFrames.sort((a, b) => a - b);
      fs.writeFileSync(infoPath, JSON.stringify(info, null, 2), 'utf8');
    }

    res.json({ success: true, omittedFrames: info.omittedFrames });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST Restore frame
app.post('/api/projects/:id/frames/:index/restore', (req, res) => {
  try {
    const { id } = req.params;
    const index = parseInt(req.params.index, 10);
    const projectPath = validateProjectPath(id);
    const infoPath = path.join(projectPath, 'info.json');

    if (!fs.existsSync(infoPath)) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const info = readProjectInfo(id);
    info.omittedFrames = info.omittedFrames.filter(idx => idx !== index);
    fs.writeFileSync(infoPath, JSON.stringify(info, null, 2), 'utf8');

    res.json({ success: true, omittedFrames: info.omittedFrames });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Helper: Check if video has audio stream using ffprobe
function checkHasAudio(videoPath) {
  return new Promise((resolve) => {
    const ffprobe = spawn('ffprobe', [
      '-v', 'error',
      '-select_streams', 'a',
      '-show_entries', 'stream=codec_type',
      '-of', 'csv=p=0',
      videoPath
    ]);
    let output = '';
    ffprobe.stdout.on('data', (data) => output += data.toString());
    ffprobe.on('close', () => {
      resolve(output.trim() === 'audio');
    });
  });
}

// POST Compile edited frames back to video
app.post('/api/projects/:id/compile', async (req, res) => {
  try {
    const { id } = req.params;
    const includeAudio = req.body.includeAudio !== undefined ? !!req.body.includeAudio : true;
    const projectPath = validateProjectPath(id);
    const infoPath = path.join(projectPath, 'info.json');

    if (!fs.existsSync(infoPath)) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const info = readProjectInfo(id);
    const extDir = path.join(projectPath, 'extracted_frames');
    const editDir = path.join(projectPath, 'edited_frames');
    const tempCompileDir = path.join(projectPath, 'temp_compile');

    if (fs.existsSync(tempCompileDir)) {
      fs.rmSync(tempCompileDir, { recursive: true, force: true });
    }
    fs.mkdirSync(tempCompileDir, { recursive: true });

    // Fetch lists to map what edited files actually exist
    const extFiles = fs.readdirSync(extDir).filter(f => f.endsWith('.png'));
    const editFiles = fs.readdirSync(editDir).filter(f => f.endsWith('.png'));

    const extMap = {};
    const editMap = {};

    extFiles.forEach(f => { const idx = getFrameNumberFromFilename(f); if (idx !== null) extMap[idx] = f; });
    editFiles.forEach(f => { const idx = getFrameNumberFromFilename(f); if (idx !== null) editMap[idx] = f; });

    // Reconstruct sequence
    // If a frame is deleted (omitted), we duplicate the previous available frame
    let lastValidFrameFile = null;

    for (let i = 1; i <= info.extractedCount; i++) {
      const isOmitted = info.omittedFrames.includes(i);
      let fileToCopy = null;

      if (!isOmitted) {
        // Use edited frame if available, else original
        if (editMap[i]) {
          fileToCopy = path.join(editDir, editMap[i]);
        } else if (extMap[i]) {
          fileToCopy = path.join(extDir, extMap[i]);
        }
      }

      if (fileToCopy && fs.existsSync(fileToCopy)) {
        lastValidFrameFile = fileToCopy;
      }

      // If we don't have a file, duplicate the previous frame in the sequence
      const finalCopySource = fileToCopy || lastValidFrameFile;

      if (finalCopySource && fs.existsSync(finalCopySource)) {
        // Zero pad frame index so FFmpeg reads sequentially
        const zeroPadded = String(i).padStart(4, '0');
        fs.copyFileSync(finalCopySource, path.join(tempCompileDir, `frame_${zeroPadded}.png`));
      } else {
        console.warn(`No valid frame source found for index ${i}`);
      }
    }

    info.status = 'compiling';
    fs.writeFileSync(infoPath, JSON.stringify(info, null, 2), 'utf8');

    const tempOutputVideo = path.join(projectPath, 'output_no_audio.mp4');
    const finalOutputVideo = path.join(projectPath, 'output_final.mp4');
    const originalVideo = path.join(projectPath, 'input_video.mp4');

    // Compile frames to video (no audio first) secure spawn
    const ffmpegArgs = [
      '-framerate', String(info.fps),
      '-i', path.join(tempCompileDir, 'frame_%04d.png'),
      '-c:v', 'libx264',
      '-pix_fmt', 'yuv420p',
      '-y',
      tempOutputVideo
    ];

    const compileProcess = spawn('ffmpeg', ffmpegArgs);
    let errorLog = '';

    compileProcess.stderr.on('data', (data) => {
      errorLog += data.toString();
    });

    compileProcess.on('close', async (code) => {
      if (code === 0) {
        const fileHasAudioStream = await checkHasAudio(originalVideo);

        if (includeAudio && fileHasAudioStream) {
          // Merge audio from original video
          const mergeArgs = [
            '-i', tempOutputVideo,
            '-i', originalVideo,
            '-c:v', 'copy',
            '-c:a', 'aac',
            '-map', '0:v:0',
            '-map', '1:a:0',
            '-y',
            finalOutputVideo
          ];

          const mergeProcess = spawn('ffmpeg', mergeArgs);
          let mergeErrorLog = '';

          mergeProcess.stderr.on('data', (data) => {
            mergeErrorLog += data.toString();
          });

          mergeProcess.on('close', (mCode) => {
            // Cleanup temp folder & temp video
            fs.rmSync(tempCompileDir, { recursive: true, force: true });
            if (fs.existsSync(tempOutputVideo)) {
              fs.unlinkSync(tempOutputVideo);
            }

            if (mCode === 0) {
              info.status = 'completed';
              fs.writeFileSync(infoPath, JSON.stringify(info, null, 2), 'utf8');
            } else {
              console.error('Audio merge failed:', mergeErrorLog);
              info.status = 'error';
              info.error = 'Audio merge failed';
              fs.writeFileSync(infoPath, JSON.stringify(info, null, 2), 'utf8');
            }
          });
        } else {
          // No audio merging requested, or original video lacks an audio stream
          // Copy temp compiled video directly to final output
          try {
            fs.copyFileSync(tempOutputVideo, finalOutputVideo);
            fs.rmSync(tempCompileDir, { recursive: true, force: true });
            if (fs.existsSync(tempOutputVideo)) {
              fs.unlinkSync(tempOutputVideo);
            }
            info.status = 'completed';
            fs.writeFileSync(infoPath, JSON.stringify(info, null, 2), 'utf8');
          } catch (err) {
            console.error('Moving compiled file failed:', err);
            info.status = 'error';
            info.error = 'Moving compiled file failed';
            fs.writeFileSync(infoPath, JSON.stringify(info, null, 2), 'utf8');
          }
        }
      } else {
        console.error('Video compile failed:', errorLog);
        fs.rmSync(tempCompileDir, { recursive: true, force: true });
        info.status = 'error';
        info.error = 'Frame compile failed';
        fs.writeFileSync(infoPath, JSON.stringify(info, null, 2), 'utf8');
      }
    });

    res.json({ success: true, message: 'Compilation started' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// File streaming APIs (with Path Traversal protection)
app.get('/api/projects/:id/video/input', (req, res) => {
  try {
    const { id } = req.params;
    const projectPath = validateProjectPath(id);
    const videoPath = path.join(projectPath, 'input_video.mp4');

    if (fs.existsSync(videoPath)) {
      res.sendFile(videoPath);
    } else {
      res.status(404).send('Input video not found');
    }
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.get('/api/projects/:id/video/output', (req, res) => {
  try {
    const { id } = req.params;
    const projectPath = validateProjectPath(id);
    const videoPath = path.join(projectPath, 'output_final.mp4');

    if (fs.existsSync(videoPath)) {
      res.sendFile(videoPath);
    } else {
      res.status(404).send('Output video not found');
    }
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.get('/api/projects/:id/frames/original/:name', (req, res) => {
  try {
    const { id, name } = req.params;
    const projectPath = validateProjectPath(id);
    const framePath = path.resolve(projectPath, 'extracted_frames', name);

    // Strict path traversal block
    if (!framePath.startsWith(path.resolve(projectPath, 'extracted_frames'))) {
      return res.status(403).send('Forbidden');
    }

    if (fs.existsSync(framePath)) {
      res.sendFile(framePath);
    } else {
      res.status(404).send('Frame not found');
    }
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.get('/api/projects/:id/frames/edited/:name', (req, res) => {
  try {
    const { id, name } = req.params;
    const projectPath = validateProjectPath(id);
    const framePath = path.resolve(projectPath, 'edited_frames', name);

    // Strict path traversal block
    if (!framePath.startsWith(path.resolve(projectPath, 'edited_frames'))) {
      return res.status(403).send('Forbidden');
    }

    if (fs.existsSync(framePath)) {
      res.sendFile(framePath);
    } else {
      res.status(404).send('Frame not found');
    }
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// GET list of outfits
app.get('/api/outfits', (req, res) => {
  try {
    res.json(readCatalogue());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST Upload outfit to catalogue
app.post('/api/outfits', uploadOutfit.single('outfit'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No outfit file uploaded' });
    }
    const id = path.basename(req.file.filename, '.png');
    const name = req.body.name || 'Unnamed Outfit';

    const catalogue = readCatalogue();
    const newOutfit = {
      id,
      name,
      fileName: req.file.filename,
      createdAt: new Date().toISOString()
    };

    catalogue.push(newOutfit);
    writeCatalogue(catalogue);

    res.json(newOutfit);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE Outfit from catalogue
app.delete('/api/outfits/:id', (req, res) => {
  try {
    const { id } = req.params;
    const catalogue = readCatalogue();
    const outfit = catalogue.find(o => o.id === id);

    if (!outfit) {
      return res.status(404).json({ error: 'Outfit not found' });
    }

    const filePath = path.join(OUTFITS_DIR, outfit.fileName);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    const updated = catalogue.filter(o => o.id !== id);
    writeCatalogue(updated);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST Remove background from outfit image
app.post('/api/outfits/:id/remove-bg', (req, res) => {
  try {
    const { id } = req.params;
    const catalogue = readCatalogue();
    const outfit = catalogue.find(o => o.id === id);

    if (!outfit) {
      return res.status(404).json({ error: 'Outfit not found' });
    }

    const inputPath = path.join(OUTFITS_DIR, outfit.fileName);
    const tempOutPath = path.join(OUTFITS_DIR, `${id}_nobg.png`);

    const pythonScript = path.join(__dirname, 'scripts', 'remove_bg.py');
    const pythonProcess = spawn('python', [pythonScript, inputPath, tempOutPath]);

    let stderr = '';
    pythonProcess.stderr.on('data', (data) => stderr += data.toString());

    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        console.error(`Python remove-bg failed with code ${code}. Stderr: ${stderr}`);
        return res.status(500).json({ error: `Background removal failed: ${stderr || 'Unknown error'}` });
      }

      try {
        if (fs.existsSync(tempOutPath)) {
          fs.copyFileSync(tempOutPath, inputPath);
          fs.unlinkSync(tempOutPath);
        }
        res.json({ success: true, message: 'Background removed successfully' });
      } catch (e) {
        res.status(500).json({ error: e.message });
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Serve Outfits catalogue folder statically
app.use('/outfits', express.static(OUTFITS_DIR));

// Serve frontend in production mode
const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.send('Server running. Frontend not compiled yet (run dev or build).');
  });
}

app.listen(PORT, () => {
  console.log(`Batchify backend listening on port ${PORT}`);
});
