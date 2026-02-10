import { useMarkupState } from '../hooks/useMarkupState';

interface MarkupToolsProps {
  markupState: ReturnType<typeof useMarkupState>;
}

export const MarkupTools = ({ markupState }: MarkupToolsProps) => {
  if (!markupState.markupEnabled) return null;

  return (
    <div className="absolute bottom-4 left-4 z-40 flex flex-col gap-3 p-4 bg-surface/95 backdrop-blur rounded-2xl shadow-lg border border-outline/20">
      <div className="flex gap-2">
        {[
          { tool: 'circle' as const, icon: 'circle', label: 'Circle' },
          { tool: 'rectangle' as const, icon: 'rectangle', label: 'Crop' },
          { tool: 'line' as const, icon: 'line_axis', label: 'Line' },
          { tool: 'text' as const, icon: 'text_fields', label: 'Text' },
        ].map(({ tool, icon, label }) => (
          <button
            key={tool}
            onClick={() => markupState.setActiveTool(tool)}
            className={`p-2 rounded-lg transition-all ${
              markupState.activeTool === tool
                ? 'bg-primary text-on-primary'
                : 'bg-surface-variant/30 hover:bg-surface-variant/50'
            }`}
            title={label}
          >
            <span className="material-symbols-rounded text-xl">{icon}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2 border-t border-outline/20 pt-3">
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium opacity-70">Color</label>
          <input
            type="color"
            value={markupState.markupColor}
            onChange={(e) => markupState.setMarkupColor(e.target.value)}
            className="w-8 h-8 rounded cursor-pointer"
          />
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-medium opacity-70">Stroke</label>
          <input
            type="range"
            min="1"
            max="10"
            value={markupState.strokeWidth}
            onChange={(e) => markupState.setStrokeWidth(parseInt(e.target.value))}
            className="flex-1"
          />
          <span className="text-xs w-6 text-right">{markupState.strokeWidth}</span>
        </div>
      </div>

      <div className="flex gap-2 border-t border-outline/20 pt-3">
        <button
          onClick={markupState.undo}
          disabled={markupState.drawings.length === 0}
          className="flex-1 py-2 px-3 text-xs rounded-lg bg-surface-variant/30 hover:bg-surface-variant/50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          title="Undo"
        >
          <span className="material-symbols-rounded text-sm inline">undo</span>
        </button>
        <button
          onClick={markupState.clear}
          disabled={markupState.drawings.length === 0}
          className="flex-1 py-2 px-3 text-xs rounded-lg bg-error/10 text-error/70 hover:bg-error/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          title="Clear all"
        >
          <span className="material-symbols-rounded text-sm inline">delete</span>
        </button>
      </div>
    </div>
  );
};
