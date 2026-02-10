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
    ctx.strokeStyle = action.color;
    ctx.fillStyle = action.color;
    ctx.lineWidth = action.strokeWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    switch (action.tool) {
      case 'circle': {
        const radius = Math.sqrt(
          Math.pow(action.x2! - action.x, 2) + Math.pow(action.y2! - action.y, 2)
        );
        ctx.beginPath();
        ctx.arc(action.x, action.y, radius, 0, 2 * Math.PI);
        ctx.stroke();
        break;
      }
      case 'rectangle': {
        ctx.strokeRect(
          action.x,
          action.y,
          action.x2! - action.x,
          action.y2! - action.y
        );
        break;
      }
      case 'line': {
        ctx.beginPath();
        ctx.moveTo(action.x, action.y);
        ctx.lineTo(action.x2!, action.y2!);
        ctx.stroke();
        break;
      }
      case 'text': {
        ctx.font = `${action.strokeWidth * 4}px Arial`;
        ctx.fillText(action.text || '', action.x, action.y);
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
          x: markupState.startPos.x,
          y: markupState.startPos.y,
          color: markupState.markupColor,
          strokeWidth: markupState.strokeWidth,
          text,
        });
      }
    } else {
      markupState.addDrawing({
        type: 'draw',
        tool: markupState.activeTool,
        x: markupState.startPos.x,
        y: markupState.startPos.y,
        x2: x,
        y2: y,
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
