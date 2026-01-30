// Types
export interface Position {
  x: number;
  y: number;
}

export interface BaseElement {
  id: string;
  type: 'box' | 'circle' | 'arrow' | 'line';
  position: Position;
  text?: string;
  fillColor: string;
  borderColor: string;
  textColor: string;
  hasTransparentFill: boolean;
  zIndex: number;
  connections?: string[]; // Array of connected element IDs
}

export interface ShapeElement extends BaseElement {
  type: 'box' | 'circle';
  width: number;
  height: number;
}

export interface ConnectorElement extends BaseElement {
  type: 'arrow' | 'line';
  endPosition: Position;
  strokeWidth: number;
  startConnection?: string; // ID of element this connector starts from
  endConnection?: string; // ID of element this connector ends at
}

export type Element = ShapeElement | ConnectorElement;

export interface CurrentColors {
  fill: string;
  border: string;
  text: string;
  transparent: boolean;
}

export interface ToolbarProps {
  onAddElement?: () => void;
  selectedTool: string;
  onToolSelect: (tool: string) => void;
  onColorChange: (colorType: string, value: string | boolean) => void;
  currentColors: CurrentColors;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
}

export interface ShapeProps {
  element: ShapeElement;
  isSelected: boolean;
  isMultiSelected: boolean;
  onSelect: (id: string) => void;
  onMove: (id: string, newPosition: Position | null, newEndPosition?: Position) => void;
  onResize: (id: string, newWidth: number, newHeight: number) => void;
  onTextChange: (id: string, text: string) => void;
  onDelete?: (id: string) => void;
  selectedTool: string;
  onToolSelect: (tool: string) => void;
}

export interface ConnectorProps {
  element: ConnectorElement;
  isSelected: boolean;
  isMultiSelected: boolean;
  onSelect: (id: string) => void;
  onMove: (id: string, newPosition: Position | null, newEndPosition?: Position) => void;
  onDelete?: (id: string) => void;
}
