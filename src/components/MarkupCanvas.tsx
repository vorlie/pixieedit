import { useRef, useEffect, useCallback } from 'react';
import { useMarkupState, type DrawingAction } from '../hooks/useMarkupState';

interface MarkupCanvasProps {
  imageRef: React.RefObject<HTMLImageElement | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  markupState: ReturnType<typeof useMarkupState>;
}

export const MarkupCanvas = ({ imageRef, containerRef, markupState }: MarkupCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const drawAction = useCallback((ctx: CanvasRenderingContext2D, action: DrawingAction) => {
    const width = ctx.canvas.width;
    const height = ctx.canvas.height;
    const x = action.x * width;
    const y = action.y * height;
    const x2 = (action.x2 ?? action.x) * width;
    const y2 = (action.y2 ?? action.y) * height;
    ctx.strokeStyle = action.color;
    ctx.fillStyle = action.color;
    ctx.lineWidth = action.strokeWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    switch (action.tool) {
      case 'circle': {
        const radius = Math.sqrt(
          Math.pow(x2 - x, 2) + Math.pow(y2 - y, 2)
        );
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, 2 * Math.PI);
        ctx.stroke();
        break;
      }
      case 'rectangle': {
        ctx.strokeRect(
          x, y, x2 - x, y2 - y
        );
        break;
      }
      case 'line': {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        break;
      }
      case 'text': {
        ctx.font = `${action.strokeWidth * 4}px Arial`;
        ctx.fillText(action.text || '', x, y);
        break;
      }
    }
  }, []);

  const redrawCanvas = useCallback(() => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

    // Redraw all drawings
    markupState.drawings.forEach(drawing => {
      drawAction(ctx, drawing);
    });
  }, [markupState.drawings, drawAction]);

  // Update canvas size when container/image changes
  useEffect(() => {
    if (!canvasRef.current || !imageRef.current || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const canvas = canvasRef.current;
    
    canvas.width = rect.width;
    canvas.height = rect.height;

    // Calculate scale factor (for future use if needed)
    // const imageRect = imageRef.current.getBoundingClientRect();

    redrawCanvas();
  }, [markupState.drawings, imageRef, containerRef, redrawCanvas]);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    markupState.startDrawing(x, y);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!canvasRef.current || !markupState.isDrawing) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Preview drawing (optional - just for visual feedback)
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    redrawCanvas();

    // Draw preview
    ctx.strokeStyle = markupState.markupColor;
    ctx.fillStyle = markupState.markupColor;
    ctx.lineWidth = markupState.strokeWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    switch (markupState.activeTool) {
      case 'circle': {
        const radius = Math.sqrt(
          Math.pow(x - markupState.startPos.x, 2) + Math.pow(y - markupState.startPos.y, 2)
        );
        ctx.beginPath();
        ctx.arc(markupState.startPos.x, markupState.startPos.y, radius, 0, 2 * Math.PI);
        ctx.stroke();
        break;
      }
      case 'rectangle': {
        ctx.strokeRect(
          markupState.startPos.x,
          markupState.startPos.y,
          x - markupState.startPos.x,
          y - markupState.startPos.y
        );
        break;
      }
      case 'line': {
        ctx.beginPath();
        ctx.moveTo(markupState.startPos.x, markupState.startPos.y);
        ctx.lineTo(x, y);
        ctx.stroke();
        break;
      }
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!markupState.isDrawing || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (markupState.activeTool === 'text') {
      const text = prompt('Enter text:');
      if (text) {
        markupState.addDrawing({
          type: 'draw',
          tool: 'text',
          x: markupState.startPos.x / rect.width,
          y: markupState.startPos.y / rect.height,
          color: markupState.markupColor,
          strokeWidth: markupState.strokeWidth,
          text,
        });
      }
    } else {
      markupState.addDrawing({
        type: 'draw',
        tool: markupState.activeTool,
        x: markupState.startPos.x / rect.width,
        y: markupState.startPos.y / rect.height,
        x2: x / rect.width,
        y2: y / rect.height,
        color: markupState.markupColor,
        strokeWidth: markupState.strokeWidth,
      });
    }

    markupState.stopDrawing();
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    e.stopPropagation();
    markupState.stopDrawing();
  };

  return (
    <canvas
      ref={canvasRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      className="absolute inset-0 cursor-crosshair z-40 rounded-lg"
      style={{ 
        touchAction: 'none',
        userSelect: 'none',
      }}
    />
  );
};
