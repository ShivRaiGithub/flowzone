import React, { useState, useCallback, useEffect } from 'react';
import { ConnectorProps, Position } from '../types';

export const Connector: React.FC<ConnectorProps> = ({ element, isSelected, isMultiSelected, onSelect, onMove, onDelete }) => {
  const [dragStart, setDragStart] = useState<Position | null>(null);
  const [dragPoint, setDragPoint] = useState<string | null>(null);
  const [isDraggingConnector, setIsDraggingConnector] = useState(false);

  const handleMouseDown = (e: React.MouseEvent, point: string) => {
    e.preventDefault();
    e.stopPropagation();
    onSelect(element.id);
    setDragPoint(point);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleConnectorMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onSelect(element.id);
    setIsDraggingConnector(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (dragStart) {
      const deltaX = e.clientX - dragStart.x;
      const deltaY = e.clientY - dragStart.y;
      
      if (isDraggingConnector) {
        // Move the entire connector
        onMove(element.id, {
          x: element.position.x + deltaX,
          y: element.position.y + deltaY
        }, {
          x: element.endPosition.x + deltaX,
          y: element.endPosition.y + deltaY
        });
      } else if (dragPoint === 'start') {
        onMove(element.id, {
          x: element.position.x + deltaX,
          y: element.position.y + deltaY
        });
      } else if (dragPoint === 'end') {
        onMove(element.id, null, {
          x: element.endPosition.x + deltaX,
          y: element.endPosition.y + deltaY
        });
      }
      
      setDragStart({ x: e.clientX, y: e.clientY });
    }
  }, [dragStart, dragPoint, isDraggingConnector, element, onMove]);

  const handleMouseUp = useCallback(() => {
    setDragStart(null);
    setDragPoint(null);
    setIsDraggingConnector(false);
  }, []);

  useEffect(() => {
    if (dragStart) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [dragStart, handleMouseMove, handleMouseUp]);

  const startX = element.position.x;
  const startY = element.position.y;
  const endX = element.endPosition.x;
  const endY = element.endPosition.y;

  const length = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(startY - endY, 2));
  const angle = Math.atan2(endY - startY, endX - startX);

  return (
    <svg
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: element.zIndex + (isSelected ? 1000 : 0),
      }}
    >
      <defs>
        <marker
          id={`arrowhead-${element.id}`}
          markerWidth="10"
          markerHeight="7"
          refX="9"
          refY="3.5"
          orient="auto"
        >
          <polygon
            points="0 0, 10 3.5, 0 7"
            fill={element.borderColor}
          />
        </marker>
      </defs>
      
      <line
        x1={startX}
        y1={startY}
        x2={endX}
        y2={endY}
        stroke={element.borderColor}
        strokeWidth={element.strokeWidth}
        markerEnd={element.type === 'arrow' ? `url(#arrowhead-${element.id})` : 'none'}
        style={{ 
          pointerEvents: 'stroke',
          strokeLinecap: 'round',
          filter: isSelected ? 'drop-shadow(0 0 4px #3b82f6)' : isMultiSelected ? 'drop-shadow(0 0 4px #10b981)' : 'none',
          cursor: 'move'
        }}
        onClick={() => onSelect(element.id)}
        onMouseDown={handleConnectorMouseDown}
      />
      
      {isSelected && (
        <>
          <circle
            cx={startX}
            cy={startY}
            r="6"
            fill="#3b82f6"
            style={{ pointerEvents: 'all', cursor: 'grab' }}
            onMouseDown={(e) => handleMouseDown(e, 'start')}
          />
          <circle
            cx={endX}
            cy={endY}
            r="6"
            fill="#3b82f6"
            style={{ pointerEvents: 'all', cursor: 'grab' }}
            onMouseDown={(e) => handleMouseDown(e, 'end')}
          />
        </>
      )}
    </svg>
  );
};
