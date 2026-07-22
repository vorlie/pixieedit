# PixieEdit

PixieEdit is a privacy-first photo editor that runs entirely in the browser. Original images, thumbnails, and non-destructive edit parameters remain in IndexedDB; nothing is uploaded by the application.

## Development

```sh
npm install
npm run dev
```

The application uses React 19, TypeScript, Vite, Tailwind CSS, Dexie, and a generated service worker. The library is available at `/library`; editor URLs use `/editor?id=<image-id>` so an editing session survives reloads.

## Data model

`PixieEditDB` stores immutable original blobs, generated thumbnails, timestamps, and versioned edit records. Database version 3 migrates legacy records in place, maps the former warmth value to temperature, and adds neutral defaults for advanced adjustments. Crop values are percentages and markup coordinates are normalized from 0 to 1, making both independent of viewport size.

## Editing pipeline

Adjustments and filters are converted into typed numeric render parameters. Preview and export share a WebGL2 shader pipeline with a Canvas 2D compatibility fallback. Export applies crop in original-image coordinates, draws normalized markup, then applies rotation and flips. The original stored blob is never replaced.

Auto Enhance downsamples the immutable original locally, analyzes luminance, chroma, and red/blue balance, then applies conservative editable brightness, contrast, saturation, and warmth values. No image data leaves the browser.

## Verification

```sh
npm run lint
npm run test
npm run build
npx playwright install chromium
npm run test:e2e
```

`npm run verify` runs lint, unit tests, the production build, and the desktop/mobile Playwright projects. Playwright browsers must be installed once before running the complete command.
