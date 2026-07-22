import { useNavigate, useSearchParams } from 'react-router-dom';
import { useState, useRef, useEffect, useMemo, useCallback, useReducer } from 'react';
import useDynamicColor from '../hooks/useDynamicColor';
import { db, type AdjustmentKey, type CropState, type Rotation } from '../db/db';
import { createDefaultEdits, normalizeEdits } from '../editor/editModel';
import { FILTERS, createRenderSpec, getCropPixels, getOutputSize, getRenderParameters, screenDeltaToImagePercent, updateCrop, type CropDragType } from '../editor/render';
import { editReducer } from '../editor/editReducer';
import { autoEnhanceImage, type AdjustmentValues } from '../editor/autoEnhance';
import { releaseRenderResources, renderImage } from '../editor/imageRenderer';
import { useLiveQuery } from 'dexie-react-hooks';
import { ADJUSTMENT_TOOLS, CROP_TOOLS, CROP_TOOLS_MOBILE, PRESET_PRESETS, MAIN_TABS } from '../config/tools';
import { useMarkupState } from '../hooks/useMarkupState';
import { MarkupCanvas } from '../components/MarkupCanvas';
import { MarkupTools } from '../components/MarkupTools';
import { StatusBar } from '../components/StatusBar';
import { ProcessedImage } from '../components/ProcessedImage';

