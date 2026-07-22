import { forwardRef, useCallback, useEffect, useRef, useState } from 'react';
import { releaseRenderResources, renderImage } from '../editor/imageRenderer';
import { getRenderParameters, type RenderSpec } from '../editor/render';

interface ProcessedImageProps {
  src: string;
  spec: RenderSpec;
  alt?: string;
  className?: string;
  maxPreviewSize?: number;
  onLoad?: (image: HTMLImageElement) => void;
}

export const ProcessedImage = forwardRef<HTMLImageElement, ProcessedImageProps>(function ProcessedImage(
  { src, spec, alt = '', className = '', maxPreviewSize = 1600, onLoad }, forwardedRef,
) {
  const localImageRef = useRef<HTMLImageElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loadVersion, setLoadVersion] = useState(0);

  const setImageRef = useCallback((image: HTMLImageElement | null) => {
    localImageRef.current = image;
    if (typeof forwardedRef === 'function') forwardedRef(image);
    else if (forwardedRef) forwardedRef.current = image;
  }, [forwardedRef]);

  useEffect(() => {
    const image = localImageRef.current;
    const visible = canvasRef.current;
    if (!image?.complete || !image.naturalWidth || !visible) return;
    const scale = Math.min(1, maxPreviewSize / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    visible.width = width;
    visible.height = height;
    const context = visible.getContext('2d');
    if (!context) return;
    try {
      const rendered = renderImage(image, image.naturalWidth, image.naturalHeight, width, height, getRenderParameters(spec));
      context.clearRect(0, 0, width, height);
      context.drawImage(rendered.canvas, 0, 0);
      releaseRenderResources(rendered.canvas, rendered.backend);
    } catch (error) {
      console.error('Processed preview failed; using the original image.', error);
      context.clearRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);
    }
  }, [spec, loadVersion, maxPreviewSize]);

  return (
    <>
      <img
        ref={setImageRef}
        src={src}
        alt={alt}
        className="absolute inset-0 h-full w-full opacity-0 pointer-events-none"
        onLoad={(event) => { setLoadVersion((value) => value + 1); onLoad?.(event.currentTarget); }}
      />
      <canvas ref={canvasRef} role={alt ? 'img' : undefined} aria-label={alt || undefined} className={className} />
    </>
  );
});
