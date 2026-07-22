export type ToolStatus = 'stable' | 'experimental' | 'in-development';

export interface ToolStatusInfo {
  id: string;
  name: string;
  status: ToolStatus;
  note?: string;
}

export const TOOLS_STATUS: ToolStatusInfo[] = [
  {
    id: 'adjust',
    name: 'Adjust',
    status: 'stable',
  },
  {
    id: 'crop',
    name: 'Crop',
    status: 'stable',
  },
  {
    id: 'suggestions',
    name: 'Suggestions',
    status: 'stable',
  },
  {
    id: 'markup',
    name: 'Markup',
    status: 'experimental',
    note: 'Circle, rectangle, line, and text annotations',
  },
  {
    id: 'filters',
    name: 'Filters',
    status: 'stable',
  },
];

export const getToolStatus = (toolId: string): ToolStatusInfo | undefined => {
  return TOOLS_STATUS.find(tool => tool.id === toolId);
};

export const getStatusColor = (status: ToolStatus): string => {
  switch (status) {
    case 'stable':
      return 'text-green-600 dark:text-green-400';
    case 'experimental':
      return 'text-yellow-600 dark:text-yellow-400';
    case 'in-development':
      return 'text-orange-600 dark:text-orange-400';
    default:
      return 'text-on-surface-variant';
  }
};

export const getStatusLabel = (status: ToolStatus): string => {
  switch (status) {
    case 'stable':
      return 'Stable';
    case 'experimental':
      return 'Experimental';
    case 'in-development':
      return 'In Development';
    default:
      return 'Unknown';
  }
};
