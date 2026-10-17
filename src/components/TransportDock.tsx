import React, { useEffect, useState } from 'react';
import { Score } from '../types/music';
import { getVoice } from '../audio/instruments';
import { audioEngine } from '../audio/audioEngine';
import { Bell, BellOff, Gauge, Play, Repeat, RotateCcw, Square, Volume2, VolumeX } from 'lucide-react';

interface TransportDockProps {
  score: Score;
  onUpdateScore: (updates: Partial<Score>) => void;
  selectedMeasureIndex: number | null;
  activePlayhead: { measureIndex: number; eventIndex: number; isPlaying: boolean } | null;
  onStopRequested?: () => void;
}

export const TransportDock: React.FC<TransportDockProps> = ({
  score,
  onUpdateScore,
  selectedMeasureIndex,
  activePlayhead,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLooping, setIsLooping] = useState(false);
  const [isMetronome, setIsMetronome] = useState(false);
  const [volume, setVolume] = useState(0.85);
  const [currentBeat, setCurrentBeat] = useState(1);

  const loopAvailable = selectedMeasureIndex !== null;

  // Single subscription to the real audio timeline: the dock and the canvas
  // both receive ticks now, instead of overwriting one another.
  useEffect(() => {
    return audioEngine.subscribePlaybackTick((tick) => {
      setIsPlaying(tick.isPlaying);
      setCurrentBeat(tick.isPlaying ? tick.beat : 1);
    });
  }, []);

  // Loop can only follow a selected bar; if the selection is cleared while it is
  // armed, disarm it rather than silently looping the whole score.
  useEffect(() => {
    if (!loopAvailable && isLooping) setIsLooping(false);
  }, [loopAvailable, isLooping]);

  const handlePlay = () => {
    const loopTarget = isLooping && selectedMeasureIndex !== null ? selectedMeasureIndex : null;
    void audioEngine.playScore(score, 0, loopTarget);
  };

  const handleStop = () => {
    audioEngine.stop();
    setCurrentBeat(1);
  };

  const handleRestart = () => {
    void audioEngine.playScore(score, 0, isLooping && selectedMeasureIndex !== null ? selectedMeasureIndex : null);
  };

  const toggleLoop = () => {
    if (!loopAvailable) return;
    setIsLooping((prev) => !prev);
  };

  const toggleMetronome = () => {
    const next = !isMetronome;
    setIsMetronome(next);
    audioEngine.setMetronome(next);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    setVolume(value);
    audioEngine.setVolume(value);
  };

  const handleTempoChange = (delta: number) => {
    onUpdateScore({ tempo: Math.max(40, Math.min(240, (score.tempo || 100) + delta)) });
  };

  const displayMeasure = activePlayhead?.isPlaying ? activePlayhead.measureIndex + 1 : 1;

  return (
    <footer
      className="flex items-center justify-between flex-wrap gap-3 px-4 py-3 bg-surface border-t border-border select-none z-10"
      aria-label="Playback transport"
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleRestart}
          className="p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-app-bg transition-colors"
          title="Play from the beginning"
          aria-label="Play from the beginning"
        >
          <RotateCcw size={16} />
        </button>

        <button
          type="button"
          onClick={isPlaying ? handleStop : handlePlay}
          className="flex items-center justify-center w-11 h-11 rounded-full bg-primary hover:bg-primary-hover text-white shadow-sm transition-transform active:scale-95"
          title={isPlaying ? 'Stop playback (Space)' : 'Play score (Space)'}
          aria-label={isPlaying ? 'Stop playback' : 'Play score'}
        >
          {isPlaying ? <Square size={18} className="fill-current" /> : <Play size={20} className="fill-current ml-0.5" />}
        </button>

        <button
          type="button"
          onClick={toggleLoop}
          disabled={!loopAvailable}
          aria-pressed={isLooping}
          className={`p-2 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
            isLooping ? 'bg-primary-soft text-primary font-medium' : 'text-text-muted hover:text-text-primary hover:bg-app-bg'
          }`}
          title={
            loopAvailable
              ? isLooping
                ? `Looping Bar ${selectedMeasureIndex! + 1}`
                : `Loop Bar ${selectedMeasureIndex! + 1}`
              : 'Select a bar to loop it'
          }
          aria-label="Loop selected bar"
        >
          <Repeat size={16} />
        </button>

        <button
          type="button"
          onClick={toggleMetronome}
          aria-pressed={isMetronome}
          className={`p-2 rounded-lg transition-colors ${
            isMetronome ? 'bg-primary-soft text-primary font-medium' : 'text-text-muted hover:text-text-primary hover:bg-app-bg'
          }`}
          title={isMetronome ? 'Metronome on — clicks on beats where notes begin' : 'Metronome off'}
          aria-label="Metronome"
        >
          {isMetronome ? <Bell size={16} /> : <BellOff size={16} />}
        </button>
      </div>

      <div className="flex items-center gap-3 px-3 py-1.5 rounded-lg bg-app-bg border border-border text-xs font-mono">
        <span className="text-text-secondary">
          Bar <strong className="text-text-primary">{displayMeasure}</strong>
        </span>
        <span aria-hidden="true" className="text-border">
          ·
        </span>
        <span className="text-text-secondary">
          Beat <strong className="text-primary tabular-nums">{isPlaying ? currentBeat.toFixed(1) : '1.0'}</strong>
        </span>
      </div>

      <div className="flex items-center gap-4 text-xs">
        <div className="flex items-center gap-1.5">
          <Gauge size={14} className="text-text-muted" />
          <span className="text-text-secondary font-medium">BPM</span>
          <div className="flex items-center bg-app-bg border border-border rounded-md overflow-hidden">
            <button
              type="button"
              onClick={() => handleTempoChange(-4)}
              className="px-2 py-1 text-text-secondary hover:text-text-primary hover:bg-surface"
              title="Decrease tempo by 4 BPM"
              aria-label="Decrease tempo"
            >
              −
            </button>
            <span className="px-2 font-mono font-bold text-text-primary tabular-nums">{score.tempo}</span>
            <button
              type="button"
              onClick={() => handleTempoChange(4)}
              className="px-2 py-1 text-text-secondary hover:text-text-primary hover:bg-surface"
              title="Increase tempo by 4 BPM"
              aria-label="Increase tempo"
            >
              +
            </button>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              const nextVolume = volume === 0 ? 0.85 : 0;
              setVolume(nextVolume);
              audioEngine.setVolume(nextVolume);
            }}
            className="text-text-muted hover:text-text-primary"
            title={volume === 0 ? 'Unmute' : 'Mute'}
            aria-label={volume === 0 ? 'Unmute' : 'Mute'}
          >
            {volume === 0 ? <VolumeX size={15} /> : <Volume2 size={15} />}
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={volume}
            onChange={handleVolumeChange}
            className="w-20 accent-primary cursor-pointer"
            aria-label="Volume"
          />
        </div>

        <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded bg-primary-soft text-primary font-medium text-[11px]">
          <span className="w-1.5 h-1.5 rounded-full bg-primary" aria-hidden="true" />
          <span>{getVoice(score.instrument).label}</span>
        </div>
      </div>
    </footer>
  );
};
