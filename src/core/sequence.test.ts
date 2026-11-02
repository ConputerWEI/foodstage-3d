import { describe, expect, it } from 'vitest';
import { createSequenceState, sequenceReducer, type SequenceState } from './sequence';
import { foods } from '../data/foods';

const stages = foods[0]!.stages;
function reduce(state: SequenceState, event: Parameters<typeof sequenceReducer>[2]) {
  return sequenceReducer(stages, state, event);
}
function bite(state: SequenceState, count = stages[state.stage]!.bites): SequenceState {
  for (let i = 0; i < count; i++) state = reduce(state, { type: 'BITE' });
  return state;
}
function complete(state: SequenceState) {
  return reduce(state, { type: 'FINAL_DONE', run: state.run, transition: state.transition });
}

describe('sequence', () => {
  it('does not accept bites before stage zero is ready or unrelated readiness', () => {
    const initial = createSequenceState(stages);
    expect(bite(initial, 20)).toBe(initial);
    const later = reduce(initial, { type: 'READY', stage: 1, run: initial.run });
    expect(later.phase).toBe('loading');
    const ready = reduce(later, { type: 'READY', stage: 0, run: initial.run });
    expect(ready).toMatchObject({ phase: 'idle', stage: 0, bites: 0 });
  });

  it('caps repeated bites at the stage threshold and advances after completion', () => {
    const initial = createSequenceState(stages, [0, 1]);
    const final = bite(initial, 20);
    expect(final).toMatchObject({ stage: 0, bites: stages[0]!.bites, phase: 'final' });
    const next = complete(final);
    expect(next).toMatchObject({ stage: 1, bites: 0, phase: 'idle' });
    expect(complete(next)).toBe(next);
  });

  it('keeps the current stage with full progress until the next asset is ready', () => {
    const waiting = bite(createSequenceState(stages, [0]));
    expect(waiting).toMatchObject({ stage: 0, bites: stages[0]!.bites, phase: 'waiting' });
    expect(complete(waiting)).toBe(waiting);
    const unrelated = reduce(waiting, { type: 'READY', stage: 3, run: waiting.run });
    expect(unrelated.phase).toBe('waiting');
    const final = reduce(unrelated, { type: 'READY', stage: 1, run: waiting.run });
    expect(final).toMatchObject({ stage: 0, bites: stages[0]!.bites, phase: 'final' });
    expect(complete(final)).toMatchObject({ stage: 1, phase: 'idle' });
  });

  it('uses the chosen food stage count and bite thresholds', () => {
    const snack = [{ ...stages[0]!, bites: 2 }, { ...stages[1]!, bites: 1 }];
    const state = sequenceReducer(snack, createSequenceState(snack, [0, 1]), { type: 'BITE' });
    const final = sequenceReducer(snack, state, { type: 'BITE' });
    expect(final.phase).toBe('final');
    const next = sequenceReducer(snack, final, { type: 'FINAL_DONE', run: final.run, transition: final.transition });
    const last = sequenceReducer(snack, next, { type: 'BITE' });
    expect(sequenceReducer(snack, last, { type: 'FINAL_DONE', run: last.run, transition: last.transition }).phase).toBe('finished');
  });

  it('finishes after every configured mouthful across the four stages', () => {
    let state = createSequenceState(stages, [0, 1, 2, 3]);
    for (let stage = 0; stage < stages.length; stage++) {
      const beforeLast = stages[stage]!.bites - 1;
      state = bite(state, beforeLast);
      expect(state).toMatchObject({ stage, bites: beforeLast, phase: 'idle' });
      state = complete(bite(state, 1));
    }
    expect(state).toMatchObject({ stage: 3, bites: stages[3]!.bites, phase: 'finished' });
  });

  it('restarts with cached readiness and ignores old callbacks', () => {
    const oldFinal = bite(createSequenceState(stages, [0, 1]));
    const restarted = reduce(oldFinal, { type: 'RESTART' });
    expect(restarted).toMatchObject({ stage: 0, bites: 0, phase: 'idle', run: 1 });
    expect(reduce(restarted, { type: 'FINAL_DONE', run: oldFinal.run, transition: oldFinal.transition })).toBe(restarted);
  });

  it('ignores stale or invalid readiness', () => {
    const state = reduce(createSequenceState(stages), { type: 'RESTART' });
    for (const stage of [-1, 4, 0.5, NaN]) expect(reduce(state, { type: 'READY', stage, run: state.run })).toBe(state);
    expect(reduce(state, { type: 'READY', stage: 0, run: state.run - 1 })).toBe(state);
  });
});
