import { describe, expect, it } from 'vitest';
import { modelUrlForViewport } from './assets';

describe('model resolution selection', () => {
  it('uses high-detail models for wide viewports', () => {
    expect(modelUrlForViewport('/models-mobile/burger-0.glb', 1440)).toBe('/models-desktop/burger-0.glb');
  });

  it('loads fries desktop variants at the desktop breakpoint', () => {
    expect(modelUrlForViewport('/models-mobile/rosemary-fries-2.glb', 768)).toBe('/models-desktop/rosemary-fries-2.glb');
    expect(modelUrlForViewport('/models-mobile/rosemary-fries-2.glb', 767)).toBe('/models-mobile/rosemary-fries-2.glb');
  });

  it('selects pizza variants at the desktop breakpoint', () => {
    expect(modelUrlForViewport('/models-mobile/pepperoni-pizza-2.glb', 768)).toBe('/models-desktop/pepperoni-pizza-2.glb');
    expect(modelUrlForViewport('/models-mobile/pepperoni-pizza-2.glb', 390)).toBe('/models-mobile/pepperoni-pizza-2.glb');
  });

  it('keeps small viewports on lightweight models', () => {
    expect(modelUrlForViewport('/models-mobile/burger-0.glb', 390)).toBe('/models-mobile/burger-0.glb');
  });

  it('selects desktop variants for newly registered foods', () => {
    expect(modelUrlForViewport('/models-mobile/dessert-0.glb', 1440)).toBe('/models-desktop/dessert-0.glb');
  });

  it('does not rewrite custom model URLs', () => {
    expect(modelUrlForViewport('/model/custom.glb', 1440)).toBe('/model/custom.glb');
  });
});
