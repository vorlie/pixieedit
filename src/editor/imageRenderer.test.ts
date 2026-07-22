import { describe, expect, it } from 'vitest';
import { transformPixel } from './imageRenderer';
import type { FilterParameters } from './render';

const neutral: FilterParameters = {
  brightness: 1, contrast: 1, saturation: 1, exposure: 0, highlights: 0, shadows: 0,
  temperature: 0, tint: 0, vibrance: 0, sharpness: 0, vignette: 0, grayscale: 0, sepia: 0,
};

describe('shared pixel transform', () => {
  it('keeps neutral parameters within one byte', () => {
    const result = transformPixel(40, 120, 220, neutral);
    expect(result).toEqual([40, 120, 220]);
  });

  it('applies warmth, grayscale, and sepia deterministically', () => {
    expect(transformPixel(100, 120, 140, { ...neutral, brightness: 1.1, contrast: 1.05, saturation: 0.9, temperature: 0.2, grayscale: 0.25, sepia: 0.3 })).toEqual([138, 139, 135]);
  });

  it('applies exposure and targeted tonal controls', () => {
    const baseline = transformPixel(60, 80, 100, neutral);
    const adjusted = transformPixel(60, 80, 100, { ...neutral, exposure: 0.5, shadows: 0.5, highlights: -0.2 });
    expect(adjusted[1]).toBeGreaterThan(baseline[1]);
  });

  it('applies temperature, tint, and vibrance independently', () => {
    const warm = transformPixel(90, 110, 140, { ...neutral, temperature: 0.4 });
    const tinted = transformPixel(90, 110, 140, { ...neutral, tint: 0.4 });
    const vibrant = transformPixel(90, 110, 140, { ...neutral, vibrance: 0.5 });
    expect(warm[0]).toBeGreaterThan(90);
    expect(tinted[1]).toBeLessThan(110);
    expect(vibrant[2] - vibrant[0]).toBeGreaterThan(50);
  });
});
