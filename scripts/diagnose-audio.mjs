import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

// Use the existing preview/dev server; this diagnostic never starts another server.
const localChrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || (existsSync(localChrome) ? localChrome : undefined);
const browser = await chromium.launch({ executablePath, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.addInitScript(() => {
    const records = []; const inputs = []; const states = [];
    const onsetCache = new WeakMap();
    window.audioDiagnostic = { records, inputs, states };
    window.addEventListener('keydown', event => { if (event.key === ' ') inputs.push(performance.now()); }, true);
    new MutationObserver(() => {
      const experience = document.querySelector('[data-testid="experience"]');
      if (!experience) return;
      const value = `${experience.dataset.stage}/${experience.dataset.phase}`;
      if (states.at(-1)?.value !== value) states.push({ value, at: performance.now() });
    }).observe(document, { subtree: true, attributes: true, attributeFilter: ['data-stage', 'data-phase'] });
    const original = AudioContext.prototype.createBufferSource;
    AudioContext.prototype.createBufferSource = function () {
      const source = original.call(this); const start = source.start.bind(source);
      source.start = (when = 0, offset = 0, duration) => {
        const at = performance.now();
        const audioTime = this.currentTime;
        const inputAt = inputs.at(-1) ?? 0;
        const state = states.at(-1);
        start(when, offset, duration);
        const buffer = source.buffer;
        const cached = buffer && onsetCache.get(buffer);
        const onsets = cached ?? {};
        if (buffer && !cached) for (const db of [-60, -50, -40, -30]) {
          const threshold = 10 ** (db / 20); let first = buffer.length;
          for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
            const samples = buffer.getChannelData(channel);
            const found = samples.findIndex(sample => Math.abs(sample) >= threshold);
            if (found >= 0) first = Math.min(first, found);
          }
          onsets[db] = first / buffer.sampleRate * 1000;
        }
        if (buffer && !cached) onsetCache.set(buffer, onsets);
        records.push({ at, inputMs: at - inputAt, state, duration: buffer?.duration, rate: source.playbackRate.value, scheduledMs: Math.max(0, when - audioTime) * 1000, offsetMs: offset * 1000, onsets, baseLatencyMs: this.baseLatency * 1000, outputLatencyMs: this.outputLatency * 1000 });
      };
      return source;
    };
  });
  await page.goto(process.env.AUDIO_DIAGNOSTIC_URL ?? 'http://127.0.0.1:5173');
  await page.getByRole('button', { name: '设置' }).click();
  await page.getByRole('checkbox', { name: '声音' }).check();
  await page.getByRole('button', { name: '完成', exact: true }).click();
  await page.getByRole('button', { name: '翻开菜单' }).click();
  await page.getByRole('button', { name: '开始品尝' }).click();
  const area = page.getByRole('button', { name: '经典汉堡' });
  for (let stage = 0; stage < 4; stage++) {
    await page.waitForFunction(stage => document.querySelector('[data-testid="experience"]')?.getAttribute('data-stage') === String(stage), stage);
    for (let bite = 0; bite < (stage % 2 === 0 ? 5 : 6); bite++) {
      await page.waitForFunction(() => document.querySelector('.food-input')?.getAttribute('aria-disabled') === 'false');
      await area.focus(); await page.keyboard.press('Space');
    }
  }
  await page.getByRole('button', { name: '再吃一次' }).waitFor();
  await page.waitForFunction(() => window.audioDiagnostic.records.some(record => record.duration > 1.15 && record.duration < 1.2));
  const result = await page.evaluate(() => window.audioDiagnostic);
  const victory = result.records.find(record => record.duration > 1.15 && record.duration < 1.2);
  const bites = result.records.filter(record => record.duration >= .5 && record.duration <= 1);
  const transitions = result.records.filter(record => record.duration > .29 && record.duration < .30);
  const range = values => [Math.min(...values), Math.max(...values)].map(value => Number(value.toFixed(2)));
  console.log(JSON.stringify({
    biteCount: bites.length,
    warmInputToStartMs: range(bites.map(record => record.inputMs)),
    biteOnsetAtMinus40DbMs: range(bites.map(record => record.onsets[-40])),
    transitionInputToStartMs: transitions.map(record => Number(record.inputMs.toFixed(2))),
    transitionUiToStartMs: transitions.map(record => Number((record.at - record.state.at).toFixed(2))),
    victory: { uiToStartMs: victory.at - victory.state.at, scheduledMs: victory.scheduledMs, onsetAtMinus40DbMs: victory.onsets[-40], uiToDecodedOnsetMs: victory.at - victory.state.at + victory.scheduledMs + Math.max(0, victory.onsets[-40] - victory.offsetMs) / victory.rate }, weakHardwareEstimateNote: 'Decoded onset is measured from samples; speaker onset is not captured. baseLatency/outputLatency are browser estimates.',
    baseLatencyMs: range(result.records.map(record => record.baseLatencyMs)),
    outputLatencyMs: range(result.records.map(record => record.outputLatencyMs)),
  }, null, 2));
  if (process.env.AUDIO_DIAGNOSTIC_VERBOSE) console.log(JSON.stringify(result, null, 2));
  assert(victory.scheduledMs <= 35, `Victory is scheduled ${victory.scheduledMs.toFixed(1)}ms after finished UI`);
  const victoryUiToDecodedOnsetMs = victory.at - victory.state.at + victory.scheduledMs + Math.max(0, victory.onsets[-40] - victory.offsetMs) / victory.rate;
  assert(victoryUiToDecodedOnsetMs < 100, `Victory waveform onset lagged finished UI by ${victoryUiToDecodedOnsetMs.toFixed(1)}ms before device latency`);
  assert.equal(bites.length, 22, 'Expected every mouthful to use decoded recordings, not synth fallback');
  assert(bites.every(record => record.inputMs < 100), 'Warm input-to-source.start exceeded 100ms');
  assert(bites.every(record => record.onsets[-40] < 15), 'Bite recording contains significant leading silence');
  assert(transitions.every(record => record.at - record.state.at < 100), 'Transition cue lagged behind its UI');
} finally { await browser.close(); }
