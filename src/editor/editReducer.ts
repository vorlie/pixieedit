import { createDefaultEdits, normalizeEdits, type AdjustmentKey, type CropState, type FilterId, type ImageEditState, type Rotation } from './editModel';
import type { AdjustmentValues } from './autoEnhance';

export type EditAction =
  | { type: 'load'; edits: ImageEditState }
  | { type: 'set-adjustment'; key: AdjustmentKey; value: number }
  | { type: 'replace-adjustments'; adjustments: AdjustmentValues }
  | { type: 'apply-auto-enhance'; adjustments: AdjustmentValues }
  | { type: 'set-crop'; crop?: CropState }
  | { type: 'set-filter'; filter: FilterId }
  | { type: 'set-rotation'; rotation: Rotation }
  | { type: 'set-flip'; axis: 'horizontal' | 'vertical'; value: boolean }
  | { type: 'reset' };

export function editReducer(state: ImageEditState, action: EditAction): ImageEditState {
  switch (action.type) {
    case 'load': return normalizeEdits(action.edits);
    case 'set-adjustment': return { ...state, [action.key]: action.value };
    case 'replace-adjustments':
    case 'apply-auto-enhance': return { ...state, ...action.adjustments };
    case 'set-crop': return { ...state, crop: action.crop ? { ...action.crop } : undefined };
    case 'set-filter': return { ...state, filter: action.filter };
    case 'set-rotation': return { ...state, rotation: action.rotation };
    case 'set-flip': return action.axis === 'horizontal' ? { ...state, flipH: action.value } : { ...state, flipV: action.value };
    case 'reset': return createDefaultEdits();
  }
}

