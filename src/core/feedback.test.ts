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
    const parameter = () => {
      const result = {
        value: 0.42,
        setValueAtTime: vi.fn((value: number, _time: number) => { result.value = value; }),
        cancelScheduledValues: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(),
      };
      return result;
    };
    const result = {
      kind, type: '', buffer: null as unknown, frequency: parameter(), gain: parameter(), Q: parameter(), playbackRate: parameter(),
      connect: vi.fn(), disconnect: vi.fn(), start: vi.fn((_when?: number) => {}), stop: vi.fn((_when?: number) => {}),
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
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('milestoneFeedback', () => {
  it('raises transition pitch slightly by stage without randomizing victory', async () => {
    const { nodes } = audioBoundary();
    stubFetch();
    const random = vi.spyOn(Math, 'random');
    const { milestoneFeedback } = await import('./feedback');
    for (const stage of [1, 2, 3]) {
      milestoneFeedback(settings, 'transition', stage);
      await flush();
    }
    milestoneFeedback(settings, 'complete', 3);
    await flush();
    expect(nodes.filter((entry) => entry.kind === 'source').map((entry) => entry.playbackRate.value)).toEqual([1, 1.03, 1.06, 1]);
    expect(random).not.toHaveBeenCalled();
    const source = nodes.find((entry) => entry.kind === 'source')!;
    source.addEventListener.mock.calls.find(([event]) => event === 'ended')![1]();
    expect(nodes[0]!.disconnect).toHaveBeenCalled();
    expect(nodes[1]!.disconnect).toHaveBeenCalled();
  });

  it.each(['fetch', 'resume'] as const)('drops a cue after the 35ms %s deadline while preserving warm cache', async (delay) => {
    vi.useFakeTimers();
    const { context, nodes } = audioBoundary(delay === 'resume' ? 'suspended' : 'running');
    const fetch = stubFetch();
    let release!: () => void;
    if (delay === 'fetch') {
      fetch.mockImplementationOnce(() => new Promise((resolve) => {
        release = () => resolve({ ok: true, arrayBuffer: async () => new ArrayBuffer(64) });
      }));
    } else {
      context.resume.mockImplementationOnce(() => new Promise<void>((resolve) => {
        release = () => { context.state = 'running'; resolve(); };
      }));
    }
    const { milestoneFeedback } = await import('./feedback');
    milestoneFeedback(settings, 'complete', 3);
    await vi.advanceTimersByTimeAsync(35);
    release();
    await vi.advanceTimersByTimeAsync(1);
    expect(nodes).toHaveLength(0);
    expect(context.createOscillator).not.toHaveBeenCalled();
    milestoneFeedback(settings, 'complete', 3);
    await vi.advanceTimersByTimeAsync(0);
    expect(nodes.filter((entry) => entry.kind === 'source')).toHaveLength(1);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('invalidates pending milestone playback when cancelled before readiness', async () => {
    vi.useFakeTimers();
    const { nodes } = audioBoundary();
    let release!: () => void;
    vi.stubGlobal('fetch', vi.fn(() => new Promise((resolve) => {
      release = () => resolve({ ok: true, arrayBuffer: async () => new ArrayBuffer(64) });
    })));
    const { milestoneFeedback, cancelBiteAudio } = await import('./feedback');
    milestoneFeedback(settings, 'transition', 2);
    cancelBiteAudio();
    release();
    await vi.advanceTimersByTimeAsync(0);
    expect(nodes).toHaveLength(0);
    milestoneFeedback(settings, 'transition', 2);
    await vi.advanceTimersByTimeAsync(0);
    expect(nodes.filter((entry) => entry.kind === 'source')).toHaveLength(1);
  });

  it.each(['gain', 'start'] as const)('cleans partial cue nodes when %s construction fails without a synth fallback', async (failure) => {
    const { context, nodes } = audioBoundary();
    stubFetch();
    if (failure === 'gain') context.createGain.mockImplementationOnce(() => { throw new Error('device unavailable'); });
    else {
      const makeSource = context.createBufferSource.getMockImplementation()!;
      context.createBufferSource.mockImplementationOnce(() => {
        const source = makeSource();
        source.start.mockImplementationOnce(() => { throw new Error('device unavailable'); });
        return source;
      });
    }
    const { milestoneFeedback } = await import('./feedback');
    expect(() => milestoneFeedback(settings, 'complete', 3)).not.toThrow();
    await flush();
    expect(nodes.length).toBeGreaterThan(0);
    expect(nodes.every((entry) => entry.disconnect.mock.calls.length > 0)).toBe(true);
    expect(context.createOscillator).not.toHaveBeenCalled();
    expect(context.close).not.toHaveBeenCalled();
  });

  it('stays optional when muted, offline, or device resume is rejected', async () => {
    const { context, Constructor, nodes } = audioBoundary('suspended');
    stubFetch(false);
    const { milestoneFeedback, primeMilestoneAudio } = await import('./feedback');
    milestoneFeedback({ ...settings, sound: false }, 'complete', 3);
    await flush();
    expect(Constructor).not.toHaveBeenCalled();
    context.resume.mockRejectedValueOnce(new Error('blocked'));
    milestoneFeedback(settings, 'transition', 1);
    await flush();
    primeMilestoneAudio();
    await flush();
    milestoneFeedback(settings, 'complete', 3);
    await flush();
    expect(nodes).toHaveLength(0);
  });

  it.each([true, false])('keeps cues and chewing independent when recording availability is %s', async (recordingAvailable) => {
    const { nodes } = audioBoundary();
    const fetch = stubFetch();
    fetch.mockImplementation(async (url) => {
      if (!recordingAvailable && url === singleChew.chews[0]) throw new Error('missing chew');
      return { ok: true, arrayBuffer: async () => new ArrayBuffer(64) };
    });
    const { biteFeedback, milestoneFeedback, cancelBiteAudio } = await import('./feedback');
    biteFeedback(settings, singleChew);
    await flush();
    const chewing = nodes.filter((entry) => entry.kind === 'source' || entry.kind === 'oscillator');
    const stopsBeforeCue = chewing.map((entry) => entry.stop.mock.calls.length);
    milestoneFeedback(settings, 'complete', 3);
    await flush();
    expect(chewing.map((entry) => entry.stop.mock.calls.length)).toEqual(stopsBeforeCue);
    const cue = nodes.filter((entry) => entry.kind === 'source').at(-1)!;
    biteFeedback(settings, singleChew);
    await flush();
    expect(cue.stop).not.toHaveBeenCalled();
    expect(cue.disconnect).not.toHaveBeenCalled();

    cancelBiteAudio();
    expect(cue.stop).toHaveBeenCalledWith();
    expect(nodes.every((entry) => entry.disconnect.mock.calls.length > 0)).toBe(true);
  });

  it('warms both cues without playback and reuses their decoded samples', async () => {
    const { context, nodes } = audioBoundary('suspended');
    const fetch = stubFetch();
    const { primeMilestoneAudio, milestoneFeedback } = await import('./feedback');
    primeMilestoneAudio();
    await flush();
    expect(fetch.mock.calls.map(([url]) => url)).toEqual([
      '/audio/ui/stage-transition.wav', '/audio/ui/complete.ogg',
    ]);
    expect(context.resume).toHaveBeenCalledOnce();
    expect(nodes).toHaveLength(0);

    milestoneFeedback(settings, 'transition', 1);
    await flush();
    milestoneFeedback(settings, 'complete', 3);
    await flush();
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(context.decodeAudioData).toHaveBeenCalledTimes(2);
    const sources = nodes.filter((entry) => entry.kind === 'source');
    expect(sources).toHaveLength(2);
    expect(sources[0]!.start).toHaveBeenCalledWith(4);
    // Finished UI already follows the last chewing animation; its cue must start now.
    expect(sources[1]!.start).toHaveBeenCalledWith(4);
    expect(sources[1]!.playbackRate.value).toBe(1);
    expect(nodes.filter((entry) => entry.kind === 'gain').map((entry) => entry.gain.value)).toEqual([0.25, 0.38]);
  });
});

describe('biteFeedback', () => {
  it.each([{ chews: [] }, sound])('silences drink mouth audio while preserving haptics and milestone cues for %j', async (drinkSound) => {
    const { context, nodes } = audioBoundary();
    const fetch = stubFetch();
    const vibrate = vi.fn();
    vi.stubGlobal('navigator', { vibrate });
    const { biteFeedback, milestoneFeedback } = await import('./feedback');
    for (const role of ['bite', 'chew', 'finish'] as const) {
      biteFeedback({ ...settings, haptics: true }, drinkSound, role, 'drink');
      await flush();
    }
    expect(nodes).toHaveLength(0);
    expect(context.createOscillator).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
    expect(vibrate.mock.calls.map(([pattern]) => pattern)).toEqual([[14, 18, 12], 12, [12, 30, 22]]);
    milestoneFeedback(settings, 'transition', 1);
    await flush();
    milestoneFeedback(settings, 'complete', 3);
    await flush();
    expect(fetch.mock.calls.map(([url]) => url)).toEqual(['/audio/ui/stage-transition.wav', '/audio/ui/complete.ogg']);
    const sources = nodes.filter(entry => entry.kind === 'source');
    expect(sources).toHaveLength(2);
    expect(sources.every(source => source.start.mock.calls.length === 1)).toBe(true);
    expect(context.createOscillator).not.toHaveBeenCalled();
  });
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
    expect(gains[0]!.gain.value).toBeGreaterThanOrEqual(0.399);
    expect(gains[0]!.gain.value).toBeLessThanOrEqual(0.441);
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
    expect(gains[0]!.gain.value).toBeGreaterThanOrEqual(0.285);
    expect(gains[0]!.gain.value).toBeLessThanOrEqual(0.315);
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
    expect(Constructor).toHaveBeenCalledWith({ latencyHint: 'interactive' });
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

  it('contains an AudioContext constructor failure while priming', async () => {
    const { Constructor } = audioBoundary();
    Constructor.mockImplementation(() => { throw new Error('audio device unavailable'); });
    const fetch = stubFetch();
    const { primeBiteAudio } = await import('./feedback');

    expect(() => primeBiteAudio(sound)).not.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('falls back promptly during a slow fetch and never plays its late recording', async () => {
    vi.useFakeTimers();
    const { context, nodes, decoded } = audioBoundary();
    let resolveFetch!: (response: { ok: boolean; arrayBuffer: () => Promise<ArrayBuffer> }) => void;
    vi.stubGlobal('fetch', vi.fn(() => new Promise((resolve) => { resolveFetch = resolve; })));
    const { biteFeedback } = await import('./feedback');

    biteFeedback(settings, singleChew, 'chew');
    await vi.advanceTimersByTimeAsync(40);
    expect(context.createOscillator).toHaveBeenCalledTimes(2);
    expect(nodes.filter((entry) => entry.kind === 'source')).toHaveLength(2);

    resolveFetch({ ok: true, arrayBuffer: async () => new ArrayBuffer(64) });
    await vi.advanceTimersByTimeAsync(1000);
    expect(context.createOscillator).toHaveBeenCalledTimes(2);
    expect(nodes.filter((entry) => entry.kind === 'source')).toHaveLength(2);
    expect(nodes.some((entry) => decoded.includes(entry.buffer as { duration: number }))).toBe(false);
  });

  it('cancels an active recording and disconnects its graph', async () => {
    const { nodes } = audioBoundary();
    stubFetch();
    const { biteFeedback, cancelBiteAudio } = await import('./feedback');
    biteFeedback(settings, singleChew, 'chew');
    await flush();
    const source = nodes.find((entry) => entry.kind === 'source')!;
    expect(source.start).toHaveBeenCalled();

    expect(cancelBiteAudio).toBeTypeOf('function');
    cancelBiteAudio();
    expect(source.stop.mock.calls.some((call) => call.length === 0)).toBe(true);
    expect(nodes.every((entry) => entry.disconnect.mock.calls.length > 0)).toBe(true);
  });

  it('cancels every active and scheduled synth voice', async () => {
    const { nodes } = audioBoundary();
    stubFetch(false);
    const { biteFeedback, cancelBiteAudio } = await import('./feedback');
    biteFeedback(settings, singleChew, 'chew');
    await flush();
    const voices = nodes.filter((entry) => entry.kind === 'source' || entry.kind === 'oscillator');
    expect(voices).toHaveLength(4);

    cancelBiteAudio();
    expect(voices.every((entry) => entry.stop.mock.calls.some((call) => call.length === 0))).toBe(true);
    expect(nodes.every((entry) => entry.disconnect.mock.calls.length > 0)).toBe(true);
  });

  it('invalidates pending playback on cancellation but allows a later bite', async () => {
    vi.useFakeTimers();
    const { nodes } = audioBoundary();
    let resolveFetch!: (response: { ok: boolean; arrayBuffer: () => Promise<ArrayBuffer> }) => void;
    vi.stubGlobal('fetch', vi.fn(() => new Promise((resolve) => { resolveFetch = resolve; })));
    const { biteFeedback, cancelBiteAudio } = await import('./feedback');
    biteFeedback(settings, singleChew, 'chew');
    cancelBiteAudio();
    resolveFetch({ ok: true, arrayBuffer: async () => new ArrayBuffer(64) });
    await vi.advanceTimersByTimeAsync(100);
    expect(nodes).toHaveLength(0);

    biteFeedback(settings, singleChew, 'chew');
    await vi.advanceTimersByTimeAsync(40);
    expect(nodes.filter((entry) => entry.kind === 'source')).toHaveLength(1);
    expect(nodes.find((entry) => entry.kind === 'source')!.start).toHaveBeenCalled();
  });

  it.each(['bite', 'finish'] as const)('uses an available regular chew when the dedicated %s recording fails', async (role) => {
    const { context, nodes, decoded } = audioBoundary();
    const fetch = stubFetch();
    fetch.mockImplementation(async (url) => {
      if (url !== singleChew.chews[0]) throw new TypeError('missing dedicated recording');
      return { ok: true, arrayBuffer: async () => new ArrayBuffer(64) };
    });
    const { biteFeedback } = await import('./feedback');
    biteFeedback(settings, { ...sound, chews: singleChew.chews }, role);
    await flush();

    expect(fetch).toHaveBeenCalledWith(role === 'bite' ? sound.bite : sound.finish);
    expect(fetch).toHaveBeenCalledWith(singleChew.chews[0]);
    const sources = nodes.filter((entry) => entry.kind === 'source');
    expect(sources).toHaveLength(1);
    expect(sources[0]!.buffer).toBe(decoded[0]);
    expect(context.createOscillator).not.toHaveBeenCalled();
  });

  it('disconnects the recorded graph if starting its source throws, then uses the synth', async () => {
    const { context, nodes } = audioBoundary();
    stubFetch();
    const makeSource = context.createBufferSource.getMockImplementation()!;
    context.createBufferSource.mockImplementationOnce(() => {
      const source = makeSource();
      source.start.mockImplementation(() => { throw new Error('device interrupted'); });
      return source;
    });
    const { biteFeedback } = await import('./feedback');
    expect(() => biteFeedback(settings, singleChew, 'chew')).not.toThrow();
    await flush();

    const recordedGraph = nodes.slice(0, 3);
    expect(recordedGraph.map((entry) => entry.kind)).toEqual(['source', 'filter', 'gain']);
    expect(recordedGraph.every((entry) => entry.disconnect.mock.calls.length > 0)).toBe(true);
    expect(context.createOscillator).toHaveBeenCalledTimes(2);
  });

  it.each([0.2, 2])('plays the full %s-second recording and fades its natural tail', async (duration) => {
    const { context, nodes } = audioBoundary();
    context.decodeAudioData.mockResolvedValue({ duration });
    stubFetch();
    const { biteFeedback } = await import('./feedback');
    biteFeedback(settings, singleChew, 'chew');
    await flush();

    const source = nodes.find((entry) => entry.kind === 'source')!;
    const gain = nodes.find((entry) => entry.kind === 'gain')!.gain;
    const start = source.start.mock.calls[0]![0] as number;
    const stop = source.stop.mock.calls[0]?.[0] as number;
    const durationInClock = duration / source.playbackRate.value;
    expect(stop - start).toBeCloseTo(durationInClock);
    expect(gain.setValueAtTime).toHaveBeenCalledWith(expect.any(Number), start);
    const fade = gain.linearRampToValueAtTime.mock.calls.find(([level]) => level === 0);
    expect(fade).toBeDefined();
    expect(fade![1]).toBeCloseTo(stop);
    expect(gain.setValueAtTime).toHaveBeenCalledWith(expect.any(Number), stop - 0.06);
  });

  it('retires the previous recording with a 60ms audio-clock crossfade', async () => {
    const { context, nodes } = audioBoundary();
    stubFetch();
    const { biteFeedback } = await import('./feedback');
    biteFeedback(settings, singleChew, 'chew');
    await flush();
    const previousGainAtClick = nodes.find((entry) => entry.kind === 'gain')!.gain;
    previousGainAtClick.value = 0.17;
    context.currentTime = 4.32;
    biteFeedback(settings, singleChew, 'chew');
    await flush();

    const sources = nodes.filter((entry) => entry.kind === 'source');
    const gains = nodes.filter((entry) => entry.kind === 'gain');
    const previousGain = gains[0]!.gain;
    const previousSource = sources[0]!;
    expect(previousGain.cancelScheduledValues).toHaveBeenCalledWith(4.32);
    expect(previousGain.setValueAtTime).toHaveBeenCalledWith(0.17, 4.32);
    expect(previousGain.linearRampToValueAtTime).toHaveBeenCalledWith(0, 4.38);
    expect(previousSource.stop).toHaveBeenCalledWith(4.38);
    expect(gains[1]!.gain.setValueAtTime).toHaveBeenCalledWith(expect.any(Number), 4.32);
    expect(gains[1]!.gain.linearRampToValueAtTime).toHaveBeenCalledWith(expect.any(Number), 4.332);
  });

  it('stops an already retiring tail before a third rapid recording can overlap it', async () => {
    const { context, nodes } = audioBoundary();
    stubFetch();
    const { biteFeedback, cancelBiteAudio } = await import('./feedback');
    biteFeedback(settings, singleChew);
    await flush();
    context.currentTime += 0.02;
    biteFeedback(settings, singleChew);
    await flush();
    const first = nodes.find((entry) => entry.kind === 'source')!;
    context.currentTime += 0.02;
    biteFeedback(settings, singleChew);
    await flush();
    expect(first.stop.mock.calls.some((call) => call.length === 0)).toBe(true);
    expect(first.disconnect).toHaveBeenCalled();
    cancelBiteAudio();
    expect(nodes.every((entry) => entry.disconnect.mock.calls.length > 0)).toBe(true);
  });

  it('stops every fallback voice when a recording takes over', async () => {
    const { nodes } = audioBoundary();
    const fetch = stubFetch(false);
    const { biteFeedback } = await import('./feedback');
    biteFeedback(settings, singleChew);
    await flush();
    const voices = nodes.filter((entry) => entry.kind === 'source' || entry.kind === 'oscillator');
    fetch.mockImplementation(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(64) }));
    biteFeedback(settings, singleChew);
    await flush();
    expect(voices).toHaveLength(4);
    expect(voices.every((entry) => entry.stop.mock.calls.some((call) => call.length === 0))).toBe(true);
    expect(voices.every((entry) => entry.disconnect.mock.calls.length > 0)).toBe(true);
  });

  it('replaces prior synth voices instead of stacking fallback mouthfuls', async () => {
    const { nodes } = audioBoundary();
    stubFetch(false);
    const { biteFeedback } = await import('./feedback');
    biteFeedback(settings, singleChew);
    await flush();
    const firstVoices = nodes.filter((entry) => entry.kind === 'source' || entry.kind === 'oscillator');
    biteFeedback(settings, singleChew);
    await flush();
    expect(firstVoices.every((entry) => entry.stop.mock.calls.some((call) => call.length === 0))).toBe(true);
    expect(firstVoices.every((entry) => entry.disconnect.mock.calls.length > 0)).toBe(true);
  });

  it('varies the configured absolute recording level within five percent', async () => {
    const { nodes } = audioBoundary();
    stubFetch();
    const random = vi.spyOn(Math, 'random').mockReturnValue(0);
    const { biteFeedback } = await import('./feedback');
    biteFeedback(settings, { ...singleChew, level: 0.3 }, 'chew');
    await flush();
    random.mockReturnValue(0.999999);
    biteFeedback(settings, { ...singleChew, level: 0.3 }, 'chew');
    await flush();

    const levels = nodes.filter((entry) => entry.kind === 'gain').map((entry) => entry.gain.value);
    expect(levels).toHaveLength(2);
    for (const level of levels) {
      expect(level).toBeGreaterThanOrEqual(0.285);
      expect(level).toBeLessThanOrEqual(0.315);
    }
    expect(Math.abs(levels[1]! - levels[0]!)).toBeGreaterThan(0.02);
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
