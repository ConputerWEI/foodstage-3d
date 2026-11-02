import type { FoodSound } from '../data/foods';
import type { Settings } from './settings';

/** Which mouthful of a stage is being taken. */
export type BiteRole = 'bite' | 'chew' | 'finish';

/** Playback gain applied to the normalized recordings. */
const DEFAULT_LEVEL = 0.42;

let audioContext: AudioContext | undefined;
/** Decoded one-shots keyed by URL; a failed entry is dropped so a later try can heal it. */
const decoded = new Map<string, Promise<AudioBuffer | null>>();
let playbackGeneration = 0;
const active = new Map<AudioScheduledSourceNode, () => void>();

/** Stop current audio and invalidate any bite still awaiting the device or network. */
export function cancelBiteAudio(): void {
  playbackGeneration += 1;
  for (const [source, cleanup] of active) {
    try { source.stop(); } catch { /* Already stopped. */ }
    cleanup();
  }
}

function trackSource(source: AudioScheduledSourceNode, nodes: AudioNode[]): () => void {
  const cleanup = () => {
    active.delete(source);
    for (const node of nodes) node.disconnect();
  };
  active.set(source, cleanup);
  source.addEventListener('ended', cleanup, { once: true });
  return cleanup;
}

function audioContextConstructor(): typeof AudioContext | undefined {
  return globalThis.AudioContext
    ?? (globalThis as typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
}

function ensureContext(): AudioContext | undefined {
  const AudioContextConstructor = audioContextConstructor();
  if (!AudioContextConstructor) return undefined;
  if (!audioContext || audioContext.state === 'closed') audioContext = new AudioContextConstructor();
  return audioContext;
}

function decodeOnce(context: AudioContext, url: string): Promise<AudioBuffer | null> {
  const pending = decoded.get(url);
  if (pending) return pending;
  const loaded = (async () => {
    try {
      const response = await fetch(url);
      if (!response.ok) return null;
      return await context.decodeAudioData(await response.arrayBuffer());
    } catch {
      return null;
    }
  })();
  decoded.set(url, loaded);
  void loaded.then((buffer) => { if (!buffer) decoded.delete(url); });
  return loaded;
}

function soundUrls(sound: FoodSound | undefined): string[] {
  if (!sound) return [];
  const urls = [sound.bite, sound.finish, ...sound.chews].filter((url): url is string => Boolean(url));
  return [...new Set(urls)];
}

/**
 * Warm the audio graph while the player is still opening the menu, so the first bite
 * already has a decoded sample instead of silence or the fallback synth.
 */
export function primeBiteAudio(sound?: FoodSound): void {
  try {
    const context = ensureContext();
    if (!context) return;
    if (context.state === 'suspended') void context.resume().catch(() => {});
    for (const url of soundUrls(sound)) void decodeOnce(context, url);
  } catch {
    // Optional audio initialization must never break the tasting screen.
  }
}

/** URLs for this mouthful, most specific first. */
function urlsFor(sound: FoodSound, role: BiteRole): string[] {
  const preferred = role === 'bite' ? sound.bite : role === 'finish' ? sound.finish : undefined;
  return [...new Set([...(preferred ? [preferred] : []), ...rotated(sound.chews)])];
}

function rotated<T>(items: readonly T[]): T[] {
  if (items.length <= 1) return [...items];
  const start = Math.floor(Math.random() * items.length);
  return [...items.slice(start), ...items.slice(0, start)];
}

function playBuffer(context: AudioContext, buffer: AudioBuffer, level: number): void {
  const nodes: AudioNode[] = [];
  let source: AudioBufferSourceNode | undefined;
  let cleanup: (() => void) | undefined;
  try {
    source = context.createBufferSource(); nodes.push(source);
    const highpass = context.createBiquadFilter(); nodes.push(highpass);
    const gain = context.createGain(); nodes.push(gain);
    source.buffer = buffer;
    source.playbackRate.value = 0.95 + Math.random() * 0.1;
    highpass.type = 'highpass';
    highpass.frequency.value = 70;
    const start = context.currentTime;
    const duration = Math.min(buffer.duration / source.playbackRate.value, 0.5);
    gain.gain.value = level * (0.95 + Math.random() * 0.1);
    gain.gain.setValueAtTime(gain.gain.value, start);
    gain.gain.setValueAtTime(gain.gain.value, start + Math.max(0, duration - 0.06));
    gain.gain.linearRampToValueAtTime(0, start + duration);
    source.connect(highpass);
    highpass.connect(gain);
    gain.connect(context.destination);
    cleanup = trackSource(source, nodes);
    source.start(start);
    source.stop(start + duration);
  } catch (error) {
    try { source?.stop(); } catch { /* May never have started. */ }
    if (cleanup) cleanup();
    else for (const node of nodes) node.disconnect();
    throw error;
  }
}

/** Fallback for devices that cannot load the samples: the original soft two-beat mouth tone. */
function playSynthBite(context: AudioContext, finishing: boolean): void {
  const nodes: AudioNode[] = [];
  const sources: AudioScheduledSourceNode[] = [];
  const track = <T extends AudioNode>(node: T): T => { nodes.push(node); return node; };
  const voice = (source: AudioScheduledSourceNode, chain: AudioNode[], start: number, duration: number) => {
    sources.push(source);
    trackSource(source, [source, ...chain]);
    source.start(start);
    source.stop(start + duration);
  };
  const envelope = (peak: number, start: number, duration: number) => {
    const gain = track(context.createGain());
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(peak, start + 0.045);
    gain.gain.exponentialRampToValueAtTime(peak * 0.55, start + 0.10);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    gain.connect(context.destination);
    return gain;
  };

  try {
    // Rounded, slightly uneven jaw closures: soft mouth texture over a low body tone.
    const startTime = context.currentTime;
    const duration = 0.24;
    for (const [index, offset] of [0, 0.26].entries()) {
      const start = startTime + offset;
      const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * duration), context.sampleRate);
      const samples = buffer.getChannelData(0);
      let softened = 0;
      for (let i = 0; i < samples.length; i += 1) {
        const time = i / context.sampleRate;
        softened = softened * 0.94 + (Math.random() * 2 - 1) * 0.06;
        const mouth = 0.75 + 0.25 * Math.sin(time * Math.PI * 2 * 19 + index);
        samples[i] = softened * mouth * 3;
      }
      const mouth = track(context.createBufferSource());
      mouth.buffer = buffer;
      const filter = track(context.createBiquadFilter());
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(index === 0 ? 720 : 620, start);
      filter.frequency.exponentialRampToValueAtTime(280, start + duration);
      filter.Q.setValueAtTime(0.7, start);
      const mouthGain = envelope((finishing ? 0.12 : 0.1) * (index === 0 ? 1 : 0.88), start, duration);
      mouth.connect(filter);
      filter.connect(mouthGain);
      voice(mouth, [filter, mouthGain], start, duration);

      const body = track(context.createOscillator());
      body.type = 'sine';
      body.frequency.setValueAtTime(index === 0 ? 112 : 98, start);
      body.frequency.exponentialRampToValueAtTime(58, start + duration);
      const bodyGain = envelope(finishing ? 0.045 : 0.035, start, duration);
      body.connect(bodyGain);
      voice(body, [bodyGain], start, duration);
    }
  } catch {
    // Release even a partially constructed graph if the device becomes unavailable.
    for (const source of sources) {
      try { source.stop(); } catch { /* It may already have ended. */ }
    }
    for (const source of sources) active.get(source)?.();
    for (const node of nodes) node.disconnect();
  }
}

