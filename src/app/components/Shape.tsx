import React, { useState, useCallback, useEffect } from 'react';
import { ShapeProps, Position } from '../types';

export const Shape: React.FC<ShapeProps> = ({ 
  element, 
  isSelected, 
  isMultiSelected,
  onSelect, 
  onMove, 
  onResize, 
  onTextChange, 
  onDelete,
  selectedTool,
  onToolSelect
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [text, setText] = useState(element.text || '');
  const [dragStart, setDragStart] = useState<Position | null>(null);
  const [resizeStart, setResizeStart] = useState<{ pos: Position; width: number; height: number } | null>(null);
  const [resizeHandle, setResizeHandle] = useState<string | null>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isEditing) return; // Don't allow dragging while editing
    e.preventDefault();
    e.stopPropagation();
    
    if (selectedTool === 'move') {
      onSelect(element.id);
      setDragStart({ x: e.clientX - element.position.x, y: e.clientY - element.position.y });
    } else if (selectedTool === 'select') {
      onSelect(element.id);
      setDragStart({ x: e.clientX - element.position.x, y: e.clientY - element.position.y });
    }
  };

  const handleResizeMouseDown = (e: React.MouseEvent, handle: string) => {
    e.preventDefault();
    e.stopPropagation();
    setResizeHandle(handle);
    setResizeStart({
      pos: { x: e.clientX, y: e.clientY },
      width: element.width,
      height: element.height
    });
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isEditing) return; // Don't allow dragging while editing
    if (dragStart && !resizeStart) {
      onMove(element.id, {
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    } else if (resizeStart && resizeHandle) {
      const deltaX = e.clientX - resizeStart.pos.x;
      const deltaY = e.clientY - resizeStart.pos.y;
      
      let newWidth = resizeStart.width;
      let newHeight = resizeStart.height;
      let newX = element.position.x;
      let newY = element.position.y;
      
      if (resizeHandle.includes('right')) {
        newWidth = Math.max(20, resizeStart.width + deltaX);
      }
      if (resizeHandle.includes('left')) {
        newWidth = Math.max(20, resizeStart.width - deltaX);
        newX = element.position.x + (resizeStart.width - newWidth);
      }
      if (resizeHandle.includes('bottom')) {
        newHeight = Math.max(20, resizeStart.height + deltaY);
      }
      if (resizeHandle.includes('top')) {
        newHeight = Math.max(20, resizeStart.height - deltaY);
        newY = element.position.y + (resizeStart.height - newHeight);
      }
      
      // Update position if needed for left/top resizing
      if (newX !== element.position.x || newY !== element.position.y) {
        onMove(element.id, { x: newX, y: newY });
      }
      
      onResize(element.id, newWidth, newHeight);
    }
  }, [dragStart, resizeStart, resizeHandle, element.id, element.position, onMove, onResize, isEditing]);

  const handleMouseUp = useCallback(() => {
    const wasDragging = dragStart !== null;
    setDragStart(null);
    setResizeStart(null);
    setResizeHandle(null);
    
    // If we were dragging with move tool, deselect and reset to select
    if (wasDragging && selectedTool === 'move') {
      onSelect(''); // Deselect
      onToolSelect('select'); // Reset to select tool
    }
  }, [dragStart, selectedTool, onSelect, onToolSelect]);

  useEffect(() => {
    if ((dragStart || resizeStart) && !isEditing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [dragStart, resizeStart, handleMouseMove, handleMouseUp, isEditing]);

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsEditing(true);
    setText(element.text || '');
  };

  const handleTextSubmit = () => {
    onTextChange(element.id, text);
    
    // Auto-adjust height based on text content
    const lineCount = text.split('\n').length;
    const minHeight = 40;
    const lineHeight = 20;
    const newHeight = Math.max(minHeight, lineCount * lineHeight + 20); // 20px for padding
    
    if (newHeight !== element.height) {
      onResize(element.id, element.width, newHeight);
    }
    
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleTextSubmit();
    } else if (e.key === 'Enter' && e.shiftKey) {
      // Allow new line with Shift+Enter - let the default behavior happen
      // No need to preventDefault here
    } else if (e.key === 'Escape') {
      setText(element.text || '');
      setIsEditing(false);
    }
  };

  const style: React.CSSProperties = {
    position: 'absolute' as const,
    left: element.position.x,
    top: element.position.y,
    width: element.width,
    height: element.height,
    backgroundColor: element.hasTransparentFill ? 'transparent' : element.fillColor,
    border: element.borderColor === 'transparent' ? 'none' : `2px solid ${element.borderColor}`,
    borderRadius: element.type === 'circle' ? '50%' : '4px',
    cursor: dragStart ? 'grabbing' : (selectedTool === 'select' || selectedTool === 'move') ? 'grab' : 'default',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: element.zIndex + (isSelected ? 1000 : 0),
    boxShadow: isSelected ? '0 0 0 2px #3b82f6' : isMultiSelected ? '0 0 0 2px #10b981' : 'none',
  };

  return (
    <>
      <div
        style={style}
        onMouseDown={handleMouseDown}
        onDoubleClick={handleDoubleClick}
      >
        {isEditing ? (
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={handleTextSubmit}
            onKeyDown={handleKeyDown}
            className="bg-transparent text-center outline-none w-full resize-none overflow-hidden"
            style={{ 
              color: element.textColor,
              lineHeight: '1.2',
              minHeight: '20px'
            }}
            autoFocus
            rows={Math.max(1, text.split('\n').length)}
          />
        ) : (
          <div
            className="text-sm font-medium text-center px-2 select-none whitespace-pre-wrap leading-tight"
            style={{ 
              color: element.textColor,
              lineHeight: '1.2',
              overflow: 'hidden',
              wordBreak: 'break-word'
            }}
          >
            {element.text || 'Double-click to edit'}
          </div>
        )}
      </div>
      
      {/* Resize handles */}
      {isSelected && (
        <>
          {/* Corner handles */}
          <div
            style={{
              position: 'absolute',
              left: element.position.x - 6,
              top: element.position.y - 6,
              width: 12,
              height: 12,
              backgroundColor: '#3b82f6',
              cursor: 'nw-resize',
              zIndex: element.zIndex + 1001,
            }}
            onMouseDown={(e) => handleResizeMouseDown(e, 'top-left')}
          />
          <div
            style={{
              position: 'absolute',
              left: element.position.x + element.width - 6,
              top: element.position.y - 6,
              width: 12,
              height: 12,
              backgroundColor: '#3b82f6',
              cursor: 'ne-resize',
              zIndex: element.zIndex + 1001,
            }}
            onMouseDown={(e) => handleResizeMouseDown(e, 'top-right')}
          />
          <div
            style={{
              position: 'absolute',
              left: element.position.x - 6,
              top: element.position.y + element.height - 6,
              width: 12,
              height: 12,
              backgroundColor: '#3b82f6',
              cursor: 'sw-resize',
              zIndex: element.zIndex + 1001,
            }}
            onMouseDown={(e) => handleResizeMouseDown(e, 'bottom-left')}
          />
          <div
            style={{
              position: 'absolute',
              left: element.position.x + element.width - 6,
              top: element.position.y + element.height - 6,
              width: 12,
              height: 12,
              backgroundColor: '#3b82f6',
              cursor: 'se-resize',
              zIndex: element.zIndex + 1001,
            }}
            onMouseDown={(e) => handleResizeMouseDown(e, 'bottom-right')}
          />
          
          {/* Edge handles */}
          <div
            style={{
              position: 'absolute',
              left: element.position.x + element.width / 2 - 6,
              top: element.position.y - 6,
              width: 12,
              height: 12,
              backgroundColor: '#3b82f6',
              cursor: 'n-resize',
              zIndex: element.zIndex + 1001,
            }}
            onMouseDown={(e) => handleResizeMouseDown(e, 'top')}
          />
          <div
            style={{
              position: 'absolute',
              left: element.position.x + element.width / 2 - 6,
              top: element.position.y + element.height - 6,
              width: 12,
              height: 12,
              backgroundColor: '#3b82f6',
              cursor: 's-resize',
              zIndex: element.zIndex + 1001,
            }}
            onMouseDown={(e) => handleResizeMouseDown(e, 'bottom')}
          />
          <div
            style={{
              position: 'absolute',
              left: element.position.x - 6,
              top: element.position.y + element.height / 2 - 6,
              width: 12,
              height: 12,
              backgroundColor: '#3b82f6',
              cursor: 'w-resize',
              zIndex: element.zIndex + 1001,
            }}
            onMouseDown={(e) => handleResizeMouseDown(e, 'left')}
          />
          <div
            style={{
              position: 'absolute',
              left: element.position.x + element.width - 6,
              top: element.position.y + element.height / 2 - 6,
              width: 12,
              height: 12,
              backgroundColor: '#3b82f6',
              cursor: 'e-resize',
              zIndex: element.zIndex + 1001,
            }}
            onMouseDown={(e) => handleResizeMouseDown(e, 'right')}
          />
        </>
      )}
      
      {/* Connection points - show when drawing arrows/lines */}
      {(selectedTool === 'arrow' || selectedTool === 'line') && (
        <>
          {/* Generate connection points along the boundary */}
          {Array.from({ length: 20 }, (_, i) => {
            const t = i / 19; // 0 to 1
            let x, y;
            
            if (element.type === 'circle') {
              // For circles, place points around the circumference
              const angle = t * 2 * Math.PI;
              const centerX = element.position.x + element.width / 2;
              const centerY = element.position.y + element.height / 2;
              const radiusX = element.width / 2;
              const radiusY = element.height / 2;
              x = centerX + radiusX * Math.cos(angle);
              y = centerY + radiusY * Math.sin(angle);
            } else {
              // For rectangles, place points along the perimeter
              const perimeter = 2 * (element.width + element.height);
              const distance = t * perimeter;
              
              if (distance <= element.width) {
                // Top edge
                x = element.position.x + distance;
                y = element.position.y;
              } else if (distance <= element.width + element.height) {
                // Right edge
                x = element.position.x + element.width;
                y = element.position.y + (distance - element.width);
              } else if (distance <= 2 * element.width + element.height) {
                // Bottom edge
                x = element.position.x + element.width - (distance - element.width - element.height);
                y = element.position.y + element.height;
              } else {
                // Left edge
                x = element.position.x;
                y = element.position.y + element.height - (distance - 2 * element.width - element.height);
              }
            }
            
            return (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: x - 3,
                  top: y - 3,
                  width: 6,
                  height: 6,
                  backgroundColor: '#10b981',
                  borderRadius: '50%',
                  cursor: 'crosshair',
                  zIndex: element.zIndex + 1002,
                  opacity: 0.7,
                }}
                title="Connection point"
              />
            );
          })}
        </>
      )}
    </>
  );
};
