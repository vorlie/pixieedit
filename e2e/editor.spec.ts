import { expect, test } from '@playwright/test';

const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80"><defs><linearGradient id="g"><stop stop-color="#181830"/><stop offset="1" stop-color="#e8a080"/></linearGradient></defs><rect width="120" height="80" fill="url(#g)"/></svg>');
const transparentSvg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"/>');
const largeSvg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="12000" height="8000"><rect width="12000" height="8000" fill="#456"/></svg>');

test('imports, edits, reloads, exports, and deletes an image', async ({ page }) => {
  await page.goto('/library');
  const notice = page.getByRole('button', { name: 'Got it' });
  if (await notice.isVisible()) await notice.click();
  await page.locator('input[type=file]').setInputFiles({ name: 'sample.svg', mimeType: 'image/svg+xml', buffer: svg });
  await expect(page).toHaveURL(/\/editor\?id=\d+/);

  await page.getByRole('button', { name: 'Crop' }).last().click();
  await page.getByRole('button', { name: 'Start cropping' }).click();
  await page.getByRole('button', { name: 'Filters' }).last().click();
  await page.getByRole('button', { name: 'Mono' }).click();
  await page.waitForTimeout(1100);
  await page.reload();
  await page.getByRole('button', { name: 'Filters' }).last().click();
  await expect(page.getByRole('button', { name: 'Mono' })).toHaveAttribute('aria-pressed', 'true');

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save copy' }).click();
  await download;
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByTitle('Delete photo').click();
  await expect(page).toHaveURL(/\/library/);
});

test('invalid editor URLs fail without hanging', async ({ page }) => {
  await page.goto('/editor');
  await expect(page.getByText('Image not found')).toBeVisible();
});

test('Auto Enhance applies, reverts, and persists', async ({ page }) => {
  await page.goto('/library');
  const notice = page.getByRole('button', { name: 'Got it' });
  if (await notice.isVisible()) await notice.click();
  await page.locator('input[type=file]').setInputFiles({ name: 'enhance.svg', mimeType: 'image/svg+xml', buffer: svg });
  await page.getByRole('button', { name: 'Suggestions' }).last().click();
  const preview = page.locator('canvas[aria-label="Edit preview"]');
  const before = await preview.evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL());
  await page.getByRole('button', { name: 'Auto Enhance' }).click();
  await expect(page.getByRole('button', { name: 'Revert Auto' })).toBeVisible();
  await expect.poll(() => preview.evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL())).not.toBe(before);
  const enhanced = await preview.evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL());
  await page.getByRole('button', { name: 'Revert Auto' }).click();
  await expect.poll(() => preview.evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL())).toBe(before);
  await page.getByRole('button', { name: 'Auto Enhance' }).click();
  await page.waitForTimeout(1100);
  await page.reload();
  await expect.poll(() => preview.evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL())).toBe(enhanced);
});

test('preview and export renderer pixels stay within tolerance', async ({ page }) => {
  await page.goto('/library');
  const notice = page.getByRole('button', { name: 'Got it' });
  if (await notice.isVisible()) await notice.click();
  await page.locator('input[type=file]').setInputFiles({ name: 'parity.svg', mimeType: 'image/svg+xml', buffer: svg });
  await page.getByRole('button', { name: 'Filters' }).last().click();
  await page.getByRole('button', { name: 'Mono' }).click();
  const preview = page.locator('canvas[aria-label="Edit preview"]');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save copy' }).click();
  await download;
  const previewPixel = await preview.evaluate((canvas: HTMLCanvasElement) => {
    const context = canvas.getContext('2d')!;
    return Array.from(context.getImageData(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2), 1, 1).data);
  });
  const exportPixel = await page.locator('canvas.hidden').evaluate((canvas: HTMLCanvasElement) => {
    const context = canvas.getContext('2d')!;
    return Array.from(context.getImageData(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2), 1, 1).data);
  });
  expect(Math.max(...previewPixel.map((value, index) => Math.abs(value - exportPixel[index])))).toBeLessThanOrEqual(2);
});