async function playBite(sound: FoodSound | undefined, role: BiteRole): Promise<void> {
  const generation = playbackGeneration;
  // A single deadline covers device resume, network and all fallback URLs.
  // Work may finish filling the decode cache later, but cannot play a stale bite.
  const ready = (async () => {
    const context = ensureContext();
    if (!context) return null;
    if (context.state === 'suspended') await context.resume();
    if (context.state !== 'running') return null;
    if (sound) {
      for (const url of urlsFor(sound, role)) {
        const buffer = await decodeOnce(context, url);
        if (buffer) return { context, buffer };
      }
    }
    return { context, buffer: null };
  })();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      ready,
      new Promise<null>(resolve => { timer = setTimeout(() => resolve(null), 35); }),
    ]);
    if (generation !== playbackGeneration) return;
    const context = result?.context ?? audioContext;
    if (!context || context.state !== 'running') return;
    if (result?.buffer) {
      try { playBuffer(context, result.buffer, sound?.level ?? DEFAULT_LEVEL); return; }
      catch { /* A failed recording graph is released before synthesizing. */ }
    }
    playSynthBite(context, role === 'finish');
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

export function biteFeedback(settings: Settings, sound?: FoodSound, role: BiteRole = 'chew'): void {
  if (settings.sound) {
    // Browser policy and device failures must never interrupt the interaction.
    void playBite(sound, role).catch(() => {});
  }

  if (settings.haptics) {
    try {
      const pattern = role === 'finish' ? [12, 30, 22] : role === 'bite' ? [14, 18, 12] : 12;
      globalThis.navigator?.vibrate?.(pattern);
    } catch {
      // Vibration is unsupported or blocked on this device.
    }
  }
}
