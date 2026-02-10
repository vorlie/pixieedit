import { useLocation, useNavigate } from 'react-router-dom';
import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import useDynamicColor from '../hooks/useDynamicColor';
import { db, type AdjustmentKey, type CropState } from '../db/db';
import { useLiveQuery } from 'dexie-react-hooks';

const Editor = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const imageId = location.state?.imageId;
  
  // Load image from Dexie
  const pixieImage = useLiveQuery(
    async () => (imageId ? await db.images.get(imageId) : undefined),
    [imageId]
  );

  const [adjustments, setAdjustments] = useState<Record<AdjustmentKey, number>>({
    brightness: 100,
    contrast: 100,
    saturation: 100,
    warmth: 0,
    sharpness: 0, 
  });

  const [crop, setCrop] = useState<CropState | undefined>(undefined);
  const [activeTab, setActiveTab] = useState('adjust');
  const [activeAdjustTool, setActiveAdjustTool] = useState<AdjustmentKey>('brightness');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Initialize from DB when image loads
  useEffect(() => {
    if (pixieImage?.edits) {
      setAdjustments(pixieImage.edits);
      setCrop(pixieImage.edits.crop);
    }
  }, [pixieImage]);

  // Debounced auto-save to IndexedDB
  useEffect(() => {
    if (!imageId) return;
    
    const timeoutId = setTimeout(() => {
      db.images.update(imageId, { 
        edits: { ...adjustments, crop } 
      });
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [adjustments, crop, imageId]);

  const imageUrl = useMemo(() => {
    if (pixieImage?.originalBlob) {
      return URL.createObjectURL(pixieImage.originalBlob);
    }
    return '';
  }, [pixieImage]);

  // Apply dynamic theme based on image
  useDynamicColor(imageUrl || '');

  // Crop Logic
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [dragInitialCrop, setDragInitialCrop] = useState<CropState | null>(null);
  const [dragType, setDragType] = useState<'move' | 'corner-tl' | 'corner-tr' | 'corner-bl' | 'corner-br' | 'side-l' | 'side-r' | 'side-t' | 'side-b' | null>(null);

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

    const rect = imageRef.current.getBoundingClientRect();
    const dxPercent = (dx / rect.width) * 100;
    const dyPercent = (dy / rect.height) * 100;

    setCrop(() => {
      let { x, y, width, height } = dragInitialCrop;

      switch (dragType) {
        case 'move':
          x = Math.max(0, Math.min(100 - width, x + dxPercent));
          y = Math.max(0, Math.min(100 - height, y + dyPercent));
          break;
        case 'corner-tl':
          const newX_tl = Math.max(0, Math.min(x + width - 5, x + dxPercent));
          const newY_tl = Math.max(0, Math.min(y + height - 5, y + dyPercent));
          width += (x - newX_tl);
          height += (y - newY_tl);
          x = newX_tl;
          y = newY_tl;
          break;
        case 'corner-tr':
          const newY_tr = Math.max(0, Math.min(y + height - 5, y + dyPercent));
          width = Math.max(5, Math.min(100 - x, width + dxPercent));
          height += (y - newY_tr);
          y = newY_tr;
          break;
        case 'corner-bl':
          const newX_bl = Math.max(0, Math.min(x + width - 5, x + dxPercent));
          width += (x - newX_bl);
          height = Math.max(5, Math.min(100 - y, height + dyPercent));
          x = newX_bl;
          break;
        case 'corner-br':
          width = Math.max(5, Math.min(100 - x, width + dxPercent));
          height = Math.max(5, Math.min(100 - y, height + dyPercent));
          break;
        case 'side-l':
          const resX_l = Math.max(0, Math.min(x + width - 5, x + dxPercent));
          width += (x - resX_l);
          x = resX_l;
          break;
        case 'side-r':
          width = Math.max(5, Math.min(100 - x, width + dxPercent));
          break;
        case 'side-t':
          const resY_t = Math.max(0, Math.min(y + height - 5, y + dyPercent));
          height += (y - resY_t);
          y = resY_t;
          break;
        case 'side-b':
          height = Math.max(5, Math.min(100 - y, height + dyPercent));
          break;
      }

      return { x, y, width, height };
    });
  }, [isDragging, dragInitialCrop, dragStart, dragType]);

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
    setCrop(prev => {
        if (!prev) return prev;
        let newX = prev.x;
        let newY = prev.y;
        let newW = prev.width;
        let newH = prev.height;

        if (key === 'x') newX = Math.min(value, 100 - newW);
        if (key === 'y') newY = Math.min(value, 100 - newH);
        if (key === 'width') newW = Math.min(value, 100 - newX);
        if (key === 'height') newH = Math.min(value, 100 - newY);

        return { x: newX, y: newY, width: newW, height: newH };
    });
  };

  const initCrop = () => {
    if (!crop) {
      setCrop({ x: 10, y: 10, width: 80, height: 80 });
    }
  };

  useEffect(() => {
    if (activeTab === 'crop') initCrop();
  }, [activeTab]);

  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth, naturalHeight } = e.currentTarget;
    setImageSize({ width: naturalWidth, height: naturalHeight });
  };

  if (!imageId || (pixieImage === undefined && imageId)) {
    return (
       <div className="h-screen flex items-center justify-center p-8 text-center bg-surface w-full">
        <div className="flex flex-col items-center gap-4 animate-pulse">
          <span className="material-symbols-rounded text-6xl opacity-20">image</span>
          <p className="text-on-surface-variant font-medium">Loading image...</p>
        </div>
      </div>
    );
  }

  if (!pixieImage) {
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

  const handleAdjustChange = (key: string, value: number) => {
    setAdjustments(prev => ({ ...prev, [key]: value }));
  };

  const resetAdjustments = () => {
    setAdjustments({
      brightness: 100,
      contrast: 100,
      saturation: 100,
      warmth: 0,
      sharpness: 0,
    });
  };

  const applyPreset = (preset: string) => {
    switch (preset) {
      case 'Default':
        resetAdjustments();
        break;
      case 'Vivid':
        setAdjustments({
          brightness: 110,
          contrast: 120,
          saturation: 130,
          warmth: 0,
          sharpness: 0,
        });
        break;
      case 'Warm':
        setAdjustments({
          brightness: 105,
          contrast: 105,
          saturation: 110,
          warmth: 30,
          sharpness: 0,
        });
        break;
      case 'Cool':
        setAdjustments({
          brightness: 105,
          contrast: 105,
          saturation: 110,
          warmth: -30,
          sharpness: 0,
        });
        break;
      case 'Mono':
        setAdjustments({
          brightness: 110,
          contrast: 120,
          saturation: 0,
          warmth: 0,
          sharpness: 0,
        });
        break;
    }
  };

  const filterStyle = {
    filter: `brightness(${adjustments.brightness}%) contrast(${adjustments.contrast}%) saturate(${adjustments.saturation}%) sepia(${adjustments.warmth > 0 ? adjustments.warmth : 0}%) hue-rotate(${adjustments.warmth < 0 ? adjustments.warmth * 0.5 : 0}deg)`
  };

  const handleExport = () => {
    if (!imageUrl || !pixieImage) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = imageUrl;
    img.onload = () => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Handle cropping
      let drawX = 0;
      let drawY = 0;
      let drawW = img.width;
      let drawH = img.height;

      if (crop) {
        drawX = (crop.x / 100) * img.width;
        drawY = (crop.y / 100) * img.height;
        drawW = (crop.width / 100) * img.width;
        drawH = (crop.height / 100) * img.height;
      }

      canvas.width = drawW;
      canvas.height = drawH;

      // Apply same filters to canvas
      ctx.filter = `brightness(${adjustments.brightness}%) contrast(${adjustments.contrast}%) saturate(${adjustments.saturation}%) sepia(${adjustments.warmth > 0 ? adjustments.warmth : 0}%) hue-rotate(${adjustments.warmth < 0 ? adjustments.warmth * 0.5 : 0}deg)`;
      
      // Draw cropped area
      ctx.drawImage(img, drawX, drawY, drawW, drawH, 0, 0, drawW, drawH);

      // Trigger download
      const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
      const link = document.createElement('a');
      link.download = `PixieEdit_${Date.now()}.jpg`;
      link.href = dataUrl;
      link.click();
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
                   resetAdjustments();
                   setCrop(undefined);
                }}
                className="px-4 py-2 text-primary font-medium text-sm hover:bg-primary/10 rounded-full transition-colors"
            >
                Reset
            </button>
            <button 
                onClick={handleExport}
                className="px-6 py-2 bg-primary rounded-full text-on-primary font-medium text-sm shadow-sm hover:brightness-110 active:scale-95 transition-all text-xs lg:text-sm"
            >
                Save copy
            </button>
        </div>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row min-h-0 w-full">
        {/* Image Preview Area */}
        <main className="flex-1 flex items-center justify-center p-4 lg:p-12 bg-black/10 min-w-0 h-full overflow-hidden">
          <div className="relative w-full h-full flex items-center justify-center">
            {imageUrl && (
              <div 
                className="relative max-w-full max-h-full shadow-2xl rounded-lg lg:rounded-xl overflow-hidden"
                style={{ 
                   aspectRatio: imageSize ? `${imageSize.width} / ${imageSize.height}` : 'auto',
                }}
              >
                <img 
                  ref={imageRef}
                  onLoad={handleImageLoad}
                  src={imageUrl} 
                  alt="Edit preview" 
                  className={`w-full h-full block transition-all duration-300 ${activeTab === 'crop' ? 'opacity-50' : ''}`}
                  style={filterStyle}
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
              </div>
            )}
          </div>
        </main>

        {/* PC Side Panel - Only visible on LG+ */}
        <aside className="hidden lg:flex flex-col w-80 bg-surface border-l border-outline/10 p-6 overflow-y-auto z-10 no-scrollbar">
            <div className="flex flex-col gap-8">
                {/* Desktop Tabs */}
                <div className="grid grid-cols-2 gap-2">
                    {[
                        { id: 'suggestions', label: 'Suggestions', icon: 'magic_button' },
                        { id: 'crop', label: 'Crop', icon: 'crop' },
                        { id: 'adjust', label: 'Adjust', icon: 'tune' },
                        { id: 'filters', label: 'Filters', icon: 'filter_vintage' },
                        { id: 'markup', label: 'Markup', icon: 'brush' },
                    ].map((tab) => (
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
                            {[
                                { id: 'brightness', label: 'Brightness', icon: 'light_mode' },
                                { id: 'contrast', label: 'Contrast', icon: 'contrast' },
                                { id: 'saturation', label: 'Saturation', icon: 'invert_colors' },
                                { id: 'warmth', label: 'Warmth', icon: 'thermostat' },
                            ].map((tool) => (
                                <div key={tool.id} className="flex flex-col gap-3 p-4 bg-surface-variant/20 rounded-2xl">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="material-symbols-rounded text-sm opacity-70">{tool.icon}</span>
                                            <span className="text-xs font-medium uppercase tracking-wider">{tool.label}</span>
                                        </div>
                                        <span className="text-sm font-mono font-medium">
                                             {tool.id === 'warmth' ? adjustments[tool.id as AdjustmentKey] : (adjustments[tool.id as AdjustmentKey] - 100)}
                                        </span>
                                    </div>
                                    <input 
                                        type="range" 
                                        min={tool.id === 'warmth' ? "-50" : "0"} 
                                        max={tool.id === 'warmth' ? "50" : "200"} 
                                        value={adjustments[tool.id as AdjustmentKey]}
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
                            {['Default', 'Vivid', 'Warm', 'Cool', 'Mono'].map((preset) => (
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

                    {activeTab === 'crop' && crop && (
                        <div className="flex flex-col gap-6">
                            {[
                                { id: 'x', label: 'Initial X', icon: 'align_horizontal_left' },
                                { id: 'y', label: 'Initial Y', icon: 'align_vertical_top' },
                                { id: 'width', label: 'Width', icon: 'width' },
                                { id: 'height', label: 'Height', icon: 'height' },
                            ].map((ctrl) => {
                                const val = crop[ctrl.id as keyof CropState];
                                const natural = imageRef.current ? (ctrl.id === 'x' || ctrl.id === 'width' ? imageRef.current.naturalWidth : imageRef.current.naturalHeight) : 0;
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
                            {activeAdjustTool === 'warmth' ? adjustments[activeAdjustTool] : (adjustments[activeAdjustTool] - 100)}
                        </span>
                    </div>
                    <input 
                        type="range" 
                        min={activeAdjustTool === 'warmth' ? "-50" : "0"} 
                        max={activeAdjustTool === 'warmth' ? "50" : "200"} 
                        value={adjustments[activeAdjustTool]}
                        onChange={(e) => handleAdjustChange(activeAdjustTool, parseInt(e.target.value))}
                        className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-surface-variant transition-all hover:h-2"
                        style={{ accentColor: 'var(--color-primary)' }}
                    />
                </>
            )}
            
            {activeTab === 'suggestions' && (
                <div className="flex gap-3 overflow-x-auto no-scrollbar py-2">
                    {['Default', 'Vivid', 'Warm', 'Cool', 'Mono'].map((preset) => (
                        <button 
                            key={preset} 
                            onClick={() => applyPreset(preset)}
                            className="min-w-[80px] aspect-video bg-surface-variant rounded-lg text-xs font-medium flex items-center justify-center border border-outline/20 hover:bg-opacity-80 active:scale-95 transition-all"
                        >
                            {preset}
                        </button>
                    ))}
                </div>
            )}

            {activeTab === 'crop' && crop && (
                <div className="flex gap-2 overflow-x-auto no-scrollbar py-2">
                    {[
                        { id: 'x', label: 'X', icon: 'align_horizontal_left' },
                        { id: 'y', label: 'Y', icon: 'align_vertical_top' },
                        { id: 'width', label: 'W', icon: 'width' },
                        { id: 'height', label: 'H', icon: 'height' },
                    ].map((ctrl) => (
                        <div key={ctrl.id} className="min-w-[120px] p-2 bg-surface-variant/30 rounded-xl flex flex-col gap-1">
                            <div className="flex justify-between items-center px-1">
                                <span className="text-[10px] font-medium opacity-60">{ctrl.label}</span>
                                <span className="text-[9px] font-mono opacity-40">
                                    {Math.round((crop[ctrl.id as keyof CropState] / 100) * (imageRef.current ? (ctrl.id === 'x' || ctrl.id === 'width' ? imageRef.current.naturalWidth : imageRef.current.naturalHeight) : 0))}px
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
                </div>
            )}
        </div>

        {/* Sub-tools (Icons for Adjust/Filters etc.) */}
        <div className="h-16 flex items-center gap-6 px-6 overflow-x-auto no-scrollbar mb-4">
            {activeTab === 'adjust' && [
                { id: 'brightness', label: 'Brightness', icon: 'light_mode' },
                { id: 'contrast', label: 'Contrast', icon: 'contrast' },
                { id: 'saturation', label: 'Saturation', icon: 'invert_colors' },
                { id: 'warmth', label: 'Warmth', icon: 'thermostat' },
            ].map((tool) => (
                <button 
                    key={tool.id} 
                    onClick={() => setActiveAdjustTool(tool.id as AdjustmentKey)}
                    className={`flex flex-col items-center gap-1 min-w-[56px] transition-all ${activeAdjustTool === tool.id ? 'text-primary scale-110' : 'opacity-60 hover:opacity-100'}`}
                >
                    <span className="material-symbols-rounded">{tool.icon}</span>
                    <span className="text-[10px] font-medium">{tool.label}</span>
                </button>
            ))}
        </div>

        {/* Main Tabs */}
        <div className="flex items-center justify-center gap-1 md:gap-4 overflow-x-auto no-scrollbar px-2">
          {[
            { id: 'suggestions', label: 'Suggestions', icon: 'magic_button' },
            { id: 'crop', label: 'Crop', icon: 'crop' },
            { id: 'adjust', label: 'Adjust', icon: 'tune' },
            { id: 'filters', label: 'Filters', icon: 'filter_vintage' },
            { id: 'markup', label: 'Markup', icon: 'brush' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col items-center gap-1 min-w-[76px] py-2 transition-all rounded-2xl ${
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
    </div>
  );
};

export default Editor;
