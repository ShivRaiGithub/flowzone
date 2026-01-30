'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Position, Element, ShapeElement, ConnectorElement, CurrentColors } from './types';
import { Toolbar } from './components/Toolbar';
import { Shape } from './components/Shape';
import { Connector } from './components/Connector';
import { FlowMate } from './components/FlowMate';

export default function Home() {
  const [elements, setElements] = useState<Element[]>([]);
  const [selectedTool, setSelectedTool] = useState('select');
  const [selectedElement, setSelectedElement] = useState<string | null>(null);
  const [selectedElements, setSelectedElements] = useState<string[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawingStart, setDrawingStart] = useState<Position | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<Position>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<Position | null>(null);
  const [selectionBox, setSelectionBox] = useState<{ start: Position; end: Position } | null>(null);
  const [currentColors, setCurrentColors] = useState<CurrentColors>({
    fill: '#ffffff',
    border: '#000000',
    text: '#000000',
    transparent: false
  });
  const canvasRef = useRef<HTMLDivElement>(null);
  const nextZIndex = useRef(1);

  const generateId = () => Math.random().toString(36).substr(2, 9);

  const handleZoomIn = () => {
    const newZoom = Math.min(3, zoom + 0.1);
    setZoom(newZoom);
  };

  const handleZoomOut = () => {
    const newZoom = Math.max(0.1, zoom - 0.1);
    setZoom(newZoom);
  };

  const handleZoomReset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // Line-rectangle intersection algorithm for selection
  const lineIntersectsRect = (
    x1: number, y1: number, x2: number, y2: number,
    rectX: number, rectY: number, rectWidth: number, rectHeight: number
  ): boolean => {
    const rectRight = rectX + rectWidth;
    const rectBottom = rectY + rectHeight;

    // Check if either endpoint is inside the rectangle
    if ((x1 >= rectX && x1 <= rectRight && y1 >= rectY && y1 <= rectBottom) ||
        (x2 >= rectX && x2 <= rectRight && y2 >= rectY && y2 <= rectBottom)) {
      return true;
    }

    // Check intersection with each edge of the rectangle
    const intersectLine = (
      ax1: number, ay1: number, ax2: number, ay2: number,
      bx1: number, by1: number, bx2: number, by2: number
    ): boolean => {
      const denom = (ax2 - ax1) * (by2 - by1) - (ay2 - ay1) * (bx2 - bx1);
      if (Math.abs(denom) < 1e-10) return false; // Lines are parallel

      const t = ((bx1 - ax1) * (by2 - by1) - (by1 - ay1) * (bx2 - bx1)) / denom;
      const u = ((bx1 - ax1) * (ay2 - ay1) - (by1 - ay1) * (ax2 - ax1)) / denom;

      return t >= 0 && t <= 1 && u >= 0 && u <= 1;
    };

    // Check intersection with all four edges of the rectangle
    return intersectLine(x1, y1, x2, y2, rectX, rectY, rectRight, rectY) || // Top edge
           intersectLine(x1, y1, x2, y2, rectRight, rectY, rectRight, rectBottom) || // Right edge
           intersectLine(x1, y1, x2, y2, rectRight, rectBottom, rectX, rectBottom) || // Bottom edge
           intersectLine(x1, y1, x2, y2, rectX, rectBottom, rectX, rectY); // Left edge
  };

  const getElementsInSelectionBox = (start: Position, end: Position): string[] => {
    const minX = Math.min(start.x, end.x);
    const minY = Math.min(start.y, end.y);
    const maxX = Math.max(start.x, end.x);
    const maxY = Math.max(start.y, end.y);
    const width = maxX - minX;
    const height = maxY - minY;

    return elements
      .filter(element => {
        if (element.type === 'box' || element.type === 'circle') {
          const shape = element as ShapeElement;
          // Check if any part of the shape overlaps with the selection box
          return !(shape.position.x + shape.width < minX ||
                   shape.position.x > maxX ||
                   shape.position.y + shape.height < minY ||
                   shape.position.y > maxY);
        } else {
          const connector = element as ConnectorElement;
          // Check if the line intersects with the selection rectangle
          return lineIntersectsRect(
            connector.position.x, connector.position.y,
            connector.endPosition.x, connector.endPosition.y,
            minX, minY, width, height
          );
        }
      })
      .map(element => element.id);
  };

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (!canvasRef.current) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left - pan.x) / zoom;
    const y = (e.clientY - rect.top - pan.y) / zoom;

    // Middle click for panning
    if (e.button === 1) {
      e.preventDefault();
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      return;
    }

    if (selectedTool === 'select') {
      // Start selection box for multi-select
      setSelectedElement(null);
      setSelectedElements([]);
      setSelectionBox({ start: { x, y }, end: { x, y } });
      setIsDrawing(true);
      return;
    }

    if (selectedTool === 'text') {
      // Create text element at click position
      const newElement: ShapeElement = {
        id: generateId(),
        type: 'box',
        position: { x, y },
        width: 150,
        height: 40,
        text: 'Double-click to edit',
        fillColor: 'transparent',
        borderColor: 'transparent',
        textColor: currentColors.text,
        hasTransparentFill: true,
        zIndex: nextZIndex.current++
      };
      setElements(prev => [...prev, newElement]);
      setSelectedElement(newElement.id);
      // Reset to select tool after creating element
      setSelectedTool('select');
      return;
    }

    if (selectedTool === 'box' || selectedTool === 'circle') {
      setDrawingStart({ x, y });
      setIsDrawing(true);
    } else if (selectedTool === 'arrow' || selectedTool === 'line') {
      const newElement: ConnectorElement = {
        id: generateId(),
        type: selectedTool as 'arrow' | 'line',
        position: { x, y },
        endPosition: { x: x + 100, y },
        fillColor: currentColors.fill,
        borderColor: currentColors.border,
        textColor: currentColors.text,
        hasTransparentFill: currentColors.transparent,
        strokeWidth: 2,
        zIndex: nextZIndex.current++
      };
      setElements(prev => [...prev, newElement]);
      setSelectedElement(newElement.id);
      setIsDrawing(true);
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (!canvasRef.current) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left - pan.x) / zoom;
    const y = (e.clientY - rect.top - pan.y) / zoom;

    if (isPanning && panStart) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      });
      return;
    }

    if (!isDrawing) return;

    // Handle selection box
    if (selectedTool === 'select' && selectionBox) {
      setSelectionBox(prev => prev ? { ...prev, end: { x, y } } : null);
      return;
    }

    if (drawingStart && (selectedTool === 'box' || selectedTool === 'circle')) {
      const width = Math.abs(x - drawingStart.x);
      const height = Math.abs(y - drawingStart.y);
      const left = Math.min(x, drawingStart.x);
      const top = Math.min(y, drawingStart.y);
      
      // Update or create the shape being drawn
      const elementId = selectedElement || generateId();
      const newElement: ShapeElement = {
        id: elementId,
        type: selectedTool as 'box' | 'circle',
        position: { x: left, y: top },
        width: Math.max(20, width),
        height: Math.max(20, height),
        text: '',
        fillColor: currentColors.transparent ? 'transparent' : currentColors.fill,
        borderColor: currentColors.border,
        textColor: currentColors.text,
        hasTransparentFill: currentColors.transparent,
        zIndex: nextZIndex.current++
      };

      if (selectedElement) {
        setElements(prev => prev.map(el => el.id === elementId ? newElement : el));
      } else {
        setElements(prev => [...prev, newElement]);
        setSelectedElement(elementId);
      }
    } else if (selectedElement && (selectedTool === 'arrow' || selectedTool === 'line')) {
      // Update connector end position
      setElements(prev => prev.map(el => {
        if (el.id === selectedElement && ('endPosition' in el)) {
          const connector = el as ConnectorElement;
          return { ...connector, endPosition: { x, y } };
        }
        return el;
      }));
    }
  };

  const handleCanvasMouseUp = () => {
    if (isPanning) {
      setIsPanning(false);
      setPanStart(null);
      return;
    }

    // Handle selection box completion
    if (selectedTool === 'select' && selectionBox) {
      const selectedIds = getElementsInSelectionBox(selectionBox.start, selectionBox.end);
      setSelectedElements(selectedIds);
      setSelectionBox(null);
    }
    
    setIsDrawing(false);
    setDrawingStart(null);
    
    // Reset to select tool after creating shapes/connectors
    if (selectedTool === 'box' || selectedTool === 'circle' || selectedTool === 'arrow' || selectedTool === 'line') {
      setSelectedTool('select');
    }
  };

  const handleElementMove = (id: string, newPosition: Position | null, newEndPosition?: Position) => {
    setElements(prev => prev.map(el => {
      if (el.id === id) {
        const updated = { ...el };
        if (newPosition) updated.position = newPosition;
        if (newEndPosition && 'endPosition' in updated) {
          (updated as ConnectorElement).endPosition = newEndPosition;
        }
        return updated;
      }
      return el;
    }));
  };

  const handleElementResize = (id: string, newWidth: number, newHeight: number) => {
    setElements(prev => prev.map(el => {
      if (el.id === id && ('width' in el)) {
        return { ...el, width: newWidth, height: newHeight } as Element;
      }
      return el;
    }));
  };

  const handleTextChange = (id: string, newText: string) => {
    setElements(prev => prev.map(el => 
      el.id === id ? { ...el, text: newText } : el
    ));
  };

  const handleColorChange = (colorType: string, value: string | boolean) => {
    setCurrentColors(prev => ({
      ...prev,
      [colorType]: colorType === 'transparent' ? value : value
    }));

    if (selectedElement) {
      setElements(prev => prev.map(el => {
        if (el.id === selectedElement) {
          const updated = { ...el };
          if (colorType === 'fill') updated.fillColor = value as string;
          else if (colorType === 'border') updated.borderColor = value as string;
          else if (colorType === 'text') updated.textColor = value as string;
          else if (colorType === 'transparent') updated.hasTransparentFill = value as boolean;
          return updated;
        }
        return el;
      }));
    }
  };

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      setSelectedElement(null);
      setSelectedElements([]);
      setSelectedTool('select');
      setIsDrawing(false);
      setDrawingStart(null);
      setSelectionBox(null);
    } else if (e.key === 'Delete') {
      if (selectedElements.length > 0) {
        setElements(prev => prev.filter(el => !selectedElements.includes(el.id)));
        setSelectedElements([]);
      } else if (selectedElement) {
        setElements(prev => prev.filter(el => el.id !== selectedElement));
        setSelectedElement(null);
      }
    } else if (e.key === 'c' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleCopyElement();
    }
  }, [selectedElement, selectedElements]);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // Smoother zoom with smaller increments
    const zoomFactor = 0.05;
    const delta = e.deltaY > 0 ? -zoomFactor : zoomFactor;
    const newZoom = Math.max(0.1, Math.min(3, zoom + delta));
    
    if (newZoom !== zoom) {
      // Adjust pan to zoom towards mouse position
      const zoomRatio = newZoom / zoom;
      setPan(prev => ({
        x: mouseX - (mouseX - prev.x) * zoomRatio,
        y: mouseY - (mouseY - prev.y) * zoomRatio
      }));
      
      setZoom(newZoom);
    }
  };

  const handleCreateElement = (element: ShapeElement | ConnectorElement) => {
    const elementWithZIndex = { ...element, zIndex: nextZIndex.current++ };
    setElements(prev => [...prev, elementWithZIndex]);
  };

  const handleConnect = (startId: string, endId: string) => {
    const startElement = elements.find(el => el.id === startId);
    const endElement = elements.find(el => el.id === endId);
    
    if (!startElement || !endElement) return;
    
    // Calculate border connection points
    const getBorderConnectionPoint = (element: Element, targetElement: Element): Position => {
      if (element.type === 'box' || element.type === 'circle') {
        const shape = element as ShapeElement;
        const centerX = shape.position.x + shape.width / 2;
        const centerY = shape.position.y + shape.height / 2;
        
        // Calculate target center
        const targetCenterX = targetElement.type === 'box' || targetElement.type === 'circle'
          ? targetElement.position.x + (targetElement as ShapeElement).width / 2
          : targetElement.position.x;
        const targetCenterY = targetElement.type === 'box' || targetElement.type === 'circle'
          ? targetElement.position.y + (targetElement as ShapeElement).height / 2
          : targetElement.position.y;
        
        // Calculate direction vector
        const dx = targetCenterX - centerX;
        const dy = targetCenterY - centerY;
        
        if (shape.type === 'circle') {
          // For circles, find point on circumference
          const radius = Math.min(shape.width, shape.height) / 2;
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance === 0) return { x: centerX, y: centerY };
          
          return {
            x: centerX + (dx / distance) * radius,
            y: centerY + (dy / distance) * radius
          };
        } else {
          // For rectangles, find intersection with border
          const halfWidth = shape.width / 2;
          const halfHeight = shape.height / 2;
          
          // Determine which edge to connect to
          const absX = Math.abs(dx);
          const absY = Math.abs(dy);
          
          if (absX / halfWidth > absY / halfHeight) {
            // Connect to left or right edge
            return {
              x: centerX + (dx > 0 ? halfWidth : -halfWidth),
              y: centerY + (dy / absX) * halfWidth
            };
          } else {
            // Connect to top or bottom edge
            return {
              x: centerX + (dx / absY) * halfHeight,
              y: centerY + (dy > 0 ? halfHeight : -halfHeight)
            };
          }
        }
      }
      
      return element.position;
    };
    
    // Calculate connection points on borders
    const startPos = getBorderConnectionPoint(startElement, endElement);
    const endPos = getBorderConnectionPoint(endElement, startElement);
    
    const newConnector: ConnectorElement = {
      id: generateId(),
      type: 'arrow',
      position: startPos,
      endPosition: endPos,
      fillColor: currentColors.fill,
      borderColor: currentColors.border,
      textColor: currentColors.text,
      hasTransparentFill: currentColors.transparent,
      strokeWidth: 2,
      zIndex: nextZIndex.current++,
      startConnection: startId,
      endConnection: endId
    };
    
    setElements(prev => [...prev, newConnector]);
  };

  const handleCopyElement = () => {
    if (selectedElement) {
      const elementToCopy = elements.find(el => el.id === selectedElement);
      if (elementToCopy) {
        const offset = 20; // Offset for the copy
        const newElement: Element = {
          ...elementToCopy,
          id: generateId(),
          position: {
            x: elementToCopy.position.x + offset,
            y: elementToCopy.position.y + offset
          },
          zIndex: nextZIndex.current++
        };
        
        // If it's a connector, also offset the end position
        if ('endPosition' in newElement) {
          (newElement as ConnectorElement).endPosition = {
            x: (elementToCopy as ConnectorElement).endPosition.x + offset,
            y: (elementToCopy as ConnectorElement).endPosition.y + offset
          };
        }
        
        setElements(prev => [...prev, newElement]);
        setSelectedElement(newElement.id);
      }
    } else if (selectedElements.length > 0) {
      const offset = 20;
      const newElements: Element[] = [];
      
      selectedElements.forEach(id => {
        const elementToCopy = elements.find(el => el.id === id);
        if (elementToCopy) {
          const newElement: Element = {
            ...elementToCopy,
            id: generateId(),
            position: {
              x: elementToCopy.position.x + offset,
              y: elementToCopy.position.y + offset
            },
            zIndex: nextZIndex.current++
          };
          
          // If it's a connector, also offset the end position
          if ('endPosition' in newElement) {
            (newElement as ConnectorElement).endPosition = {
              x: (elementToCopy as ConnectorElement).endPosition.x + offset,
              y: (elementToCopy as ConnectorElement).endPosition.y + offset
            };
          }
          
          newElements.push(newElement);
        }
      });
      
      setElements(prev => [...prev, ...newElements]);
      setSelectedElements(newElements.map(el => el.id));
    }
  };

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="w-full h-screen bg-gray-100 relative overflow-hidden">
      <Toolbar
        selectedTool={selectedTool}
        onToolSelect={setSelectedTool}
        onColorChange={handleColorChange}
        currentColors={currentColors}
        zoom={zoom}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onZoomReset={handleZoomReset}
      />
      
      <div
        ref={canvasRef}
        className="w-full h-full cursor-crosshair relative"
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={handleCanvasMouseUp}
        onWheel={handleWheel}
        style={{ 
          cursor: selectedTool === 'select' ? 'default' : 
                  selectedTool === 'move' ? 'grab' : 
                  isPanning ? 'grabbing' : 'crosshair' 
        }}
      >
        <div
          style={{
            transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`,
            transformOrigin: '0 0',
            width: '100%',
            height: '100%',
            position: 'relative',
          }}
        >
          {elements.map((element) => (
            element.type === 'box' || element.type === 'circle' ? (
              <Shape
                key={element.id}
                element={element as ShapeElement}
                isSelected={selectedElement === element.id}
                isMultiSelected={selectedElements.includes(element.id)}
                onSelect={setSelectedElement}
                onMove={handleElementMove}
                onResize={handleElementResize}
                onTextChange={handleTextChange}
                selectedTool={selectedTool}
                onToolSelect={setSelectedTool}
              />
            ) : (
              <Connector
                key={element.id}
                element={element as ConnectorElement}
                isSelected={selectedElement === element.id}
                isMultiSelected={selectedElements.includes(element.id)}
                onSelect={setSelectedElement}
                onMove={handleElementMove}
              />
            )
          ))}
          
          {/* Selection Box */}
          {selectionBox && (
            <div
              style={{
                position: 'absolute',
                left: Math.min(selectionBox.start.x, selectionBox.end.x),
                top: Math.min(selectionBox.start.y, selectionBox.end.y),
                width: Math.abs(selectionBox.end.x - selectionBox.start.x),
                height: Math.abs(selectionBox.end.y - selectionBox.start.y),
                border: '1px dashed #3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                pointerEvents: 'none',
                zIndex: 10000,
              }}
            />
          )}
        </div>
      </div>
      
      {(selectedElement || selectedElements.length > 0) && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-white p-3 rounded-lg shadow-lg text-sm text-gray-700 border flex items-center gap-3" style={{ zIndex: 999999 }}>
          <span>
            {selectedElements.length > 0 
              ? `${selectedElements.length} elements selected | Press Delete to remove | ESC to deselect`
              : 'Press Delete to remove selected element | ESC to deselect'
            }
          </span>
          <button
            onClick={handleCopyElement}
            className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-xs font-medium transition-colors"
            title="Copy selected element(s) (Ctrl+C)"
          >
            Copy
          </button>
        </div>
      )}
      
      <div className="fixed bottom-4 left-4 bg-white p-2 rounded-lg shadow-lg text-sm text-gray-600" style={{ zIndex: 999999 }}>
        Zoom: {Math.round(zoom * 100)}% | Tool: {selectedTool} | Scroll to zoom | Middle click + drag to pan
      </div>
      
      <FlowMate
        selectedElements={selectedElements}
        elements={elements}
        onCreateElement={handleCreateElement}
        onConnect={handleConnect}
        currentColors={currentColors}
        nextZIndex={nextZIndex.current}
      />
    </div>
  );
}
