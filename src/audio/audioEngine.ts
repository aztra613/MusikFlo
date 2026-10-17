import * as Tone from 'tone';
import { Score, ScoreNote, InstrumentId, getMidiNumber, getNoteFrequency, getEventTicks, TICKS_PER_QUARTER } from '../types/music';
import { VoiceSpec, getVoice } from './instruments';

export interface PlaybackTick {
  measureIndex: number;
  eventIndex: number;
  /** Flattened position of this event across the whole score (-1 when idle). */
  globalEventIndex: number;
  /** Beat inside the sounding measure, 1-based. */
  beat: number;
  isPlaying: boolean;
}

export type PlaybackTickListener = (tick: PlaybackTick) => void;

const IDLE_TICK: PlaybackTick = {
  measureIndex: 0,
  eventIndex: 0,
  globalEventIndex: -1,
  beat: 1,
  isPlaying: false,
};

/** A live voice: the synth plus the effect chain built from its spec. */
interface LiveVoice {
  synth: Tone.PolySynth;
  output: Tone.ToneAudioNode;
}

/** Polyphony ceiling, so dense scores cannot exhaust voices. */
const MAX_POLYPHONY = 64;

class AudioEngine {
  private voices: Partial<Record<InstrumentId, LiveVoice>> = {};
  private metronomeSynth: Tone.MembraneSynth | null = null;
  private isInitialized = false;
  private isPlaying = false;
  private isLooping = false;
  private loopMeasureIndex: number | null = null;
  private metronomeEnabled = false;
  private volumeValue = 0.85;
  private masterVolume: Tone.Volume | null = null;

  // Playhead subscribers. Every consumer (studio canvas, transport, landing
  // demo) must receive the same timeline, so this is a listener set rather than
  // a single callback that the last mounted component would silently replace.
  private tickListeners = new Set<PlaybackTickListener>();
  private playbackTimeoutIds: number[] = [];
  private playToken = 0;

