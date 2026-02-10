import { TOOLS_STATUS, getStatusColor, getStatusLabel } from '../config/toolsStatus';

export const StatusBar = () => {
  const experimentalTools = TOOLS_STATUS.filter(tool => tool.status !== 'stable');

  if (experimentalTools.length === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-surface border-t border-outline/10 px-4 py-2 z-50 pointer-events-none">
      <div className="flex items-center gap-4 overflow-x-auto no-scrollbar text-xs">
        {experimentalTools.map(tool => (
          <div
            key={tool.id}
            className="flex items-center gap-2 whitespace-nowrap"
            title={tool.note}
          >
            <div className="flex items-center gap-1.5">
              <span className={`inline-block w-2 h-2 rounded-full ${getStatusColor(tool.status)}`} />
              <span className="font-medium">{tool.name}</span>
              <span className={`text-[10px] font-semibold ${getStatusColor(tool.status)}`}>
                {getStatusLabel(tool.status)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
