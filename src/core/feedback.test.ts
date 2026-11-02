import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FoodSound } from '../data/foods';
import type { Settings } from './settings';

const settings: Settings = { sound: true, haptics: false, motion: 'system', sensitivity: 1 };

const sound: FoodSound = {
  bite: '/audio/test/bite.mp3',
  chews: ['/audio/test/chew-1.mp3', '/audio/test/chew-2.mp3'],
  finish: '/audio/test/finish.mp3',
};

const singleChew: FoodSound = { chews: ['/audio/test/chew-1.mp3'] };

/** Let the async audio path (resume, decode, playback) settle before asserting. */
const flush = () => new Promise((resolve) => { setTimeout(resolve, 0); });

function audioBoundary(state = 'running') {
  const nodes: ReturnType<typeof node>[] = [];
  function node(kind: string) {
    const parameter = () => ({ value: 0, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() });
    const result = {
      kind, type: '', buffer: null as unknown, frequency: parameter(), gain: parameter(), Q: parameter(), playbackRate: parameter(),
      connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn(),
      addEventListener: vi.fn(),
    };
    return result;
  }
  const makeNode = (kind: string) => {
    const result = node(kind);
    nodes.push(result);
    return result;
  };
  const samples: Float32Array[] = [];
  const decoded: { duration: number }[] = [];
  const context = {
    state, currentTime: 4, sampleRate: 48000, destination: {},
    resume: vi.fn(async () => { context.state = 'running'; }), close: vi.fn(),
    decodeAudioData: vi.fn(async () => {
      const buffer = { duration: 0.6 };
      decoded.push(buffer);
      return buffer;
    }),
    createOscillator: vi.fn(() => makeNode('oscillator')),
    createGain: vi.fn(() => makeNode('gain')),
    createBiquadFilter: vi.fn(() => makeNode('filter')),
    createBufferSource: vi.fn(() => makeNode('source')),
    createBuffer: vi.fn((_channels: number, length: number) => {
      const data = new Float32Array(length);
      samples.push(data);
      return { getChannelData: () => data };
    }),
  };
  const Constructor = vi.fn(function () { return context; });
  vi.stubGlobal('AudioContext', Constructor);
  return { context, Constructor, nodes, samples, decoded };
}

