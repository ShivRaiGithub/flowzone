import React, { useState } from 'react';
import { Send, Bot, X, Loader2, ChevronLeft, ChevronRight, MessageSquare, Trash2 } from 'lucide-react';
import { Element, ShapeElement, ConnectorElement, Position } from '../types';

interface FlowMateProps {
  selectedElements: string[];
  elements: Element[];
  onCreateElement: (element: ShapeElement | ConnectorElement) => void;
  onConnect: (startId: string, endId: string) => void;
  currentColors: {
    fill: string;
    border: string;
    text: string;
    transparent: boolean;
  };
  nextZIndex: number;
}

interface AIAction {
  type: 'create_element' | 'connect_elements' | 'modify_text';
  data: any;
}

export const FlowMate: React.FC<FlowMateProps> = ({
  selectedElements,
  elements,
  onCreateElement,
  onConnect,
  currentColors,
  nextZIndex
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversation, setConversation] = useState<Array<{role: 'user' | 'assistant' | 'system', content: string}>>([]);

  const generateId = () => Math.random().toString(36).substr(2, 9);

  const calculateConnectionPoints = (element1: any, element2: any): { start: Position; end: Position } => {
    // Calculate center points of both elements
    const center1 = {
      x: element1.position.x + (element1.width || 0) / 2,
      y: element1.position.y + (element1.height || 0) / 2
    };
    const center2 = {
      x: element2.position.x + (element2.width || 0) / 2,
      y: element2.position.y + (element2.height || 0) / 2
    };

    // Calculate direction vector
    const dx = center2.x - center1.x;
    const dy = center2.y - center1.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance === 0) return { start: center1, end: center2 };

    // Normalize direction
    const unitX = dx / distance;
    const unitY = dy / distance;

    // Calculate border points
    const startPoint = {
      x: center1.x + unitX * (element1.width || 0) / 2,
      y: center1.y + unitY * (element1.height || 0) / 2
    };

    const endPoint = {
      x: center2.x - unitX * (element2.width || 0) / 2,
      y: center2.y - unitY * (element2.height || 0) / 2
    };

    return { start: startPoint, end: endPoint };
  };

  const getSelectedElementsInfo = () => {
    const selected = elements.filter(el => selectedElements.includes(el.id));
    return selected.map(el => ({
      id: el.id,
      type: el.type,
      text: el.text || '',
      position: el.position,
      ...(el.type === 'box' || el.type === 'circle' ? {
        width: (el as ShapeElement).width,
        height: (el as ShapeElement).height
      } : {
        endPosition: (el as ConnectorElement).endPosition
      })
    }));
  };

  const findOptimalPosition = (existingElements: Element[], selectedInfo: any[] = []): Position => {
    const elementWidth = 200;
    const elementHeight = 60;
    const minGap = 30;
    const maxDistance = 300; // Maximum distance from selected elements
    
    // If we have selected elements, try to place near them
    if (selectedInfo.length > 0) {
      // Calculate the bounding box of selected elements
      const selectedElements = selectedInfo.filter(el => el.position);
      if (selectedElements.length > 0) {
        const bounds = selectedElements.reduce((acc, el) => {
          const right = el.position.x + (el.width || 0);
          const bottom = el.position.y + (el.height || 0);
          return {
            minX: Math.min(acc.minX, el.position.x),
            minY: Math.min(acc.minY, el.position.y),
            maxX: Math.max(acc.maxX, right),
            maxY: Math.max(acc.maxY, bottom)
          };
        }, { 
          minX: selectedElements[0].position.x, 
          minY: selectedElements[0].position.y,
          maxX: selectedElements[0].position.x + (selectedElements[0].width || 0),
          maxY: selectedElements[0].position.y + (selectedElements[0].height || 0)
        });

        const centerX = (bounds.minX + bounds.maxX) / 2;
        const centerY = (bounds.minY + bounds.maxY) / 2;
        
        // Try preferred positions in order of priority
        const preferredPositions = [
          // Right of the selection group
          { x: bounds.maxX + minGap * 2, y: centerY - elementHeight / 2 },
          // Below the selection group
          { x: centerX - elementWidth / 2, y: bounds.maxY + minGap * 2 },
          // Left of the selection group
          { x: bounds.minX - elementWidth - minGap * 2, y: centerY - elementHeight / 2 },
          // Above the selection group
          { x: centerX - elementWidth / 2, y: bounds.minY - elementHeight - minGap * 2 },
          // Bottom-right diagonal
          { x: bounds.maxX + minGap, y: bounds.maxY + minGap },
          // Top-right diagonal
          { x: bounds.maxX + minGap, y: bounds.minY - elementHeight - minGap },
          // Bottom-left diagonal
          { x: bounds.minX - elementWidth - minGap, y: bounds.maxY + minGap },
          // Top-left diagonal
          { x: bounds.minX - elementWidth - minGap, y: bounds.minY - elementHeight - minGap }
        ];

        // Try each preferred position
        for (const pos of preferredPositions) {
          if (pos.x >= 20 && pos.y >= 20 && // Keep within canvas bounds
              isPositionValid(pos.x, pos.y, elementWidth, elementHeight, existingElements, minGap)) {
            return { x: pos.x, y: pos.y };
          }
        }
        
        // If preferred positions don't work, try positions in expanding circles around the center
        for (let radius = elementHeight + minGap; radius <= maxDistance; radius += 40) {
          for (let angle = 0; angle < 360; angle += 45) {
            const radian = (angle * Math.PI) / 180;
            const x = centerX + Math.cos(radian) * radius - elementWidth / 2;
            const y = centerY + Math.sin(radian) * radius - elementHeight / 2;
            
            // Check if this position is valid (no overlaps)
            if (x >= 20 && y >= 20 && 
                isPositionValid(x, y, elementWidth, elementHeight, existingElements, minGap)) {
              return { x, y };
            }
          }
        }
      }
    }
    
    // Fallback: Smart grid-based placement starting from top-left
    const canvasArea = { width: 1200, height: 800 };
    const gridStepX = elementWidth + minGap * 2;
    const gridStepY = elementHeight + minGap * 2;
    
    for (let row = 0; row < Math.floor(canvasArea.height / gridStepY); row++) {
      for (let col = 0; col < Math.floor(canvasArea.width / gridStepX); col++) {
        const x = 50 + col * gridStepX;
        const y = 50 + row * gridStepY;
        
        if (x + elementWidth < canvasArea.width - 50 && 
            y + elementHeight < canvasArea.height - 50 &&
            isPositionValid(x, y, elementWidth, elementHeight, existingElements, minGap)) {
          return { x, y };
        }
      }
    }
    
    // Final fallback: Random position with multiple attempts
    for (let attempts = 0; attempts < 50; attempts++) {
      const x = Math.random() * (canvasArea.width - elementWidth - 100) + 50;
      const y = Math.random() * (canvasArea.height - elementHeight - 100) + 50;
      
      if (isPositionValid(x, y, elementWidth, elementHeight, existingElements, minGap)) {
        return { x, y };
      }
    }
    
    // Last resort: Place with minimal overlap but ensure it's visible
    return { 
      x: Math.max(50, 300 + Math.random() * 100), 
      y: Math.max(50, 200 + Math.random() * 100) 
    };
  };

  const isPositionValid = (x: number, y: number, width: number, height: number, existingElements: Element[], minGap: number): boolean => {
    return !existingElements.some(el => {
      if (el.type === 'box' || el.type === 'circle') {
        const shape = el as ShapeElement;
        // Check if rectangles overlap with gap consideration
        return !(x > shape.position.x + shape.width + minGap ||
                 x + width < shape.position.x - minGap ||
                 y > shape.position.y + shape.height + minGap ||
                 y + height < shape.position.y - minGap);
      }
      return false;
    });
  };

  const processAIResponse = (response: string, selectedInfo: any[]) => {
    try {
      const actions: AIAction[] = [];
      
      // Enhanced connection detection
      const connectionPatterns = [
        /connect\s+["`']([^"`']+)["`']\s+to\s+["`']([^"`']+)["`']/gi,
        /connect\s+(\w+)\s+to\s+(\w+)/gi,
        /link\s+["`']([^"`']+)["`']\s+(?:with|to)\s+["`']([^"`']+)["`']/gi,
        /connect\s+the\s+["`']([^"`']+)["`']\s+(?:with|to)\s+["`']([^"`']+)["`']/gi
      ];
      
      connectionPatterns.forEach(pattern => {
        let match: RegExpExecArray | null;
        pattern.lastIndex = 0; // Reset regex state
        while ((match = pattern.exec(response)) !== null) {
          if (match.length >= 3) { // Ensure we have at least 3 elements [full match, group1, group2]
            const text1 = match[1];
            const text2 = match[2];
            
            // Ensure selectedInfo is an array and has elements
            if (Array.isArray(selectedInfo) && selectedInfo.length > 0) {
              const element1 = selectedInfo.find(el => 
                el && el.text && typeof el.text === 'string' && (
                  el.text.toLowerCase().includes(text1.toLowerCase()) ||
                  el.id === text1 ||
                  text1.toLowerCase().includes(el.text.toLowerCase())
                )
              );
              const element2 = selectedInfo.find(el => 
                el && el.text && typeof el.text === 'string' && (
                  el.text.toLowerCase().includes(text2.toLowerCase()) ||
                  el.id === text2 ||
                  text2.toLowerCase().includes(el.text.toLowerCase())
                )
              );
              
              if (element1 && element2 && element1.id !== element2.id) {
                actions.push({
                  type: 'connect_elements',
                  data: { startId: element1.id, endId: element2.id }
                });
              }
            }
          }
        }
      });
      
      // Enhanced element creation detection
      const createPatterns = [
        /create\s+(?:a\s+)?(?:new\s+)?(?:element|box|component|node)\s+(?:with\s+)?["`']([^"`']+)["`']/gi,
        /add\s+(?:a\s+)?(?:new\s+)?(?:element|box|component|node)\s+(?:with\s+)?["`']([^"`']+)["`']/gi,
        /make\s+(?:a\s+)?(?:new\s+)?(?:element|box|component|node)\s+(?:with\s+)?["`']([^"`']+)["`']/gi,
        /insert\s+["`']([^"`']+)["`']/gi
      ];
      
      createPatterns.forEach(pattern => {
        let match: RegExpExecArray | null;
        pattern.lastIndex = 0; // Reset regex state
        while ((match = pattern.exec(response)) !== null) {
          if (match.length >= 2 && match[1]) { // Ensure we have the captured group
            const text = match[1];
            if (text && typeof text === 'string' && text.length > 2) { // Avoid very short text
              const position = findOptimalPosition(elements, selectedInfo);
              
              actions.push({
                type: 'create_element',
                data: {
                  type: 'box',
                  text,
                  position
                }
              });
            }
          }
        }
      });
      
      // Fallback: Look for any quoted text longer than 5 characters if no actions found
      if (actions.length === 0) {
        const quotedTextRegex = /["`']([^"`']{5,})["`']/g;
        let match: RegExpExecArray | null;
        while ((match = quotedTextRegex.exec(response)) !== null) {
          if (match.length >= 2 && match[1]) {
            const text = match[1];
            // Avoid creating elements for common phrases that aren't content
            if (text && typeof text === 'string' && 
                !text.toLowerCase().includes('element') && 
                !text.toLowerCase().includes('component') &&
                !text.toLowerCase().includes('connect')) {
              const position = findOptimalPosition(elements, selectedInfo);
              
              actions.push({
                type: 'create_element',
                data: {
                  type: 'box',
                  text,
                  position
                }
              });
            }
          }
        }
      }
      
      return actions;
    } catch (error) {
      console.error('Error processing AI response:', error);
      return [];
    }
  };

  const isAlreadyConnected = (startId: string, endId: string): boolean => {
    return elements.some(el => {
      if (el.type === 'arrow' || el.type === 'line') {
        const connector = el as ConnectorElement;
        return (connector.startConnection === startId && connector.endConnection === endId) ||
               (connector.startConnection === endId && connector.endConnection === startId);
      }
      return false;
    });
  };

  const executeActions = (actions: AIAction[]) => {
    actions.forEach(action => {
      try {
        switch (action.type) {
          case 'create_element':
            const newElement: ShapeElement = {
              id: generateId(),
              type: action.data.type || 'box',
              position: action.data.position,
              width: 200,
              height: 60,
              text: action.data.text,
              fillColor: currentColors.transparent ? 'transparent' : currentColors.fill,
              borderColor: currentColors.border,
              textColor: currentColors.text,
              hasTransparentFill: currentColors.transparent,
              zIndex: nextZIndex
            };
            onCreateElement(newElement);
            break;
            
          case 'connect_elements':
            // Check if elements are already connected
            if (isAlreadyConnected(action.data.startId, action.data.endId)) {
              console.log('Elements are already connected, skipping connection');
              return;
            }
            
            // Find the actual elements from the main elements array
            const element1 = elements.find(el => el.id === action.data.startId);
            const element2 = elements.find(el => el.id === action.data.endId);
            
            if (element1 && element2 && 
                (element1.type === 'box' || element1.type === 'circle') &&
                (element2.type === 'box' || element2.type === 'circle')) {
              
              const connectionPoints = calculateConnectionPoints(element1, element2);
              
              // Create a connector that connects the borders
              const connector: ConnectorElement = {
                id: generateId(),
                type: 'arrow',
                position: connectionPoints.start,
                endPosition: connectionPoints.end,
                fillColor: currentColors.fill,
                borderColor: currentColors.border,
                textColor: currentColors.text,
                hasTransparentFill: currentColors.transparent,
                strokeWidth: 2,
                zIndex: nextZIndex,
                startConnection: element1.id,
                endConnection: element2.id
              };
              
              onCreateElement(connector);
            } else {
              console.log('Elements not found or not shapes, skipping connection');
            }
            break;
        }
      } catch (error) {
        console.error('Error executing action:', error);
      }
    });
  };

  const callGeminiAPI = async (userPrompt: string, selectedInfo: any[]): Promise<string> => {
    try {
      const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
      
      if (!apiKey) {
        throw new Error('Gemini API key not found. Please add NEXT_PUBLIC_GEMINI_API_KEY to your .env file.');
      }

      // Get existing connections information
      const existingConnections = elements
        .filter(el => el.type === 'arrow' || el.type === 'line')
        .map(el => {
          const connector = el as ConnectorElement;
          const startEl = elements.find(e => e.id === connector.startConnection);
          const endEl = elements.find(e => e.id === connector.endConnection);
          return {
            from: startEl?.text || startEl?.id || 'unknown',
            to: endEl?.text || endEl?.id || 'unknown'
          };
        });

      const systemPrompt = `You are FlowMate, an AI assistant for a visual canvas app called FlowZone. 

Your role is to help users organize, connect, and expand their visual elements intelligently.

CURRENT CANVAS STATE:
Selected elements: ${JSON.stringify(selectedInfo, null, 2)}

EXISTING CONNECTIONS:
${existingConnections.length > 0 ? 
  existingConnections.map(conn => `- "${conn.from}" → "${conn.to}"`).join('\n') : 
  'No existing connections'}

CAPABILITIES:
1. Create new elements: Use format "Create a new element with 'exact text content'"
2. Connect elements: Use format "Connect [element_text_or_id] to [element_text_or_id]"
3. Analyze relationships and suggest improvements

GUIDELINES:
- Be conversational but include specific actionable instructions
- When connecting elements, reference them by their text content or ID
- For creating elements, put the exact text in single quotes
- Consider logical flow, narrative structure, and visual organization
- Help build meaningful connections between concepts
- DO NOT create duplicate connections - check existing connections first
- If elements are already connected, suggest other ways to organize or expand

USER REQUEST: ${userPrompt}

Please provide a helpful response with specific actions I can take.`;

      const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: systemPrompt
            }]
          }],
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 1024,
          },
          safetySettings: [
            {
              category: "HARM_CATEGORY_HARASSMENT",
              threshold: "BLOCK_MEDIUM_AND_ABOVE"
            },
            {
              category: "HARM_CATEGORY_HATE_SPEECH",
              threshold: "BLOCK_MEDIUM_AND_ABOVE"
            },
            {
              category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
              threshold: "BLOCK_MEDIUM_AND_ABOVE"
            },
            {
              category: "HARM_CATEGORY_DANGEROUS_CONTENT",
              threshold: "BLOCK_MEDIUM_AND_ABOVE"
            }
          ]
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
        console.error('API Response Error:', response.status, errorData);
        throw new Error(`Gemini API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
      }

      const data = await response.json();
      console.log('API Response received:', data); // Debug log
      
      if (!data.candidates || 
          !Array.isArray(data.candidates) || 
          data.candidates.length === 0 || 
          !data.candidates[0] || 
          !data.candidates[0].content ||
          !data.candidates[0].content.parts ||
          !Array.isArray(data.candidates[0].content.parts) ||
          data.candidates[0].content.parts.length === 0 ||
          !data.candidates[0].content.parts[0] ||
          !data.candidates[0].content.parts[0].text) {
        console.error('Invalid API response structure:', data);
        throw new Error('Invalid response format from Gemini API - missing required fields');
      }

      return data.candidates[0].content.parts[0].text;

    } catch (error) {
      console.error('Gemini API error:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('API key')) {
          return 'Please configure your Gemini API key in the .env file (NEXT_PUBLIC_GEMINI_API_KEY).';
        }
        if (error.message.includes('Invalid response format')) {
          return 'Received an unexpected response from the AI service. Please try again.';
        }
        if (error.message.includes('missing required fields')) {
          return 'The AI service returned an incomplete response. Please try again.';
        }
        return `Error: ${error.message}`;
      }
      
      return 'Sorry, I encountered an error processing your request. Please check your API configuration and try again.';
    }
  };

  const handleSubmit = async () => {
    if (!prompt.trim()) return;
    
    setIsLoading(true);
    const selectedInfo = getSelectedElementsInfo();
    
    // Add user message to conversation
    const userMessage = { role: 'user' as const, content: prompt };
    setConversation(prev => [...prev, userMessage]);
    
    try {
      const response = await callGeminiAPI(prompt, selectedInfo);
      
      // Add AI response to conversation
      const aiMessage = { role: 'assistant' as const, content: response };
      setConversation(prev => [...prev, aiMessage]);
      
      // Process and execute actions if the response doesn't contain an error
      if (!response.toLowerCase().includes('error:') && !response.toLowerCase().includes('please configure')) {
        const actions = processAIResponse(response, selectedInfo);
        
        if (actions.length > 0) {
          // Keep track of which actions were actually executed
          const executedActions: string[] = [];
          const skippedActions: string[] = [];
          
          actions.forEach(action => {
            try {
              switch (action.type) {
                case 'create_element':
                  // Use improved positioning that considers selected elements
                  const improvedPosition = findOptimalPosition(elements, selectedInfo);
                  const newElement: ShapeElement = {
                    id: generateId(),
                    type: action.data.type || 'box',
                    position: improvedPosition,
                    width: 200,
                    height: 60,
                    text: action.data.text,
                    fillColor: currentColors.transparent ? 'transparent' : currentColors.fill,
                    borderColor: currentColors.border,
                    textColor: currentColors.text,
                    hasTransparentFill: currentColors.transparent,
                    zIndex: nextZIndex
                  };
                  onCreateElement(newElement);
                  executedActions.push(`🆕 Created element: "${action.data.text}"`);
                  break;
                  
                case 'connect_elements':
                  // Check if elements are already connected
                  if (isAlreadyConnected(action.data.startId, action.data.endId)) {
                    const start = selectedInfo.find(el => el.id === action.data.startId);
                    const end = selectedInfo.find(el => el.id === action.data.endId);
                    skippedActions.push(`⏭️ Skipped connection "${start?.text || 'element'}" → "${end?.text || 'element'}" (already connected)`);
                    return;
                  }
                  
                  // Find the actual elements from the main elements array
                  const element1 = elements.find(el => el.id === action.data.startId);
                  const element2 = elements.find(el => el.id === action.data.endId);
                  
                  if (element1 && element2 && 
                      (element1.type === 'box' || element1.type === 'circle') &&
                      (element2.type === 'box' || element2.type === 'circle')) {
                    
                    const connectionPoints = calculateConnectionPoints(element1, element2);
                    
                    // Create a connector that connects the borders
                    const connector: ConnectorElement = {
                      id: generateId(),
                      type: 'arrow',
                      position: connectionPoints.start,
                      endPosition: connectionPoints.end,
                      fillColor: currentColors.fill,
                      borderColor: currentColors.border,
                      textColor: currentColors.text,
                      hasTransparentFill: currentColors.transparent,
                      strokeWidth: 2,
                      zIndex: nextZIndex,
                      startConnection: element1.id,
                      endConnection: element2.id
                    };
                    
                    onCreateElement(connector);
                    const start = selectedInfo.find(el => el.id === action.data.startId);
                    const end = selectedInfo.find(el => el.id === action.data.endId);
                    executedActions.push(`🔗 Connected "${start?.text || 'element'}" → "${end?.text || 'element'}"`);
                  } else {
                    skippedActions.push(`❌ Could not connect elements (not found or not shapes)`);
                  }
                  break;
              }
            } catch (error) {
              console.error('Error executing action:', error);
              skippedActions.push(`❌ Error executing action: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
          });
          
          // Add a system message about actions taken with better formatting
          if (executedActions.length > 0 || skippedActions.length > 0) {
            let actionSummary = '';
            
            if (executedActions.length > 0) {
              actionSummary += `**Actions Completed:**\n${executedActions.join('\n')}`;
            }
            
            if (skippedActions.length > 0) {
              if (actionSummary) actionSummary += '\n\n';
              actionSummary += `**Actions Skipped:**\n${skippedActions.join('\n')}`;
            }
            
            const systemMessage = { 
              role: 'system' as const, 
              content: actionSummary
            };
            setConversation(prev => [...prev, systemMessage]);
          }
        }
      }
      
    } catch (error) {
      console.error('Error:', error);
      const errorMessage = { 
        role: 'assistant' as const, 
        content: 'Sorry, I encountered an error processing your request. Please check your internet connection and API configuration.' 
      };
      setConversation(prev => [...prev, errorMessage]);
    }
    
    setPrompt('');
    setIsLoading(false);
  };

  const handleNewChat = () => {
    setConversation([]);
    setPrompt('');
  };

  const selectedElementsText = elements
    .filter(el => selectedElements.includes(el.id))
    .map(el => el.text || `${el.type} element`)
    .join(', ');

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

  return (
    <>
      {/* Toggle Button - Side Arrow */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed top-1/2 -translate-y-1/2 bg-purple-600 hover:bg-purple-700 text-white shadow-lg transition-all duration-300 z-50 flex items-center justify-center ${
          isOpen 
            ? 'right-96 rounded-l-lg px-2 py-3' 
            : 'right-0 rounded-l-full px-3 py-4'
        }`}
        title="FlowMate AI Assistant"
      >
        {isOpen ? (
          <ChevronRight size={20} />
        ) : (
          <ChevronLeft size={20} />
        )}
      </button>

      {/* Sidebar Panel */}
      {isOpen && (
        <div className="fixed top-0 right-0 w-96 h-full bg-white shadow-2xl border-l border-gray-200 flex flex-col z-40">
          {/* Header */}
          <div className="bg-purple-600 text-white p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot size={20} />
              <h2 className="font-semibold">FlowMate</h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleNewChat}
                className="text-white hover:text-gray-200 transition-colors p-1 rounded"
                title="New Chat"
              >
                <MessageSquare size={18} />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="text-white hover:text-gray-200 transition-colors p-1 rounded"
                title="Close"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Selected Elements Info */}
          <div className="p-4 bg-gray-50 border-b">
            <h3 className="text-sm font-medium text-black mb-2">Selected Elements ({selectedElements.length})</h3>
            {selectedElements.length > 0 ? (
              <div className="text-sm text-black bg-white p-2 rounded border max-h-20 overflow-y-auto">
                {selectedElementsText || 'Elements without text'}
              </div>
            ) : (
              <div className="text-sm text-gray-500 italic">No elements selected</div>
            )}
          </div>

          {/* Conversation History */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {conversation.length === 0 && (
              <div className="text-center text-gray-500 py-8">
                <Bot size={48} className="mx-auto mb-4 text-gray-300" />
                <p className="text-sm font-medium mb-2">Welcome to FlowMate!</p>
                <p className="text-xs mb-3">Select elements and ask me to:</p>
                <ul className="text-xs space-y-1 text-left max-w-72 mx-auto">
                  <li>• <strong>Connect:</strong> "Connect the elements"</li>
                  <li>• <strong>Organize:</strong> "Arrange elements in order"</li>
                  <li>• <strong>Expand:</strong> "Add a bridge between the elements"</li>
                  <li>• <strong>Analyze:</strong> "Analyze these elements"</li>
                </ul>
              </div>
            )}
            
            {conversation.map((message, index) => (
              <div
                key={index}
                className={`p-3 rounded-lg ${
                  message.role === 'user'
                    ? 'bg-blue-100 ml-4'
                    : message.role === 'system'
                    ? 'bg-green-50 border border-green-200'
                    : 'bg-gray-100 mr-4'
                }`}
              >
                <div className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                  {message.role === 'user' ? (
                    <>👤 You</>
                  ) : message.role === 'system' ? (
                    <>⚡ Actions</>
                  ) : (
                    <>🤖 FlowMate</>
                  )}
                </div>
                <div className={`text-sm text-black ${
                  message.role === 'system' ? 'font-medium' : ''
                }`}>
                  {message.content.split('\n').map((line, lineIndex) => (
                    <div key={lineIndex} className={line.startsWith('**') ? 'font-semibold mb-1' : ''}>
                      {line.replace(/\*\*/g, '')}
                    </div>
                  ))}
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div className="bg-gray-100 mr-4 p-3 rounded-lg">
                <div className="text-xs text-gray-500 mb-1">FlowMate</div>
                <div className="flex items-center gap-2 text-sm text-black">
                  <Loader2 size={16} className="animate-spin" />
                  Thinking...
                </div>
              </div>
            )}
          </div>

          {/* Input Area */}
          <div className="p-4 border-t bg-white">
            <div className="flex gap-2">
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && !isLoading && handleSubmit()}
                placeholder={selectedElements.length > 0 ? "How can I help with these elements?" : "Select elements first, then ask me anything..."}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm text-black placeholder-gray-400"
                disabled={isLoading}
              />
              <button
                onClick={handleSubmit}
                disabled={!prompt.trim() || isLoading}
                className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 text-white p-2 rounded-lg transition-colors"
              >
                <Send size={16} />
              </button>
            </div>
            <div className="text-xs text-gray-500 mt-2">
              {selectedElements.length === 0 
                ? "💡 Select elements on the canvas to get started"
                : `✨ ${selectedElements.length} element${selectedElements.length > 1 ? 's' : ''} selected. Ask me to connect, organize, or expand!`
              }
            </div>
          </div>
        </div>
      )}
    </>
  );
};
