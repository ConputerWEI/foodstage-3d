import { describe, expect, it } from 'vitest';
import { modelUrlForViewport } from './assets';

describe('model resolution selection', () => {
  it('uses high-detail models for wide viewports', () => {
    expect(modelUrlForViewport('/models-mobile/burger-0.glb', 1440)).toBe('/models-desktop/burger-0.glb');
  });

  it('keeps small viewports on lightweight models', () => {
    expect(modelUrlForViewport('/models-mobile/burger-0.glb', 390)).toBe('/models-mobile/burger-0.glb');
  });

  it('does not rewrite custom model URLs', () => {
    expect(modelUrlForViewport('/model/custom.glb', 1440)).toBe('/model/custom.glb');
  });
});