const Editor = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const parsedImageId = Number(searchParams.get('id'));
  const imageId = Number.isInteger(parsedImageId) && parsedImageId > 0 ? parsedImageId : undefined;
  
  // Load image from Dexie
  const pixieImage = useLiveQuery(
    async () => (imageId ? (await db.images.get(imageId) ?? null) : null),
    [imageId]
  );

  const [edits, dispatchEdit] = useReducer(editReducer, undefined, createDefaultEdits);
  const adjustments: AdjustmentValues = {
    brightness: edits.brightness, contrast: edits.contrast, saturation: edits.saturation,
    exposure: edits.exposure, highlights: edits.highlights, shadows: edits.shadows,
    temperature: edits.temperature, tint: edits.tint, vibrance: edits.vibrance,
    sharpness: edits.sharpness, vignette: edits.vignette,
  };
  const { crop, rotation, flipH, flipV, filter } = edits;
  const [activeTab, setActiveTab] = useState('adjust');
  const [activeAdjustTool, setActiveAdjustTool] = useState<AdjustmentKey>('brightness');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [preAutoAdjustments, setPreAutoAdjustments] = useState<AdjustmentValues | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [editorError, setEditorError] = useState('');
  const [loadedImageId, setLoadedImageId] = useState<number>();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const markupState = useMarkupState();
  const { replaceDrawings } = markupState;

  // Initialize from DB when image loads
  useEffect(() => {
    if (pixieImage?.edits && pixieImage.id === imageId && loadedImageId !== imageId) {
      const edits = normalizeEdits(pixieImage.edits);
      dispatchEdit({ type: 'load', edits });
      replaceDrawings(edits.markup);
      setLoadedImageId(imageId);
    }
  }, [pixieImage, imageId, loadedImageId, replaceDrawings]);

  // Debounced auto-save to IndexedDB
  useEffect(() => {
    if (!imageId || loadedImageId !== imageId) return;
    
    const timeoutId = setTimeout(() => {
      db.images.update(imageId, { 
        edits: { ...edits, markup: markupState.drawings }
      });
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [edits, imageId, loadedImageId, markupState.drawings]);

  const originalBlob = pixieImage?.originalBlob;
  const imageUrl = useMemo(
    () => originalBlob ? URL.createObjectURL(originalBlob) : '',
    [originalBlob]
  );

  useEffect(() => () => {
    if (imageUrl) URL.revokeObjectURL(imageUrl);
  }, [imageUrl]);

  // Apply dynamic theme based on image
  useDynamicColor(imageUrl || '');

  // Crop Logic
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [dragInitialCrop, setDragInitialCrop] = useState<CropState | null>(null);
  const [dragType, setDragType] = useState<CropDragType | null>(null);

  const handleCropMouseDown = (e: React.MouseEvent | React.TouchEvent, type: typeof dragType) => {
    e.preventDefault();
    e.stopPropagation(); // CRITICAL: Stop propagation to parent 'move' handler
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    setIsDragging(true);
    setDragType(type);
    setDragStart({ x: clientX, y: clientY });
    if (crop) setDragInitialCrop({ ...crop });
  };

  const handleCropMouseMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!isDragging || !dragInitialCrop || !imageRef.current) return;

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const dx = clientX - dragStart.x;
    const dy = clientY - dragStart.y;

    const delta = screenDeltaToImagePercent(dx, dy, imageRef.current.clientWidth, imageRef.current.clientHeight, rotation, flipH, flipV);
    if (dragType) dispatchEdit({ type: 'set-crop', crop: updateCrop(dragInitialCrop, dragType, delta.x, delta.y) });
  }, [isDragging, dragInitialCrop, dragStart, dragType, rotation, flipH, flipV]);

  const handleCropMouseUp = useCallback(() => {
    setIsDragging(false);
    setDragType(null);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleCropMouseMove);
      window.addEventListener('mouseup', handleCropMouseUp);
      window.addEventListener('touchmove', handleCropMouseMove);
      window.addEventListener('touchend', handleCropMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleCropMouseMove);
      window.removeEventListener('mouseup', handleCropMouseUp);
      window.removeEventListener('touchmove', handleCropMouseMove);
      window.removeEventListener('touchend', handleCropMouseUp);
    };
  }, [isDragging, handleCropMouseMove, handleCropMouseUp]);

  const updateCropSlider = (key: keyof CropState, value: number) => {
    if (!crop) return;
    let newX = crop.x;
    let newY = crop.y;
    let newW = crop.width;
    let newH = crop.height;

    if (key === 'x') newX = Math.min(value, 100 - newW);
    if (key === 'y') newY = Math.min(value, 100 - newH);
    if (key === 'width') newW = Math.min(value, 100 - newX);
    if (key === 'height') newH = Math.min(value, 100 - newY);

    dispatchEdit({ type: 'set-crop', crop: { x: newX, y: newY, width: newW, height: newH } });
  };

  const startCrop = () => {
    // An inset selection makes the handles immediately visible while keeping
    // crop opt-in: merely opening the Crop tab does not alter the export.
    dispatchEdit({ type: 'set-crop', crop: { x: 10, y: 10, width: 80, height: 80 } });
  };

  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);

  const handleImageLoad = (image: HTMLImageElement) => {
    const { naturalWidth, naturalHeight } = image;
    setImageSize({ width: naturalWidth, height: naturalHeight });
  };

  if (imageId && pixieImage === undefined) {
    return (
       <div className="h-screen flex items-center justify-center p-8 text-center bg-surface w-full">
        <div className="flex flex-col items-center gap-4 animate-pulse">
          <span className="material-symbols-rounded text-6xl opacity-20">image</span>
          <p className="text-on-surface-variant font-medium">Loading image...</p>
        </div>
      </div>
    );
  }

  if (!imageId || !pixieImage) {
    return (
      <div className="h-screen flex items-center justify-center p-8 text-center bg-surface w-full">
        <div className="flex flex-col items-center gap-4">
          <span className="material-symbols-rounded text-6xl opacity-20">image_not_supported</span>
          <p className="text-on-surface-variant">Image not found</p>
          <button 
            onClick={() => navigate('/library')}
            className="bg-primary text-on-primary px-8 py-3 rounded-full font-medium shadow-lg hover:brightness-110 transition-all"
          >
            Go to Library
          </button>
        </div>
      </div>
    );
  }

  const handleAdjustChange = (key: AdjustmentKey, value: number) => {
    setPreAutoAdjustments(null);
    dispatchEdit({ type: 'set-adjustment', key, value });
  };

  const resetAdjustments = () => {
    setPreAutoAdjustments(null);
    dispatchEdit({ type: 'replace-adjustments', adjustments: {
      brightness: 100,
      contrast: 100,
      saturation: 100,
      exposure: 0, highlights: 0, shadows: 0, temperature: 0, tint: 0, vibrance: 0,
      sharpness: 0,
      vignette: 0,
    } });
  };

  const applyPreset = (preset: string) => {
    setPreAutoAdjustments(null);
    switch (preset) {
      case 'Default':
        resetAdjustments();
        break;
      case 'Vivid':
        dispatchEdit({ type: 'replace-adjustments', adjustments: {
          brightness: 110,
          contrast: 120,
          saturation: 130,
          exposure: 0, highlights: 0, shadows: 0, temperature: 0, tint: 0, vibrance: 0,
          sharpness: 0,
          vignette: 0,
        } });
        break;
      case 'Warm':
        dispatchEdit({ type: 'replace-adjustments', adjustments: {
          brightness: 105,
          contrast: 105,
          saturation: 110,
          exposure: 0, highlights: 0, shadows: 0, temperature: 30, tint: 0, vibrance: 0,
          sharpness: 0,
          vignette: 0,
        } });
        break;
      case 'Cool':
        dispatchEdit({ type: 'replace-adjustments', adjustments: {
          brightness: 105,
          contrast: 105,
          saturation: 110,
          exposure: 0, highlights: 0, shadows: 0, temperature: -30, tint: 0, vibrance: 0,
          sharpness: 0,
          vignette: 0,
        } });
        break;
      case 'Mono':
        dispatchEdit({ type: 'replace-adjustments', adjustments: {
          brightness: 110,
          contrast: 120,
          saturation: 0,
          exposure: 0, highlights: 0, shadows: 0, temperature: 0, tint: 0, vibrance: 0,
          sharpness: 0,
          vignette: 0,
        } });
        break;
    }
  };

  const currentEdits = normalizeEdits({ ...edits, markup: markupState.drawings });
  const renderSpec = createRenderSpec(currentEdits);
  const activeAdjustConfig = ADJUSTMENT_TOOLS.find((tool) => tool.id === activeAdjustTool) ?? ADJUSTMENT_TOOLS[0];

  const handleAutoEnhance = async () => {
    const image = imageRef.current;
    if (!image || isAnalyzing) return;
    setIsAnalyzing(true);
    setEditorError('');
    try {
      const result = await autoEnhanceImage(image, image.naturalWidth, image.naturalHeight);
      setPreAutoAdjustments({ ...adjustments });
      dispatchEdit({ type: 'apply-auto-enhance', adjustments: result.adjustments });
    } catch (error) {
      setEditorError(error instanceof Error ? error.message : 'Auto Enhance could not analyze this image.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const revertAutoEnhance = () => {
    if (!preAutoAdjustments) return;
    dispatchEdit({ type: 'replace-adjustments', adjustments: preAutoAdjustments });
    setPreAutoAdjustments(null);
  };

  const handleExport = () => {
    if (!imageUrl || !pixieImage || isExporting) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    setIsExporting(true);
    setEditorError('');
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = imageUrl;
    img.onload = () => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Determine crop area in original image pixels
      const cropPixels = getCropPixels(crop, img.width, img.height);
      const { x: drawX, y: drawY, width: drawW, height: drawH } = cropPixels;

      // Draw image+markup into a temporary canvas at "natural" crop size
      const temp = document.createElement('canvas');
      temp.width = Math.max(1, Math.round(drawW));
      temp.height = Math.max(1, Math.round(drawH));
      const tctx = temp.getContext('2d');
      if (!tctx) return;

      // Preview and export share the same numeric WebGL/Canvas renderer.
      const processed = renderImage(
        img, img.width, img.height, temp.width, temp.height,
        getRenderParameters(renderSpec), { x: drawX, y: drawY, width: drawW, height: drawH },
      );
      tctx.drawImage(processed.canvas, 0, 0);
      releaseRenderResources(processed.canvas, processed.backend);

      // Draw markup onto temp canvas (map overlay coords -> original image pixels -> cropped local coords)
      if (markupState.drawings.length > 0 && imageRef.current) {
        const imageDisplayRect = imageRef.current.getBoundingClientRect();

        const displayWidth = imageRef.current.clientWidth || imageDisplayRect.width || temp.width;
        const displayHeight = imageRef.current.clientHeight || imageDisplayRect.height || temp.height;
        const scaleX = img.width / displayWidth;
        const scaleY = img.height / displayHeight;

        markupState.drawings.forEach(drawing => {
          tctx.strokeStyle = drawing.color;
          tctx.fillStyle = drawing.color;
          tctx.lineCap = 'round';
          tctx.lineJoin = 'round';
          // stroke width scaled to image pixels
          tctx.lineWidth = ((drawing.strokeWidth || 1) * ((scaleX + scaleY) / 2));

          const imgX = drawing.x * img.width;
          const imgY = drawing.y * img.height;
          const imgX2 = (drawing.x2 ?? drawing.x) * img.width;
          const imgY2 = (drawing.y2 ?? drawing.y) * img.height;

          const finalX = imgX - drawX;
          const finalY = imgY - drawY;
          const finalX2 = imgX2 - drawX;
          const finalY2 = imgY2 - drawY;

          switch (drawing.tool) {
            case 'circle': {
              const radius = Math.sqrt(Math.pow(finalX2 - finalX, 2) + Math.pow(finalY2 - finalY, 2));
              tctx.beginPath();
              tctx.arc(finalX, finalY, radius, 0, 2 * Math.PI);
              tctx.stroke();
              break;
            }
            case 'rectangle': {
              tctx.strokeRect(finalX, finalY, finalX2 - finalX, finalY2 - finalY);
              break;
            }
            case 'line': {
              tctx.beginPath();
              tctx.moveTo(finalX, finalY);
              tctx.lineTo(finalX2, finalY2);
              tctx.stroke();
              break;
            }
            case 'text': {
              tctx.font = `${(drawing.strokeWidth || 1) * 4 * ((scaleX + scaleY) / 2)}px Arial`;
              tctx.fillText(drawing.text || '', finalX, finalY);
              break;
            }
          }
        });
      }

      // Final canvas: apply rotation and flip by drawing the temp canvas into the final canvas with transforms
      const output = getOutputSize(temp.width, temp.height, rotation);
      const finalW = output.width;
      const finalH = output.height;

      canvas.width = finalW;
      canvas.height = finalH;

      // Clear and draw with transforms centered
      ctx.save();
      ctx.translate(finalW / 2, finalH / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
      ctx.drawImage(temp, -temp.width / 2, -temp.height / 2);
      ctx.restore();

      // Trigger download
      const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
      const link = document.createElement('a');
      link.download = `PixieEdit_${Date.now()}.jpg`;
      link.href = dataUrl;
      link.click();
      setIsExporting(false);
    };
    img.onerror = () => {
      setEditorError('The image could not be prepared for export.');
      setIsExporting(false);
    };
  };

  return (
    <div className="h-screen w-full flex flex-col bg-surface transition-colors duration-500 overflow-hidden select-none">
      <canvas ref={canvasRef} className="hidden" />
      
      {/* Top Action Bar */}
      <header className="h-16 flex items-center justify-between px-4 z-20 border-b border-outline/5 gap-4">
        <button 
          onClick={() => navigate('/library')}
          className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-variant transition-colors shrink-0"
        >
          <span className="material-symbols-rounded">close</span>
        </button>
        <div className="flex items-center gap-1">
            <button 
                onClick={async () => {
                  if (window.confirm('Delete this photo?')) {
                    await db.images.delete(imageId);
                    navigate('/library');
                  }
                }}
                className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-error/10 text-error/60 hover:text-error transition-colors shrink-0"
                title="Delete photo"
            >
                <span className="material-symbols-rounded text-[22px]">delete</span>
            </button>
            <button 
                onClick={() => {
                   setPreAutoAdjustments(null);
                   dispatchEdit({ type: 'reset' });
                   markupState.clear();
                }}
                className="px-4 py-2 text-primary font-medium text-sm hover:bg-primary/10 rounded-full transition-colors"
            >
                Reset
            </button>
            <button 
              onClick={() => dispatchEdit({ type: 'set-rotation', rotation: ((rotation + 270) % 360) as Rotation })}
              title="Rotate left"
              className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-variant transition-colors shrink-0"
            >
              <span className="material-symbols-rounded">rotate_left</span>
            </button>
            <button 
              onClick={() => dispatchEdit({ type: 'set-rotation', rotation: ((rotation + 90) % 360) as Rotation })}
              title="Rotate right"
              className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-variant transition-colors shrink-0"
            >
              <span className="material-symbols-rounded">rotate_right</span>
            </button>
            <button 
              onClick={() => dispatchEdit({ type: 'set-flip', axis: 'horizontal', value: !flipH })}
              title="Flip horizontal"
              className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-variant transition-colors shrink-0"
            >
              <span className="material-symbols-rounded">swap_horiz</span>
            </button>
            <button 
              onClick={() => dispatchEdit({ type: 'set-flip', axis: 'vertical', value: !flipV })}
              title="Flip vertical"
              className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-variant transition-colors shrink-0"
            >
              <span className="material-symbols-rounded">swap_vert</span>
            </button>
            <button 
              onClick={handleExport}
              disabled={isExporting}
              className="px-6 py-2 bg-primary rounded-full text-on-primary font-medium shadow-sm hover:brightness-110 active:scale-95 transition-all text-sm lg:text-base disabled:opacity-50"
            >
              {isExporting ? 'Saving…' : 'Save copy'}
            </button>
        </div>
      </header>
      {editorError && <div role="alert" className="bg-error/20 text-error px-4 py-2 text-center text-sm">{editorError}</div>}

      <div className="flex-1 flex flex-col lg:flex-row min-h-0 w-full">
        {/* Image Preview Area */}
        <main className="flex-1 flex items-center justify-center p-4 lg:p-12 bg-black/10 min-w-0 h-full overflow-hidden">
          <div className="relative w-full h-full flex items-center justify-center">
            {imageUrl && (
              <div 
                ref={containerRef}
                className="relative max-w-full max-h-full shadow-2xl rounded-lg lg:rounded-xl overflow-hidden"
                style={{ 
                   aspectRatio: imageSize ? `${imageSize.width} / ${imageSize.height}` : 'auto',
                   transform: `rotate(${rotation}deg) scaleX(${flipH ? -1 : 1}) scaleY(${flipV ? -1 : 1})`,
                   transformOrigin: 'center center',
                   transition: 'transform 0.25s ease',
                }}
              >
                <ProcessedImage
                  ref={imageRef}
                  onLoad={handleImageLoad}
                  src={imageUrl} 
                  alt="Edit preview" 
                  spec={renderSpec}
                  className={`w-full h-full block transition-all duration-300 ${activeTab === 'crop' ? 'opacity-50' : ''}`}
                />
                
                {/* Crop Overlay */}
                {activeTab === 'crop' && crop && (
                  <div 
                    className="absolute border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.5)] z-10 box-border cursor-move"
                    style={{
                      left: `${crop.x}%`,
                      top: `${crop.y}%`,
                      width: `${crop.width}%`,
                      height: `${crop.height}%`,
                    }}
                    onMouseDown={(e) => handleCropMouseDown(e, 'move')}
                    onTouchStart={(e) => handleCropMouseDown(e, 'move')}
                  >
                    {/* Grid Lines (Rule of Thirds) */}
                    <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none">
                      <div className="border-r border-b border-white/30" />
                      <div className="border-r border-b border-white/30" />
                      <div className="border-b border-white/30" />
                      <div className="border-r border-b border-white/30" />
                      <div className="border-r border-b border-white/30" />
                      <div className="border-b border-white/30" />
                      <div className="border-r border-white/30" />
                      <div className="border-r border-white/30" />
                      <div />
                    </div>

                    {/* Corner Handles */}
                    <div 
                      className="absolute -top-2 -left-2 w-6 h-6 bg-white rounded-full border-2 border-primary shadow-lg cursor-nw-resize z-20 flex items-center justify-center transition-transform hover:scale-125 active:scale-95"
                      onMouseDown={(e) => handleCropMouseDown(e, 'corner-tl')}
                      onTouchStart={(e) => handleCropMouseDown(e, 'corner-tl')}
                    >
                      <div className="w-2 h-2 bg-primary rounded-full" />
                    </div>
                    <div 
                      className="absolute -top-2 -right-2 w-6 h-6 bg-white rounded-full border-2 border-primary shadow-lg cursor-ne-resize z-20 flex items-center justify-center transition-transform hover:scale-125 active:scale-95"
                      onMouseDown={(e) => handleCropMouseDown(e, 'corner-tr')}
                      onTouchStart={(e) => handleCropMouseDown(e, 'corner-tr')}
                    >
                      <div className="w-2 h-2 bg-primary rounded-full" />
                    </div>
                    <div 
                      className="absolute -bottom-2 -left-2 w-6 h-6 bg-white rounded-full border-2 border-primary shadow-lg cursor-sw-resize z-20 flex items-center justify-center transition-transform hover:scale-125 active:scale-95"
                      onMouseDown={(e) => handleCropMouseDown(e, 'corner-bl')}
                      onTouchStart={(e) => handleCropMouseDown(e, 'corner-bl')}
                    >
                      <div className="w-2 h-2 bg-primary rounded-full" />
                    </div>
                    <div 
                      className="absolute -bottom-2 -right-2 w-6 h-6 bg-white rounded-full border-2 border-primary shadow-lg cursor-se-resize z-20 flex items-center justify-center transition-transform hover:scale-125 active:scale-95"
                      onMouseDown={(e) => handleCropMouseDown(e, 'corner-br')}
                      onTouchStart={(e) => handleCropMouseDown(e, 'corner-br')}
                    >
                      <div className="w-2 h-2 bg-primary rounded-full" />
                    </div>

                    {/* Side Handles */}
                    <div 
                      className="absolute top-1/2 -left-1.5 -translate-y-1/2 w-3 h-8 bg-primary rounded-full shadow-md cursor-ew-resize z-20 transition-transform hover:scale-110 active:scale-95" 
                      onMouseDown={(e) => handleCropMouseDown(e, 'side-l')} 
                      onTouchStart={(e) => handleCropMouseDown(e, 'side-l')} 
                    />
                    <div 
                      className="absolute top-1/2 -right-1.5 -translate-y-1/2 w-3 h-8 bg-primary rounded-full shadow-md cursor-ew-resize z-20 transition-transform hover:scale-110 active:scale-95" 
                      onMouseDown={(e) => handleCropMouseDown(e, 'side-r')} 
                      onTouchStart={(e) => handleCropMouseDown(e, 'side-r')} 
                    />
                    <div 
                      className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-8 h-3 bg-primary rounded-full shadow-md cursor-ns-resize z-20 transition-transform hover:scale-110 active:scale-95" 
                      onMouseDown={(e) => handleCropMouseDown(e, 'side-t')} 
                      onTouchStart={(e) => handleCropMouseDown(e, 'side-t')} 
                    />
                    <div 
                      className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-8 h-3 bg-primary rounded-full shadow-md cursor-ns-resize z-20 transition-transform hover:scale-110 active:scale-95" 
                      onMouseDown={(e) => handleCropMouseDown(e, 'side-b')} 
                      onTouchStart={(e) => handleCropMouseDown(e, 'side-b')} 
                    />
                  </div>
                )}

                {/* Markup Canvas */}
                {activeTab === 'markup' && (
                  <>
                    <MarkupCanvas imageRef={imageRef} containerRef={containerRef} markupState={markupState} />
                    <MarkupTools markupState={markupState} />
                  </>
                )}
              </div>
            )}
          </div>
        </main>

        {/* PC Side Panel - Only visible on LG+ */}
        <aside className="hidden lg:flex flex-col w-80 bg-surface border-l border-outline/10 p-6 overflow-y-auto z-10 no-scrollbar">
            <div className="flex flex-col gap-8">
                {/* Desktop Tabs */}
                <div className="grid grid-cols-2 gap-2">
                    {MAIN_TABS.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex flex-col items-center gap-2 p-4 transition-all rounded-2xl border text-sm ${
                                activeTab === tab.id 
                                ? 'bg-primary-container text-on-primary-container border-primary-container' 
                                : 'border-outline/20 hover:bg-surface-variant/40'
                            }`}
                        >
                            <span className="material-symbols-rounded text-2xl">{tab.icon}</span>
                            <span className="text-xs font-medium">{tab.label}</span>
                        </button>
                    ))}
                </div>

                {/* Desktop Tool Controls */}
                <div className="flex flex-col gap-6">
                    {activeTab === 'adjust' && (
                        <div className="flex flex-col gap-6">
                            {ADJUSTMENT_TOOLS.map((tool) => (
                                <div key={tool.id} className="flex flex-col gap-3 p-4 bg-surface-variant/20 rounded-2xl">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="material-symbols-rounded text-sm opacity-70">{tool.icon}</span>
                                            <span className="text-xs font-medium uppercase tracking-wider">{tool.label}</span>
                                        </div>
                                        <span className="text-sm font-mono font-medium">
                                             {adjustments[tool.id] - tool.neutral}
                                        </span>
                                    </div>
                                    <input 
                                        type="range" 
                                        min={tool.min}
                                        max={tool.max}
                                        aria-label={tool.label}
                                        value={adjustments[tool.id]}
                                        onChange={(e) => handleAdjustChange(tool.id, parseInt(e.target.value))}
                                        className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-surface-variant"
                                        style={{ accentColor: 'var(--color-primary)' }}
                                    />
                                </div>
                            ))}
                        </div>
                    )}

                    {activeTab === 'suggestions' && (
                        <div className="grid grid-cols-1 gap-3">
                            <button
                                onClick={handleAutoEnhance}
                                disabled={isAnalyzing}
                                className="w-full py-4 bg-primary text-on-primary rounded-xl text-sm font-medium disabled:opacity-50"
                            >
                                {isAnalyzing ? 'Analyzing…' : 'Auto Enhance'}
                            </button>
                            {preAutoAdjustments && (
                              <button onClick={revertAutoEnhance} className="w-full py-3 rounded-xl border border-outline/20 text-sm font-medium">
                                Revert Auto
                              </button>
                            )}
                            {PRESET_PRESETS.map((preset) => (
                                <button 
                                    key={preset} 
                                    onClick={() => applyPreset(preset)}
                                    className="w-full py-4 bg-surface-variant/30 rounded-xl text-sm font-medium hover:bg-surface-variant/50 transition-all active:scale-[0.98] border border-outline/10"
                                >
                                    {preset}
                                </button>
                            ))}
                        </div>
                    )}

                    {activeTab === 'markup' && (
                        <div className="flex flex-col gap-4">
                            <button
                                onClick={() => markupState.setMarkupEnabled(!markupState.markupEnabled)}
                                className={`w-full py-4 px-4 rounded-2xl font-medium transition-all ${
                                    markupState.markupEnabled
                                        ? 'bg-primary text-on-primary'
                                        : 'bg-surface-variant/30 text-on-surface hover:bg-surface-variant/50'
                                }`}
                            >
                                {markupState.markupEnabled ? 'Hide Drawing Tools' : 'Show Drawing Tools'}
                            </button>
                        </div>
                    )}

                    {activeTab === 'crop' && !crop && (
                        <button
                            onClick={startCrop}
                            className="w-full py-4 px-4 rounded-2xl bg-primary text-on-primary font-medium transition-all hover:brightness-110"
                        >
                            Start cropping
                        </button>
                    )}

                    {activeTab === 'filters' && (
                        <div className="grid grid-cols-2 gap-3">
                            {FILTERS.map((item) => (
                                <button
                                    key={item.id}
                                    onClick={() => dispatchEdit({ type: 'set-filter', filter: item.id })}
                                    aria-pressed={filter === item.id}
                                    className={`overflow-hidden rounded-xl border transition-all ${filter === item.id ? 'border-primary bg-primary-container text-on-primary-container' : 'border-outline/20 bg-surface-variant/20'}`}
                                >
                                    <div className="relative h-16 w-full overflow-hidden">
                                      <ProcessedImage src={imageUrl} alt="" maxPreviewSize={160} spec={createRenderSpec(normalizeEdits({ ...edits, filter: item.id }))} className="h-full w-full object-cover" />
                                    </div>
                                    <span className="block py-2 text-xs font-medium">{item.label}</span>
                                </button>
                            ))}
                        </div>
                    )}

                    {activeTab === 'crop' && crop && (
                        <div className="flex flex-col gap-6">
                            {CROP_TOOLS.map((ctrl) => {
                                const val = crop[ctrl.id as keyof CropState];
                                const natural = ctrl.id === 'x' || ctrl.id === 'width' ? (imageSize?.width ?? 0) : (imageSize?.height ?? 0);
                                const pixels = Math.round((val / 100) * natural);

                                return (
                                    <div key={ctrl.id} className="flex flex-col gap-3 p-4 bg-surface-variant/20 rounded-2xl">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <span className="material-symbols-rounded text-sm opacity-70">{ctrl.icon}</span>
                                                <span className="text-xs font-medium uppercase tracking-wider">{ctrl.label}</span>
                                            </div>
                                            <div className="flex flex-col items-end">
                                                <span className="text-sm font-mono font-medium">{Math.round(val)}%</span>
                                                <span className="text-[10px] opacity-50 font-mono">{pixels}px</span>
                                            </div>
                                        </div>
                                        <input 
                                            type="range" 
                                            min="0" 
                                            max="100" 
                                            value={val}
                                            onChange={(e) => updateCropSlider(ctrl.id as keyof CropState, parseInt(e.target.value))}
                                            className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-surface-variant outline-none"
                                            style={{ accentColor: 'var(--color-primary)' }}
                                        />
                                    </div>
                                );
                            })}
                            <button
                                onClick={() => dispatchEdit({ type: 'set-crop' })}
                                className="w-full py-3 px-4 rounded-2xl bg-surface-variant/30 font-medium transition-all hover:bg-surface-variant/50"
                            >
                                Remove crop
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </aside>
      </div>

      {/* Control Panel (Mobile) */}
      <footer className="lg:hidden bg-surface pb-6 pt-2 z-10 transition-colors duration-500 border-t border-outline/10">
        
        {/* Tool Specific controls (Sliders) */}
        <div className="h-24 px-6 flex flex-col justify-center gap-2 mb-2">
            {activeTab === 'adjust' && (
                <>
                    <div className="flex justify-between items-center">
                        <span className="text-xs font-medium uppercase tracking-wider opacity-70 italic">{activeAdjustTool}</span>
                        <span className="text-sm font-mono font-medium">
                            {adjustments[activeAdjustTool] - activeAdjustConfig.neutral}
                        </span>
                    </div>
                    <input 
                        type="range" 
                        min={activeAdjustConfig.min}
                        max={activeAdjustConfig.max}
                        aria-label={activeAdjustConfig.label}
                        value={adjustments[activeAdjustTool]}
                        onChange={(e) => handleAdjustChange(activeAdjustTool, parseInt(e.target.value))}
                        className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-surface-variant transition-all hover:h-2"
                        style={{ accentColor: 'var(--color-primary)' }}
                    />
                </>
            )}
            
            {activeTab === 'suggestions' && (
                <div className="flex gap-3 overflow-x-auto no-scrollbar py-2">
                    <button
                        onClick={handleAutoEnhance}
                        disabled={isAnalyzing}
                        className="min-w-28 aspect-video bg-primary text-on-primary rounded-lg text-xs font-medium disabled:opacity-50"
                    >
                        {isAnalyzing ? 'Analyzing…' : 'Auto Enhance'}
                    </button>
                    {preAutoAdjustments && (
                      <button onClick={revertAutoEnhance} className="min-w-24 aspect-video border border-outline/20 rounded-lg text-xs font-medium">Revert Auto</button>
                    )}
                    {PRESET_PRESETS.map((preset) => (
                        <button 
                            key={preset} 
                            onClick={() => applyPreset(preset)}
                            className="min-w-20 aspect-video bg-surface-variant rounded-lg text-xs font-medium flex items-center justify-center border border-outline/20 hover:bg-opacity-80 active:scale-95 transition-all"
                        >
                            {preset}
                        </button>
                    ))}
                </div>
            )}

            {activeTab === 'markup' && (
                <button
                    onClick={() => markupState.setMarkupEnabled(!markupState.markupEnabled)}
                    className={`w-full py-3 px-4 rounded-xl font-medium transition-all ${
                        markupState.markupEnabled
                            ? 'bg-primary text-on-primary'
                            : 'bg-surface-variant/30 text-on-surface'
                    }`}
                >
                    {markupState.markupEnabled ? 'Drawing Active' : 'Enable Drawing'}
                </button>
            )}

            {activeTab === 'crop' && !crop && (
                <button
                    onClick={startCrop}
                    className="w-full py-3 px-4 rounded-xl bg-primary text-on-primary font-medium"
                >
                    Start cropping
                </button>
            )}

            {activeTab === 'filters' && (
                <div className="flex gap-2 overflow-x-auto no-scrollbar py-2">
                    {FILTERS.map((item) => (
                        <button
                            key={item.id}
                        onClick={() => dispatchEdit({ type: 'set-filter', filter: item.id })}
                            aria-pressed={filter === item.id}
                            className={`min-w-20 rounded-xl px-3 py-3 text-xs font-medium ${filter === item.id ? 'bg-primary text-on-primary' : 'bg-surface-variant/30'}`}
                        >
                            {item.label}
                        </button>
                    ))}
                </div>
            )}

            {activeTab === 'crop' && crop && (
                <div className="flex gap-2 overflow-x-auto no-scrollbar py-2">
                    {CROP_TOOLS_MOBILE.map((ctrl) => (
                        <div key={ctrl.id} className="min-w-30 p-2 bg-surface-variant/30 rounded-xl flex flex-col gap-1">
                            <div className="flex justify-between items-center px-1">
                                <span className="text-[10px] font-medium opacity-60">{ctrl.label}</span>
                                <span className="text-[9px] font-mono opacity-40">
                                    {Math.round((crop[ctrl.id as keyof CropState] / 100) * (ctrl.id === 'x' || ctrl.id === 'width' ? (imageSize?.width ?? 0) : (imageSize?.height ?? 0)))}px
                                </span>
                            </div>
                            <input 
                                type="range" 
                                min="0" 
                                max="100" 
                                value={crop[ctrl.id as keyof CropState]}
                                onChange={(e) => updateCropSlider(ctrl.id as keyof CropState, parseInt(e.target.value))}
                                className="w-full h-1 rounded-full appearance-none bg-surface-variant accent-primary"
                            />
                        </div>
                    ))}
                    <button
                        onClick={() => dispatchEdit({ type: 'set-crop' })}
                        className="min-w-24 rounded-xl bg-surface-variant/30 px-3 text-xs font-medium"
                    >
                        Remove
                    </button>
                </div>
            )}
        </div>

        {/* Sub-tools (Icons for Adjust/Filters etc.) */}
        <div className="h-16 flex items-center gap-6 px-6 overflow-x-auto no-scrollbar mb-4">
            {activeTab === 'adjust' && ADJUSTMENT_TOOLS.map((tool) => (
                <button 
                    key={tool.id} 
                    onClick={() => setActiveAdjustTool(tool.id as AdjustmentKey)}
                    className={`flex flex-col items-center gap-1 min-w-14 transition-all ${activeAdjustTool === tool.id ? 'text-primary scale-110' : 'opacity-60 hover:opacity-100'}`}
                >
                    <span className="material-symbols-rounded">{tool.icon}</span>
                    <span className="text-[10px] font-medium">{tool.label}</span>
                </button>
            ))}
        </div>

        {/* Main Tabs */}
        <div className="flex items-center justify-center gap-1 md:gap-4 overflow-x-auto no-scrollbar px-2">
          {MAIN_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col items-center gap-1 min-w-19 py-2 transition-all rounded-2xl ${
                activeTab === tab.id 
                ? 'bg-primary-container text-on-primary-container' 
                : 'hover:bg-surface-variant hover:bg-opacity-40'
              }`}
            >
              <span className={`material-symbols-rounded text-[22px] ${activeTab === tab.id ? 'font-bold' : ''}`}>
                {tab.icon}
              </span>
              <span className="text-[11px] font-medium">{tab.label}</span>
            </button>
          ))}
        </div>
      </footer>
      <StatusBar />
    </div>
  );
};

export default Editor;