  public async init() {
    if (this.isInitialized) return;
    try {
      await Tone.start();
      this.masterVolume = new Tone.Volume(Tone.gainToDb(this.volumeValue)).toDestination();

      // Metronome click
      this.metronomeSynth = new Tone.MembraneSynth({
        pitchDecay: 0.008,
        octaves: 2,
        oscillator: { type: 'sine' },
        envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.01 },
      }).connect(this.masterVolume);
      this.metronomeSynth.volume.value = -6;

      this.isInitialized = true;
    } catch (e) {
      console.warn('AudioContext initialization warning:', e);
    }
  }

  private ensureMaster(): Tone.Volume {
    if (!this.masterVolume) {
      this.masterVolume = new Tone.Volume(Tone.gainToDb(this.volumeValue)).toDestination();
    }
    return this.masterVolume;
  }

  /**
   * Build (and cache) a live voice from its spec. Oscillator, envelope, filter
   * and effects all come from the shared table, so a voice cannot be
   * "forgotten" the way the offline renderer once forgot the guitar.
   */
  private getVoiceNode(instrument: InstrumentId): LiveVoice {
    const master = this.ensureMaster();
    const existing = this.voices[instrument];
    if (existing) return existing;

    const spec: VoiceSpec = getVoice(instrument);
    const primary = spec.partials[0];

    const synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: primary.type === 'square' ? 'pulse' : primary.type },
      envelope: {
        attack: spec.envelope.attack,
        decay: spec.envelope.decay,
        sustain: spec.envelope.sustain,
        release: spec.envelope.release,
      },
    });
    synth.volume.value = Tone.gainToDb(spec.gain);
    synth.maxPolyphony = MAX_POLYPHONY;

    const filter = new Tone.Filter({ type: spec.filter.type, frequency: spec.filter.hz, Q: spec.filter.q });
    synth.connect(filter);

    let output: Tone.ToneAudioNode = filter;

    if (spec.chorus) {
      const chorus = new Tone.Chorus({ frequency: 1.5, delayTime: 3.5, depth: spec.chorus }).start();
      chorus.wet.value = spec.chorus;
      output.connect(chorus);
      output = chorus;
    }

    if (spec.vibrato) {
      const vibrato = new Tone.Vibrato(spec.vibrato.rateHz, Math.min(1, spec.vibrato.depthCents / 40));
      vibrato.wet.value = 0.6;
      output.connect(vibrato);
      output = vibrato;
    }

    output.connect(master);

    const voice: LiveVoice = { synth, output };
    this.voices[instrument] = voice;
    return voice;
  }

  private getSynth(instrument: InstrumentId): Tone.PolySynth {
    return this.getVoiceNode(instrument).synth;
  }

  public setVolume(val: number) {
    this.volumeValue = Math.max(0, Math.min(1, val));
    if (this.masterVolume) {
      if (this.volumeValue <= 0.01) {
        this.masterVolume.mute = true;
      } else {
        this.masterVolume.mute = false;
        this.masterVolume.volume.rampTo(Tone.gainToDb(this.volumeValue), 0.05);
      }
    }
  }

  public getVolume(): number {
    return this.volumeValue;
  }

  public setMetronome(enabled: boolean) {
    this.metronomeEnabled = enabled;
  }

  public isMetronomeActive(): boolean {
    return this.metronomeEnabled;
  }

  /**
   * Subscribe to the playback timeline. Returns an unsubscribe function so
   * components can detach on unmount without clobbering other subscribers.
   */
  public subscribePlaybackTick(listener: PlaybackTickListener): () => void {
    this.tickListeners.add(listener);
    return () => {
      this.tickListeners.delete(listener);
    };
  }

  private emitTick(tick: PlaybackTick) {
    this.tickListeners.forEach((listener) => {
      try {
        listener(tick);
      } catch {
        // A broken subscriber must never interrupt playback.
      }
    });
  }

  /** Preview a single note on placement or selection. */
  public async previewNote(note: ScoreNote, instrument: InstrumentId = 'piano') {
    if (note.isRest) return;
    await this.init();
    const synth = this.getSynth(instrument);
    const midi = getMidiNumber(note.step, note.octave, note.accidental);
    const freq = getNoteFrequency(midi);
    const ticks = getEventTicks(note);
    const durationSec = Math.max(0.15, (ticks / TICKS_PER_QUARTER) * (60 / 120));

    try {
      synth.triggerAttackRelease(freq, durationSec);
    } catch {
      // Ignore audio scheduling blips
    }
  }

  /**
   * Play the score as a real scheduled timeline. Every event is emitted to all
   * subscribers in the same order it is heard, so the visual playhead follows
   * the audio instead of a decorative timer.
   */
  public async playScore(score: Score, startMeasureIndex: number = 0, loopMeasure: number | null = null) {
    const token = ++this.playToken;
    this.stop(); // Stop any active run (also invalidates older tokens)
    this.playToken = token;

    await this.init();

    // A stop()/unmount happened while audio was starting up.
    if (this.playToken !== token) return;

    this.isPlaying = true;
    this.loopMeasureIndex = loopMeasure;
    this.isLooping = loopMeasure !== null;

    const synth = this.getSynth(score.instrument);
    const bpm = score.tempo || 100;
    const secondsPerTick = 60 / bpm / TICKS_PER_QUARTER;

    // Flatten score events with absolute timeline start times.
    interface ScheduledEvent {
      measureIndex: number;
      eventIndex: number;
      globalEventIndex: number;
      note: ScoreNote;
      timeOffsetSec: number;
      durationSec: number;
      beatInMeasure: number;
    }

    const scheduledEvents: ScheduledEvent[] = [];
    let currentTimeOffset = 0;
    let globalEventIndex = 0;

    const loopIndex = this.loopMeasureIndex;
    const looped = this.isLooping && loopIndex !== null;
    const loopedMeasure = looped ? score.measures[loopIndex as number] : undefined;

    const targetMeasures: Array<{ measure: Score['measures'][number]; mIdx: number }> = looped
      ? loopedMeasure && loopIndex !== null
        ? [{ measure: loopedMeasure, mIdx: loopIndex }]
        : []
      : score.measures.slice(startMeasureIndex).map((measure, i) => ({ measure, mIdx: startMeasureIndex + i }));

    targetMeasures.forEach(({ measure, mIdx }) => {
      let measureAccumTicks = 0;

      measure.events.forEach((note, eIdx) => {
        const ticks = getEventTicks(note);
        const durationSec = ticks * secondsPerTick;
        const beatInMeasure = measureAccumTicks / TICKS_PER_QUARTER + 1;

        scheduledEvents.push({
          measureIndex: mIdx,
          eventIndex: eIdx,
          globalEventIndex: globalEventIndex++,
          note,
          timeOffsetSec: currentTimeOffset,
          durationSec,
          beatInMeasure,
        });

        currentTimeOffset += durationSec;
        measureAccumTicks += ticks;
      });
    });

    const totalDurationSec = currentTimeOffset;

    if (scheduledEvents.length === 0 || totalDurationSec <= 0) {
      this.isPlaying = false;
      this.emitTick(IDLE_TICK);
      return;
    }

    scheduledEvents.forEach((ev) => {
      const delayMs = ev.timeOffsetSec * 1000;

      const timeoutId = window.setTimeout(() => {
        if (!this.isPlaying || this.playToken !== token) return;

        this.emitTick({
          measureIndex: ev.measureIndex,
          eventIndex: ev.eventIndex,
          globalEventIndex: ev.globalEventIndex,
          beat: ev.beatInMeasure,
          isPlaying: true,
        });

        // Metronome click on primary beats if enabled.
        if (this.metronomeEnabled && this.metronomeSynth) {
          if (Math.abs(ev.beatInMeasure - Math.round(ev.beatInMeasure)) < 0.05) {
            const isFirstBeat = Math.round(ev.beatInMeasure) === 1;
            try {
              this.metronomeSynth.triggerAttackRelease(isFirstBeat ? 'C5' : 'G4', '32n');
            } catch {
              // Ignore metronome drop
            }
          }
        }

        if (!ev.note.isRest) {
          const midi = getMidiNumber(ev.note.step, ev.note.octave, ev.note.accidental);
          const freq = getNoteFrequency(midi);
          try {
            // Slightly detached (0.95) so repeated notes re-articulate.
            synth.triggerAttackRelease(freq, Math.max(0.08, ev.durationSec * 0.95));
          } catch {
            // Synth busy catch
          }
        }
      }, delayMs);

      this.playbackTimeoutIds.push(timeoutId);
    });

    const finishTimeoutId = window.setTimeout(() => {
      if (!this.isPlaying || this.playToken !== token) return;

      if (looped) {
        void this.playScore(score, startMeasureIndex, this.loopMeasureIndex);
      } else {
        this.stop();
      }
    }, totalDurationSec * 1000 + 150);

    this.playbackTimeoutIds.push(finishTimeoutId);
  }

  public stop() {
    // Invalidate any in-flight playScore so it cannot resume after this stop.
    this.playToken++;
    this.isPlaying = false;
    this.playbackTimeoutIds.forEach((id) => clearTimeout(id));
    this.playbackTimeoutIds = [];

    Object.values(this.voices).forEach((voice) => {
      try {
        voice.synth.releaseAll();
      } catch {
        // Ignore
      }
    });

    this.emitTick(IDLE_TICK);
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  /**
   * Render the score to a 16-bit 44.1 kHz stereo PCM WAV using an
   * OfflineAudioContext.
   *
   * The voice is built from the same {@link VoiceSpec} the live engine uses:
   * partials, envelope, filter sweep, breath noise, detune and vibrato all come
   * from that one table, so the exported audio matches the selected instrument.
   */
  public async renderToWav(score: Score): Promise<Blob> {
    const spec = getVoice(score.instrument);
    const bpm = score.tempo || 100;
    const secondsPerTick = 60 / bpm / TICKS_PER_QUARTER;

    let totalTicks = 0;
    score.measures.forEach((measure) => {
      measure.events.forEach((event) => {
        totalTicks += getEventTicks(event);
      });
    });

    const leadInSec = 0.1;
    const tailSec = Math.max(0.8, spec.envelope.release + 0.4);
    const durationSec = Math.max(1, leadInSec + totalTicks * secondsPerTick + tailSec);
    const sampleRate = 44100;
    const offlineCtx = new OfflineAudioContext(2, Math.ceil(sampleRate * durationSec), sampleRate);

    const masterGain = offlineCtx.createGain();
    masterGain.gain.value = 0.85 * spec.gain;
    masterGain.connect(offlineCtx.destination);

    // Shared noise material for breathy voices.
    let noiseBuffer: AudioBuffer | null = null;
    if (spec.noise) {
      noiseBuffer = offlineCtx.createBuffer(1, Math.ceil(sampleRate * 0.5), sampleRate);
      const channel = noiseBuffer.getChannelData(0);
      for (let i = 0; i < channel.length; i++) {
        channel[i] = Math.random() * 2 - 1;
      }
    }

    let cursor = leadInSec;

    score.measures.forEach((measure) => {
      measure.events.forEach((note) => {
        const noteDurSec = getEventTicks(note) * secondsPerTick;

        if (!note.isRest) {
          const midi = getMidiNumber(note.step, note.octave, note.accidental);
          const freq = getNoteFrequency(midi);

          const start = cursor;
          const hold = Math.max(0.08, noteDurSec * 0.95);
          const stop = start + hold;
          const end = stop + spec.envelope.release + 0.1;

          const { attack, decay, sustain } = spec.envelope;
          const peak = 0.5;
          const attackEnd = start + Math.max(0.001, attack);
          const decayEnd = attackEnd + Math.max(0.001, decay);

          const voiceGain = offlineCtx.createGain();
          voiceGain.gain.setValueAtTime(0.0001, start);
          voiceGain.gain.linearRampToValueAtTime(peak, attackEnd);
          voiceGain.gain.linearRampToValueAtTime(peak * Math.max(0.001, sustain), decayEnd);
          voiceGain.gain.setValueAtTime(peak * Math.max(0.001, sustain), stop);
          voiceGain.gain.linearRampToValueAtTime(0.0001, stop + spec.envelope.release);

          // Onset filter sweep: this is what separates a plucked string from a
          // bowed one, and a struck piano from a blown flute.
          const filter = offlineCtx.createBiquadFilter();
          filter.type = spec.filter.type;
          filter.Q.value = spec.filter.q;
          filter.frequency.setValueAtTime(
            Math.min(sampleRate / 2 - 1000, spec.filter.hz + spec.filter.envAmount),
            start
          );
          filter.frequency.exponentialRampToValueAtTime(
            Math.max(60, spec.filter.hz),
            start + Math.max(0.02, spec.filter.envDecay)
          );

          // Vibrato: one LFO shared into every oscillator's detune input.
          let vibratoGain: GainNode | null = null;
          if (spec.vibrato) {
            const lfo = offlineCtx.createOscillator();
            lfo.frequency.value = spec.vibrato.rateHz;
            vibratoGain = offlineCtx.createGain();
            const fadeStart = start + spec.vibrato.delaySec;
            vibratoGain.gain.setValueAtTime(0, start);
            vibratoGain.gain.setValueAtTime(0, fadeStart);
            vibratoGain.gain.linearRampToValueAtTime(spec.vibrato.depthCents, fadeStart + 0.4);
            lfo.connect(vibratoGain);
            lfo.start(start);
            lfo.stop(end);
          }

          spec.partials.forEach((partial) => {
            const osc = offlineCtx.createOscillator();
            osc.type = partial.type;
            osc.frequency.value = freq * partial.ratio;
            if (partial.detuneCents) osc.detune.value = partial.detuneCents;
            if (vibratoGain) vibratoGain.connect(osc.detune);

            const partialGain = offlineCtx.createGain();
            partialGain.gain.value = partial.gain;
            osc.connect(partialGain);
            partialGain.connect(filter);

            osc.start(start);
            osc.stop(end);
          });

          // Detuned companion for ensemble width (strings, guitar).
          if (spec.chorus) {
            const detuned = offlineCtx.createOscillator();
            detuned.type = spec.partials[0].type;
            detuned.frequency.value = freq;
            detuned.detune.value = 4 + spec.chorus * 10;
            const detunedGain = offlineCtx.createGain();
            detunedGain.gain.value = spec.partials[0].gain * spec.chorus * 0.8;
            detuned.connect(detunedGain);
            detunedGain.connect(filter);
            if (vibratoGain) vibratoGain.connect(detuned.detune);
            detuned.start(start);
            detuned.stop(end);
          }

          // Breath noise for the flutes.
          if (spec.noise && noiseBuffer) {
            const source = offlineCtx.createBufferSource();
            source.buffer = noiseBuffer;
            source.loop = true;

            const band = offlineCtx.createBiquadFilter();
            band.type = 'bandpass';
            band.frequency.value = spec.noise.filterHz;
            band.Q.value = spec.noise.q;

            const noiseGain = offlineCtx.createGain();
            // Air is most audible at the attack, then settles into the note.
            noiseGain.gain.setValueAtTime(spec.noise.gain, start);
            noiseGain.gain.linearRampToValueAtTime(spec.noise.gain * 0.45, start + 0.25);

            source.connect(band);
            band.connect(noiseGain);
            noiseGain.connect(filter);
            source.start(start);
            source.stop(stop + 0.05);
          }

          filter.connect(voiceGain);
          voiceGain.connect(masterGain);
        }

        cursor += noteDurSec;
      });
    });

    const renderedBuffer = await offlineCtx.startRendering();
    return this.bufferToWav(renderedBuffer);
  }

  private bufferToWav(buffer: AudioBuffer): Blob {
    const numOfChan = buffer.numberOfChannels;
    const length = buffer.length * numOfChan * 2 + 44;
    const out = new DataView(new ArrayBuffer(length));
    const channels: Float32Array[] = [];
    const sampleRate = buffer.sampleRate;
    let offset = 0;
    let pos = 0;

    function setUint16(data: number) {
      out.setUint16(pos, data, true);
      pos += 2;
    }

    function setUint32(data: number) {
      out.setUint32(pos, data, true);
      pos += 4;
    }

    // RIFF chunk descriptor
    setUint32(0x46464952); // "RIFF"
    setUint32(length - 8); // file length - 8
    setUint32(0x45564157); // "WAVE"

    // FMT sub-chunk
    setUint32(0x20746d66); // "fmt "
    setUint32(16); // subchunk1size (16 for PCM)
    setUint16(1); // audio format (1 = PCM)
    setUint16(numOfChan);
    setUint32(sampleRate);
    setUint32(sampleRate * 2 * numOfChan); // byte rate
    setUint16(numOfChan * 2); // block align
    setUint16(16); // bits per sample

    // Data sub-chunk
    setUint32(0x61746164); // "data"
    setUint32(length - pos - 4); // data length

    for (let i = 0; i < buffer.numberOfChannels; i++) {
      channels.push(buffer.getChannelData(i));
    }

    while (pos < length) {
      for (let i = 0; i < numOfChan; i++) {
        let sample = Math.max(-1, Math.min(1, channels[i][offset]));
        sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0;
        out.setInt16(pos, sample, true);
        pos += 2;
      }
      offset++;
    }

    return new Blob([out.buffer], { type: 'audio/wav' });
  }
}

export const audioEngine = new AudioEngine();
