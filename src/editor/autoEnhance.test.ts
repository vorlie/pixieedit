import { describe, expect, it } from 'vitest';
import { analyzeImageData, suggestEnhancements } from './autoEnhance';
import { createDefaultEdits } from './editModel';
import { editReducer } from './editReducer';

function pixels(values: Array<[number, number, number, number?]>) {
  return new Uint8ClampedArray(values.flatMap(([r, g, b, a = 255]) => [r, g, b, a]));
}

describe('Auto Enhance analysis', () => {
  it('ignores fully transparent pixels', () => {
    const analysis = analyzeImageData(pixels([[255, 255, 255, 0], [128, 128, 128]]));
    expect(analysis.pixelCount).toBe(1);
    expect(analysis.medianLuminance).toBeCloseTo(128 / 255, 3);
  });

  it('rejects images with no visible pixels', () => {
    expect(() => analyzeImageData(pixels([[0, 0, 0, 0]]))).toThrow('no visible pixels');
  });

  it('produces neutral, editable values for a neutral image', () => {
    const result = suggestEnhancements(analyzeImageData(pixels(Array.from({ length: 100 }, () => [122, 122, 122]))));
    expect(result.adjustments).toMatchObject({ brightness: 100, temperature: 0 });
    expect(result.adjustments.saturation).toBeGreaterThanOrEqual(90);
  });

  it('clamps dark and low-range images conservatively', () => {
    const result = suggestEnhancements(analyzeImageData(pixels([[5, 5, 5], [10, 10, 10], [15, 15, 15], [20, 20, 20]])));
    expect(result.adjustments.brightness).toBe(120);
    expect(result.adjustments.contrast).toBe(125);
  });

  it('corrects blue and red color casts in opposite directions', () => {
    const blue = suggestEnhancements(analyzeImageData(pixels([[80, 100, 180], [90, 110, 190]])));
    const red = suggestEnhancements(analyzeImageData(pixels([[180, 100, 80], [190, 110, 90]])));
    expect(blue.adjustments.temperature).toBeGreaterThan(0);
    expect(red.adjustments.temperature).toBeLessThan(0);
  });
});

describe('history-ready edit reducer', () => {
  it('applies Auto Enhance without changing geometry or filters', () => {
    const state = { ...createDefaultEdits(), rotation: 90 as const, filter: 'mono' as const, crop: { x: 10, y: 10, width: 80, height: 80 } };
    const next = editReducer(state, { type: 'apply-auto-enhance', adjustments: {
      brightness: 110, contrast: 105, saturation: 98, exposure: 0, highlights: 0, shadows: 0,
      temperature: 4, tint: 0, vibrance: 0, sharpness: 0, vignette: 0,
    } });
    expect(next).toMatchObject({ brightness: 110, rotation: 90, filter: 'mono', crop: state.crop });
  });
});
