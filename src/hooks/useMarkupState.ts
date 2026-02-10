import { useState, useCallback } from 'react';

export type MarkupTool = 'circle' | 'rectangle' | 'line' | 'text';

export interface DrawingAction {
  type: 'draw';
  tool: MarkupTool;
  x: number;
  y: number;
  x2?: number;
  y2?: number;
  color: string;
  strokeWidth: number;
  text?: string;
}

export interface MarkupState {
  isDrawing: boolean;
  startX: number;
  startY: number;
}

export const useMarkupState = () => {
  const [markupEnabled, setMarkupEnabled] = useState(false);
  const [activeTool, setActiveTool] = useState<MarkupTool>('circle');
  const [markupColor, setMarkupColor] = useState('#FF6B6B');
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [drawings, setDrawings] = useState<DrawingAction[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });

  const addDrawing = useCallback((action: DrawingAction) => {
    setDrawings(prev => [...prev, action]);
  }, []);

  const undo = useCallback(() => {
    setDrawings(prev => prev.slice(0, -1));
  }, []);

  const clear = useCallback(() => {
    setDrawings([]);
  }, []);

  const startDrawing = useCallback((x: number, y: number) => {
    setIsDrawing(true);
    setStartPos({ x, y });
  }, []);

  const stopDrawing = useCallback(() => {
    setIsDrawing(false);
  }, []);

  return {
    markupEnabled,
    setMarkupEnabled,
    activeTool,
    setActiveTool,
    markupColor,
    setMarkupColor,
    strokeWidth,
    setStrokeWidth,
    drawings,
    addDrawing,
    undo,
    clear,
    isDrawing,
    startDrawing,
    stopDrawing,
    startPos,
  };
};
