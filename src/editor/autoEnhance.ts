import type { AdjustmentKey } from './editModel';

export type AdjustmentValues = Record<AdjustmentKey, number>;

export interface ImageAnalysis {
  pixelCount: number;
  medianLuminance: number;
  lowLuminance: number;
  highLuminance: number;
  averageRed: number;
  averageGreen: number;
  averageBlue: number;
  averageChroma: number;
}

export interface AutoEnhanceResult {
  analysis: ImageAnalysis;
  adjustments: AdjustmentValues;
}

export function analyzeImageData(data: Uint8ClampedArray): ImageAnalysis {
  const pixels: Array<{ luminance: number; red: number; green: number; blue: number; chroma: number }> = [];
  for (let index = 0; index < data.length; index += 4) {
    if (data[index + 3] === 0) continue;
    const red = data[index] / 255;
    const green = data[index + 1] / 255;
    const blue = data[index + 2] / 255;
    const luminance = red * 0.2126 + green * 0.7152 + blue * 0.0722;
    pixels.push({ luminance, red, green, blue, chroma: Math.max(red, green, blue) - Math.min(red, green, blue) });
  }
  if (pixels.length === 0) throw new Error('The image has no visible pixels.');
  pixels.sort((a, b) => a.luminance - b.luminance);
  const trim = Math.floor(pixels.length * 0.005);
  const visible = pixels.slice(trim, Math.max(trim + 1, pixels.length - trim));
  const percentile = (fraction: number) => visible[Math.min(visible.length - 1, Math.floor((visible.length - 1) * fraction))].luminance;
  const totals = visible.reduce((sum, pixel) => ({
    red: sum.red + pixel.red, green: sum.green + pixel.green, blue: sum.blue + pixel.blue, chroma: sum.chroma + pixel.chroma,
  }), { red: 0, green: 0, blue: 0, chroma: 0 });
  return {
    pixelCount: visible.length,
    medianLuminance: percentile(0.5),
    lowLuminance: percentile(0.02),
    highLuminance: percentile(0.98),
    averageRed: totals.red / visible.length,
    averageGreen: totals.green / visible.length,
    averageBlue: totals.blue / visible.length,
    averageChroma: totals.chroma / visible.length,
  };
}

export function suggestEnhancements(analysis: ImageAnalysis): AutoEnhanceResult {
  const brightness = clamp(Math.round(100 * (0.48 / Math.max(0.01, analysis.medianLuminance)) ** 0.35), 80, 120);
  const range = Math.max(0.05, analysis.highLuminance - analysis.lowLuminance);
  const contrast = clamp(Math.round(100 * (0.82 / range) ** 0.3), 85, 125);
  const temperature = clamp(Math.round((analysis.averageBlue - analysis.averageRed) * 100), -30, 30);
  const saturation = clamp(Math.round(100 + (0.22 - analysis.averageChroma) * 45), 90, 120);
  return { analysis, adjustments: {
    brightness, contrast, saturation, temperature, exposure: 0, highlights: 0, shadows: 0,
    tint: 0, vibrance: 0, sharpness: 0, vignette: 0,
  } };
}

export async function autoEnhanceImage(image: CanvasImageSource, width: number, height: number): Promise<AutoEnhanceResult> {
  const scale = Math.min(1, 256 / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Image analysis is not supported in this browser.');
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return suggestEnhancements(analyzeImageData(context.getImageData(0, 0, canvas.width, canvas.height).data));
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
