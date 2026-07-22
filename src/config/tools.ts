export const ADJUSTMENT_TOOLS = [
  { id: 'exposure', label: 'Exposure', icon: 'exposure', min: -200, max: 200, neutral: 0, suffix: '' },
  { id: 'brightness', label: 'Brightness', icon: 'light_mode', min: 0, max: 200, neutral: 100, suffix: '' },
  { id: 'contrast', label: 'Contrast', icon: 'contrast', min: 0, max: 200, neutral: 100, suffix: '' },
  { id: 'highlights', label: 'Highlights', icon: 'wb_sunny', min: -100, max: 100, neutral: 0, suffix: '' },
  { id: 'shadows', label: 'Shadows', icon: 'brightness_3', min: -100, max: 100, neutral: 0, suffix: '' },
  { id: 'saturation', label: 'Saturation', icon: 'invert_colors', min: 0, max: 200, neutral: 100, suffix: '' },
  { id: 'vibrance', label: 'Vibrance', icon: 'palette', min: -100, max: 100, neutral: 0, suffix: '' },
  { id: 'temperature', label: 'Temperature', icon: 'thermostat', min: -100, max: 100, neutral: 0, suffix: '' },
  { id: 'tint', label: 'Tint', icon: 'colorize', min: -100, max: 100, neutral: 0, suffix: '' },
  { id: 'sharpness', label: 'Sharpness', icon: 'details', min: 0, max: 100, neutral: 0, suffix: '' },
  { id: 'vignette', label: 'Vignette', icon: 'vignette', min: 0, max: 100, neutral: 0, suffix: '' },
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
