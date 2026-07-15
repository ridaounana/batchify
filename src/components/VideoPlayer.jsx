import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, RotateCcw, Volume2, VolumeX, Maximize, Columns, LayoutGrid, Download } from 'lucide-react';

export default function VideoPlayer({ project }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [loop, setLoop] = useState(true);
  const [compareMode, setCompareMode] = useState(false); // Side-by-side vs Single
  const [videoSource, setVideoSource] = useState('output'); // 'output' (edited) or 'input' (original)

  const mainVideoRef = useRef(null);
  const secondaryVideoRef = useRef(null); // original video for compare sync

  const inputVideoUrl = `/api/projects/${project.id}/video/input`;
  const outputVideoUrl = `/api/projects/${project.id}/video/output`;

  // Sync playback rates and states in compare mode
  useEffect(() => {
    if (mainVideoRef.current) {
      mainVideoRef.current.playbackRate = speed;
      mainVideoRef.current.loop = loop;
      mainVideoRef.current.muted = isMuted;
      mainVideoRef.current.volume = volume;
    }
    if (secondaryVideoRef.current) {
      secondaryVideoRef.current.playbackRate = speed;
      secondaryVideoRef.current.loop = loop;
      secondaryVideoRef.current.muted = true; // Always mute original during sync comparison
    }
  }, [speed, loop, isMuted, volume, compareMode, videoSource]);

  // Sync seek and play actions
  const handlePlayPause = () => {
    if (isPlaying) {
      mainVideoRef.current.pause();
      if (compareMode && secondaryVideoRef.current) {
        secondaryVideoRef.current.pause();
      }
      setIsPlaying(false);
    } else {
      mainVideoRef.current.play().catch(e => console.error(e));
      if (compareMode && secondaryVideoRef.current) {
        // Sync time before playing
        secondaryVideoRef.current.currentTime = mainVideoRef.current.currentTime;
        secondaryVideoRef.current.play().catch(e => console.error(e));
      }
      setIsPlaying(true);
    }
  };

  const handleTimeUpdate = () => {
    if (mainVideoRef.current) {
      setCurrentTime(mainVideoRef.current.currentTime);
      setDuration(mainVideoRef.current.duration || 0);

      // Periodically force sub-second synchronization
      if (compareMode && secondaryVideoRef.current) {
        const diff = Math.abs(mainVideoRef.current.currentTime - secondaryVideoRef.current.currentTime);
        if (diff > 0.1) {
          secondaryVideoRef.current.currentTime = mainVideoRef.current.currentTime;
        }
      }
    }
  };

  const handleSeek = (e) => {
    const seekTime = parseFloat(e.target.value);
    setCurrentTime(seekTime);
    if (mainVideoRef.current) {
      mainVideoRef.current.currentTime = seekTime;
    }
    if (compareMode && secondaryVideoRef.current) {
      secondaryVideoRef.current.currentTime = seekTime;
    }
  };

  const handleSpeedChange = (e) => {
    const rate = parseFloat(e.target.value);
    setSpeed(rate);
  };

  const handleVolumeChange = (e) => {
    const vol = parseFloat(e.target.value);
    setVolume(vol);
    setIsMuted(vol === 0);
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  const formatTime = (time) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const triggerFullscreen = () => {
    if (mainVideoRef.current) {
      if (mainVideoRef.current.requestFullscreen) {
        mainVideoRef.current.requestFullscreen();
      } else if (mainVideoRef.current.webkitRequestFullscreen) {
        mainVideoRef.current.webkitRequestFullscreen();
      }
    }
  };

  return (
    <div className="custom-player-wrapper glass-panel animated-fade-in">
      <div className="player-top-menu flex justify-between align-center p-10">
        <div className="flex gap-10">
          <button
            onClick={() => {
              setCompareMode(false);
              setVideoSource('output');
            }}
            className={`btn btn-xs ${!compareMode && videoSource === 'output' ? 'btn-primary' : 'btn-secondary'}`}
          >
            AI Final Video
          </button>
          <button
            onClick={() => {
              setCompareMode(false);
              setVideoSource('input');
            }}
            className={`btn btn-xs ${!compareMode && videoSource === 'input' ? 'btn-primary' : 'btn-secondary'}`}
          >
            Original Video
          </button>
          <button
            onClick={() => setCompareMode(true)}
            className={`btn btn-xs ${compareMode ? 'btn-primary' : 'btn-secondary'}`}
          >
            <Columns size={12} className="mr-5" />
            Side-By-Side Compare
          </button>
        </div>

        <a
          href={videoSource === 'output' ? outputVideoUrl : inputVideoUrl}
          download={`batchify-${project.name}-${videoSource}.mp4`}
          className="btn btn-secondary btn-xs flex align-center gap-5"
        >
          <Download size={12} />
          Download
        </a>
      </div>

      <div className={`video-viewports ${compareMode ? 'compare-split' : 'single'}`}>
        {compareMode ? (
          <>
            <div className="viewport-panel">
              <span className="panel-label">ORIGINAL SOURCE</span>
              <video
                ref={secondaryVideoRef}
                src={inputVideoUrl}
                preload="auto"
                playsInline
                className="custom-video-element"
              />
            </div>
            <div className="viewport-panel">
              <span className="panel-label active">AI PROCESSED</span>
              <video
                ref={mainVideoRef}
                src={outputVideoUrl}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleTimeUpdate}
                onEnded={() => setIsPlaying(false)}
                preload="auto"
                playsInline
                className="custom-video-element"
              />
            </div>
          </>
        ) : (
          <div className="viewport-panel full-width">
            <span className="panel-label active">
              {videoSource === 'output' ? 'AI PROCESSED OUTPUT' : 'ORIGINAL INPUT'}
            </span>
            <video
              ref={mainVideoRef}
              src={videoSource === 'output' ? outputVideoUrl : inputVideoUrl}
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleTimeUpdate}
              onEnded={() => setIsPlaying(false)}
              preload="auto"
              playsInline
              className="custom-video-element"
            />
          </div>
        )}
      </div>

      {/* Beautiful Custom Controller Board */}
      <div className="custom-controls-board flex-column">
        {/* Track Slider */}
        <div className="progress-timeline flex align-center gap-10">
          <span className="time-display">{formatTime(currentTime)}</span>
          <input
            type="range"
            min="0"
            max={duration || 100}
            step="0.01"
            value={currentTime}
            onChange={handleSeek}
            className="timeline-scrubber"
          />
          <span className="time-display">{formatTime(duration)}</span>
        </div>

        {/* Action Controls */}
        <div className="controls-row flex justify-between align-center">
          <div className="flex align-center gap-15">
            <button onClick={handlePlayPause} className="btn-play-toggle">
              {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
            </button>

            <button
              onClick={() => {
                if (mainVideoRef.current) mainVideoRef.current.currentTime = 0;
                if (secondaryVideoRef.current) secondaryVideoRef.current.currentTime = 0;
                setCurrentTime(0);
              }}
              className="btn-icon-subtle"
              title="Reset Video"
            >
              <RotateCcw size={16} />
            </button>

            <div className="volume-control-set flex align-center gap-5">
              <button onClick={toggleMute} className="btn-icon-subtle">
                {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="volume-slider"
              />
            </div>

            <label className="loop-check flex align-center gap-5 select-none cursor-pointer">
              <input
                type="checkbox"
                checked={loop}
                onChange={(e) => setLoop(e.target.checked)}
              />
              <span>Loop Playback</span>
            </label>
          </div>

          <div className="flex align-center gap-15">
            {/* Speed Manager */}
            <div className="speed-controller flex align-center gap-5">
              <label className="text-muted">Speed:</label>
              <select value={speed} onChange={handleSpeedChange} className="speed-select-box">
                <option value="0.25">0.25x (Slowest)</option>
                <option value="0.5">0.5x</option>
                <option value="0.75">0.75x</option>
                <option value="1">1.0x (Normal)</option>
                <option value="1.25">1.25x</option>
                <option value="1.5">1.5x</option>
                <option value="2">2.0x</option>
                <option value="4">4.0x (Fastest)</option>
              </select>
            </div>

            <button onClick={triggerFullscreen} className="btn-icon-subtle" title="Fullscreen">
              <Maximize size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
