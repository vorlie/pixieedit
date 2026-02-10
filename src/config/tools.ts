export const ADJUSTMENT_TOOLS = [
  { id: 'brightness', label: 'Brightness', icon: 'light_mode' },
  { id: 'contrast', label: 'Contrast', icon: 'contrast' },
  { id: 'saturation', label: 'Saturation', icon: 'invert_colors' },
  { id: 'warmth', label: 'Warmth', icon: 'thermostat' },
] as const;

export const CROP_TOOLS = [
  { id: 'x', label: 'Initial X', icon: 'align_horizontal_left' },
  { id: 'y', label: 'Initial Y', icon: 'align_vertical_top' },
  { id: 'width', label: 'Width', icon: 'width' },
  { id: 'height', label: 'Height', icon: 'height' },
] as const;

export const CROP_TOOLS_MOBILE = [
  { id: 'x', label: 'X', icon: 'align_horizontal_left' },
  { id: 'y', label: 'Y', icon: 'align_vertical_top' },
  { id: 'width', label: 'W', icon: 'width' },
  { id: 'height', label: 'H', icon: 'height' },
] as const;

export const PRESET_PRESETS = [
  'Default',
  'Vivid',
  'Warm',
  'Cool',
  'Mono',
] as const;

export const MAIN_TABS = [
  { id: 'suggestions', label: 'Suggestions', icon: 'magic_button' },
  { id: 'crop', label: 'Crop', icon: 'crop' },
  { id: 'adjust', label: 'Adjust', icon: 'tune' },
  { id: 'filters', label: 'Filters', icon: 'filter_vintage' },
  { id: 'markup', label: 'Markup', icon: 'brush' },
] as const;