test('Auto Enhance reports analysis failure without changing the image', async ({ page }) => {
  await page.goto('/library');
  const notice = page.getByRole('button', { name: 'Got it' });
  if (await notice.isVisible()) await notice.click();
  await page.locator('input[type=file]').setInputFiles({ name: 'transparent.svg', mimeType: 'image/svg+xml', buffer: transparentSvg });
  await page.getByRole('button', { name: 'Suggestions' }).last().click();
  const preview = page.locator('canvas[aria-label="Edit preview"]');
  const before = await preview.evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL());
  await page.getByRole('button', { name: 'Auto Enhance' }).click();
  await expect(page.getByRole('alert')).toContainText('no visible pixels');
  await expect(page.getByRole('button', { name: 'Auto Enhance' })).toBeEnabled();
  expect(await preview.evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL())).toBe(before);
});

test('Canvas 2D fallback renders when WebGL2 is unavailable', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type: string, ...args: unknown[]) {
      if (type === 'webgl2') return null;
      return original.call(this, type as '2d', ...args as []) as RenderingContext | null;
    } as typeof HTMLCanvasElement.prototype.getContext;
  });
  await page.goto('/library');
  const notice = page.getByRole('button', { name: 'Got it' });
  if (await notice.isVisible()) await notice.click();
  await page.locator('input[type=file]').setInputFiles({ name: 'fallback.svg', mimeType: 'image/svg+xml', buffer: svg });
  const preview = page.locator('canvas[aria-label="Edit preview"]');
  await expect.poll(() => preview.evaluate((canvas: HTMLCanvasElement) => canvas.width)).toBeGreaterThan(0);
  const alpha = await preview.evaluate((canvas: HTMLCanvasElement) => canvas.getContext('2d')!.getImageData(10, 10, 1, 1).data[3]);
  expect(alpha).toBe(255);
});

test('large images are downsampled before preview GPU upload', async ({ page }) => {
  await page.goto('/library');
  const notice = page.getByRole('button', { name: 'Got it' });
  if (await notice.isVisible()) await notice.click();
  await page.locator('input[type=file]').setInputFiles({ name: 'large.svg', mimeType: 'image/svg+xml', buffer: largeSvg });
  const preview = page.locator('canvas[aria-label="Edit preview"]');
  await expect.poll(() => preview.evaluate((canvas: HTMLCanvasElement) => Math.max(canvas.width, canvas.height))).toBe(1600);
  await expect(page.getByRole('button', { name: 'Save copy' })).toBeVisible();
});

test('advanced adjustments render and persist', async ({ page }) => {
  await page.goto('/library');
  const notice = page.getByRole('button', { name: 'Got it' });
  if (await notice.isVisible()) await notice.click();
  await page.locator('input[type=file]').setInputFiles({ name: 'adjustments.svg', mimeType: 'image/svg+xml', buffer: svg });
  const preview = page.locator('canvas[aria-label="Edit preview"]');
  const before = await preview.evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL());
  const setAdjustment = async (name: string, value: string) => {
    const slider = page.getByRole('slider', { name });
    if (!await slider.isVisible()) await page.getByRole('button', { name }).click();
    await page.getByRole('slider', { name }).fill(value);
  };
  await setAdjustment('Exposure', '50');
  await setAdjustment('Highlights', '-25');
  await setAdjustment('Shadows', '30');
  await setAdjustment('Temperature', '20');
  await setAdjustment('Tint', '10');
  await setAdjustment('Vibrance', '25');
  await setAdjustment('Sharpness', '35');
  await setAdjustment('Vignette', '30');
  await expect.poll(() => preview.evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL())).not.toBe(before);
  await page.waitForTimeout(1100);
  await page.reload();
  const exposure = page.getByRole('slider', { name: 'Exposure' });
  if (!await exposure.isVisible()) await page.getByRole('button', { name: 'Exposure' }).click();
  await expect(page.getByRole('slider', { name: 'Exposure' })).toHaveValue('50');
});
