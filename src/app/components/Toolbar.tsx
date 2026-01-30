import React, { useState } from 'react';
import { Square, Circle, ArrowRight, Minus, Type, Eye, EyeOff, MousePointer, Move, ZoomIn, ZoomOut } from 'lucide-react';
import { ToolbarProps } from '../types';

export const Toolbar: React.FC<ToolbarProps> = ({ 
  onAddElement, 
  selectedTool, 
  onToolSelect, 
  onColorChange, 
  currentColors,
  zoom,
  onZoomIn,
  onZoomOut,
  onZoomReset
}) => {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [activeColorType, setActiveColorType] = useState<string>('fill');

  const tools = [
    { id: 'select', icon: MousePointer, label: 'Select' },
    { id: 'move', icon: Move, label: 'Move' },
    { id: 'text', icon: Type, label: 'Text' },
    { id: 'box', icon: Square, label: 'Box' },
    { id: 'circle', icon: Circle, label: 'Circle' },
    { id: 'arrow', icon: ArrowRight, label: 'Arrow' },
    { id: 'line', icon: Minus, label: 'Line' },
  ];

  const colors = [
    '#000000', '#ffffff', '#ef4444', '#f97316', '#eab308', 
    '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899'
  ];

  const handleColorSelect = (color: string) => {
    onColorChange(activeColorType, color);
    setShowColorPicker(false);
  };

  return (
    <div className="fixed top-4 left-4 bg-white rounded-lg shadow-lg p-4 border" style={{ zIndex: 999999 }}>
      <div className="flex items-center gap-2 mb-4">
        <img
      src="/FlowZone.png"  // This points to public/FlowZone.png
      alt="FlowZone Logo"
      width={150}           // Adjust width and height as needed
      height={120}
    />
      </div>
      
      <div className="flex flex-col gap-2 mb-4">
        {tools.map((tool) => (
          <button
            key={tool.id}
            onClick={() => onToolSelect(tool.id)}
            className={`flex items-center gap-2 px-3 py-2 rounded-md transition-colors ${
              selectedTool === tool.id 
                ? 'bg-blue-500 text-white' 
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            }`}
          >
            <tool.icon size={16} />
            {tool.label}
          </button>
        ))}
      </div>

      <div className="border-t pt-4">
        <p className="text-sm font-semibold text-gray-900 mb-2">Colors</p>
        <div className="flex flex-col gap-2">
          <button
            onClick={() => {
              setActiveColorType('fill');
              setShowColorPicker(!showColorPicker);
            }}
            className="flex items-center gap-2 px-3 py-2 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-900"
          >
            <div 
              className="w-4 h-4 rounded border"
              style={{ backgroundColor: currentColors.fill }}
            />
            Fill
          </button>
          
          <button
            onClick={() => {
              setActiveColorType('border');
              setShowColorPicker(!showColorPicker);
            }}
            className="flex items-center gap-2 px-3 py-2 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-900"
          >
            <div 
              className="w-4 h-4 rounded border-2"
              style={{ borderColor: currentColors.border, backgroundColor: 'transparent' }}
            />
            Border
          </button>

          <button
            onClick={() => {
              setActiveColorType('text');
              setShowColorPicker(!showColorPicker);
            }}
            className="flex items-center gap-2 px-3 py-2 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-900"
          >
            <Type size={16} style={{ color: currentColors.text }} />
            Text
          </button>

          <button
            onClick={() => onColorChange('transparent', !currentColors.transparent)}
            className="flex items-center gap-2 px-3 py-2 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-900"
          >
            {currentColors.transparent ? <EyeOff size={16} /> : <Eye size={16} />}
            {currentColors.transparent ? 'No Fill' : 'Fill'}
          </button>
        </div>

        {showColorPicker && (
          <div className="mt-2 p-2 bg-gray-50 rounded-md">
            <div className="grid grid-cols-5 gap-1">
              {colors.map((color) => (
                <button
                  key={color}
                  onClick={() => handleColorSelect(color)}
                  className="w-8 h-8 rounded border-2 border-gray-300 hover:border-gray-600"
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="border-t pt-4">
        <p className="text-sm font-semibold text-gray-900 mb-2">Zoom ({Math.round(zoom * 100)}%)</p>
        <div className="flex gap-2 mb-2">
          <button
            onClick={onZoomOut}
            className="flex items-center justify-center w-8 h-8 rounded bg-gray-100 hover:bg-gray-200 text-gray-900"
            title="Zoom Out"
          >
            <ZoomOut size={16} />
          </button>
          <button
            onClick={onZoomReset}
            className="flex-1 px-2 py-1 text-xs rounded bg-gray-100 hover:bg-gray-200 text-gray-900"
            title="Reset Zoom"
          >
            100%
          </button>
          <button
            onClick={onZoomIn}
            className="flex items-center justify-center w-8 h-8 rounded bg-gray-100 hover:bg-gray-200 text-gray-900"
            title="Zoom In"
          >
            <ZoomIn size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};
