import { useState, useCallback } from 'react';
import type { MarkupDrawing, MarkupTool } from '../editor/editModel';

export type DrawingAction = MarkupDrawing;

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

  const replaceDrawings = useCallback((next: DrawingAction[]) => {
    setDrawings(next.map((drawing) => ({ ...drawing })));
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
    replaceDrawings,
    isDrawing,
    startDrawing,
    stopDrawing,
    startPos,
  };
};
