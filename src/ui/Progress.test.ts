import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Progress } from './Progress';
import { foods } from '../data/foods';

describe('percentage progress', () => {
  it('shows percent without disclosing mouthful counts or stage notches', () => {
    const stages = foods[0]!.stages;
    const html = renderToStaticMarkup(createElement(Progress, { stage: 0, bites: 0, stages }));
    expect(html).toContain('0%');
    expect(html).toContain('role="progressbar"');
    expect(html).not.toContain('口');
    expect(html).not.toContain('bite-notches');
  });
  it('preserves progress at stage boundaries and reaches 100 only when complete', () => {
    const stages = foods[0]!.stages;
    const before = renderToStaticMarkup(createElement(Progress, {stage:0,bites:stages[0]!.bites,stages}));
    const after = renderToStaticMarkup(createElement(Progress, {stage:1,bites:0,stages}));
    expect(before).toBe(after);
    expect(renderToStaticMarkup(createElement(Progress, {stage:3,bites:stages[3]!.bites,stages}))).toContain('100%');
  });
});