function stubFetch(ok = true) {
  const fetch = vi.fn(async (input: RequestInfo | URL) => {
    if (!ok) throw new TypeError('offline');
    return { ok: true, arrayBuffer: async () => new ArrayBuffer(64) };
  });
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

beforeEach(() => { vi.resetModules(); });
afterEach(() => { vi.unstubAllGlobals(); });

describe('biteFeedback', () => {
  it('does not create audio when muted, while allowing optional finishing vibration', async () => {
    const { Constructor } = audioBoundary();
    const vibrate = vi.fn();
    vi.stubGlobal('navigator', { vibrate });
    const { biteFeedback } = await import('./feedback');
    biteFeedback({ ...settings, sound: false, haptics: true }, sound, 'finish');
    await flush();
    expect(Constructor).not.toHaveBeenCalled();
    expect(vibrate).toHaveBeenCalledWith([12, 30, 22]);
  });

  it('plays the opening bite sample for the first bite of a stage', async () => {
    const { context, nodes, decoded } = audioBoundary();
    const fetch = stubFetch(true);
    const { biteFeedback } = await import('./feedback');
    biteFeedback(settings, sound, 'bite');
    await flush();

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0]![0]).toBe(sound.bite);
    const [source] = nodes.filter((entry) => entry.kind === 'source');
    expect(source!.buffer).toBe(decoded[0]);
    expect(source!.playbackRate.value).toBeGreaterThanOrEqual(0.95);
    expect(source!.playbackRate.value).toBeLessThanOrEqual(1.05);
    expect(source!.start).toHaveBeenCalledWith(context.currentTime);
    expect(context.createBuffer).not.toHaveBeenCalled();
    expect(context.createOscillator).not.toHaveBeenCalled();

    const filters = nodes.filter((entry) => entry.kind === 'filter');
    expect(filters[0]!.type).toBe('highpass');
    const gains = nodes.filter((entry) => entry.kind === 'gain');
    expect(gains[0]!.gain.value).toBeCloseTo(0.42);
    expect(source!.connect).toHaveBeenCalledWith(filters[0]);
    const ended = source!.addEventListener.mock.calls.find(([event]) => event === 'ended')!;
    ended[1]();
    expect(source!.disconnect).toHaveBeenCalled();
    expect(filters[0]!.disconnect).toHaveBeenCalled();
    expect(gains[0]!.disconnect).toHaveBeenCalled();
  });

  it('plays the closing sample for the last bite of a stage', async () => {
    const { nodes } = audioBoundary();
    const fetch = stubFetch(true);
    const { biteFeedback } = await import('./feedback');
    biteFeedback(settings, sound, 'finish');
    await flush();
    expect(fetch.mock.calls[0]![0]).toBe(sound.finish);
    expect(nodes.filter((entry) => entry.kind === 'source')).toHaveLength(1);
  });

  it('picks one of the regular mouthfuls and reuses the decoded buffer', async () => {
    const { context } = audioBoundary();
    const fetch = stubFetch(true);
    const { biteFeedback } = await import('./feedback');
    biteFeedback(settings, singleChew, 'chew');
    await flush();
    biteFeedback(settings, singleChew, 'chew');
    await flush();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(context.decodeAudioData).toHaveBeenCalledTimes(1);
    expect(context.createBufferSource).toHaveBeenCalledTimes(2);
  });

  it('falls back to a regular mouthful when a food has no dedicated bite or finish', async () => {
    const { nodes } = audioBoundary();
    const fetch = stubFetch(true);
    const { biteFeedback } = await import('./feedback');
    biteFeedback(settings, singleChew, 'finish');
    await flush();
    expect(fetch.mock.calls[0]![0]).toBe(singleChew.chews[0]);
    expect(nodes.filter((entry) => entry.kind === 'source')).toHaveLength(1);
  });

  it('warms every sample of the selected food before the first bite', async () => {
    const { context, nodes } = audioBoundary();
    const fetch = stubFetch(true);
    const { primeBiteAudio } = await import('./feedback');
    primeBiteAudio(sound);
    await flush();
    expect(fetch).toHaveBeenCalledTimes(4);
    expect(context.decodeAudioData).toHaveBeenCalledTimes(4);
    expect(nodes.filter((entry) => entry.kind === 'source')).toHaveLength(0);
  });

  it('honours a per-food level override', async () => {
    const { nodes } = audioBoundary();
    stubFetch(true);
    const { biteFeedback } = await import('./feedback');
    biteFeedback(settings, { ...singleChew, level: 0.3 }, 'chew');
    await flush();
    const gains = nodes.filter((entry) => entry.kind === 'gain');
    expect(gains[0]!.gain.value).toBeCloseTo(0.3);
  });

  it('falls back to the two-beat mouth tone when the samples cannot load', async () => {
    const { context, nodes, samples } = audioBoundary();
    stubFetch(false);
    const { biteFeedback } = await import('./feedback');
    biteFeedback(settings, sound, 'chew');
    await flush();

    const noises = nodes.filter((entry) => entry.kind === 'source');
    const tones = nodes.filter((entry) => entry.kind === 'oscillator');
    expect(noises).toHaveLength(2);
    expect(tones).toHaveLength(2);
    expect(context.decodeAudioData).not.toHaveBeenCalled();
    expect(samples.every((data) => data.some((sample) => sample !== 0))).toBe(true);
    expect(noises[0]!.start).toHaveBeenCalledWith(context.currentTime);
    for (const [index, noise] of noises.entries()) {
      const filter = nodes.filter((entry) => entry.kind === 'filter')[index]!;
      expect(noise.connect).toHaveBeenCalledWith(filter);
      expect(filter.type).toBe('lowpass');
      expect(tones[index]!.type).toBe('sine');
    }
  });

  it('retries a failed sample instead of staying silent forever', async () => {
    const { context } = audioBoundary();
    const fetch = stubFetch(false);
    const { biteFeedback } = await import('./feedback');
    biteFeedback(settings, singleChew, 'chew');
    await flush();
    expect(fetch).toHaveBeenCalledTimes(1);

    fetch.mockImplementation(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(64) }));
    biteFeedback(settings, singleChew, 'chew');
    await flush();
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(context.decodeAudioData).toHaveBeenCalledTimes(1);
  });

  it('reuses one audio context across bites and resumes suspended audio', async () => {
    const { context, Constructor } = audioBoundary('suspended');
    stubFetch(true);
    const { biteFeedback } = await import('./feedback');
    biteFeedback(settings, singleChew, 'chew');
    await flush();
    biteFeedback(settings, singleChew, 'chew');
    await flush();
    expect(Constructor).toHaveBeenCalledOnce();
    expect(context.resume).toHaveBeenCalledOnce();
    expect(context.createBufferSource).toHaveBeenCalledTimes(2);
  });

  it('releases scheduled pulses and a partial graph if audio construction fails', async () => {
    const { context, nodes } = audioBoundary();
    stubFetch(false);
    context.createBufferSource.mockImplementationOnce(() => {
      const source = context.createOscillator();
      source.kind = 'noise';
      return source;
    }).mockImplementationOnce(() => { throw new Error('device unavailable'); });
    const { biteFeedback } = await import('./feedback');
    expect(() => biteFeedback(settings, sound, 'chew')).not.toThrow();
    await flush();
    const sources = nodes.filter((entry) => entry.kind === 'noise' || entry.kind === 'oscillator');
    expect(sources.length).toBeGreaterThan(0);
    expect(sources.every((source) => source.stop.mock.calls.some((call) => call.length === 0))).toBe(true);
    expect(nodes.every((entry) => entry.disconnect.mock.calls.length > 0)).toBe(true);
    expect(context.close).not.toHaveBeenCalled();
  });

  it('contains rejected resume promises without scheduling audio', async () => {
    const { context } = audioBoundary('suspended');
    stubFetch(true);
    context.resume.mockRejectedValue(new Error('blocked'));
    const { biteFeedback } = await import('./feedback');
    expect(() => biteFeedback(settings, sound, 'chew')).not.toThrow();
    await flush();
    expect(context.createBufferSource).not.toHaveBeenCalled();
  });

  it('stays silent but stable when a food ships no sounds at all', async () => {
    const { context, nodes } = audioBoundary();
    const { biteFeedback } = await import('./feedback');
    expect(() => biteFeedback(settings, undefined, 'chew')).not.toThrow();
    await flush();
    expect(nodes.filter((entry) => entry.kind === 'source')).toHaveLength(2);
    expect(context.close).not.toHaveBeenCalled();
  });
});
