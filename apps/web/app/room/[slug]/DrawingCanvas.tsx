"use client";

import { useEffect, useRef, useState, useCallback } from "react";

type Tool = "pencil" | "rectangle" | "circle" | "line";

interface DrawAction {
  type: Tool;
  color: string;
  strokeWidth: number;
  points?: { x: number; y: number }[];
  startPoint?: { x: number; y: number };
  endPoint?: { x: number; y: number };
}

export function DrawingCanvas({ roomId }: { roomId: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState<Tool>("pencil");
  const [color, setColor] = useState("#000000");
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [history, setHistory] = useState<ImageData[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [currentPoints, setCurrentPoints] = useState<{ x: number; y: number }[]>([]);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const currentAction = useRef<DrawAction | null>(null);

  const saveState = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(imageData);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, [history, historyIndex]);

  const undo = useCallback(() => {
    if (historyIndex <= 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const newIndex = historyIndex - 1;
    const imageData = history[newIndex];
    if (!imageData) return;
    ctx.putImageData(imageData, 0, 0);
    setHistoryIndex(newIndex);
  }, [history, historyIndex]);

  const redo = useCallback(() => {
    if (historyIndex >= history.length - 1) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const newIndex = historyIndex + 1;
    const imageData = history[newIndex];
    if (!imageData) return;
    ctx.putImageData(imageData, 0, 0);
    setHistoryIndex(newIndex);
  }, [history, historyIndex]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight - 60;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      saveState();
    }
  }, []);

  const getPosition = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const drawShape = (
    ctx: CanvasRenderingContext2D,
    action: DrawAction
  ) => {
    ctx.strokeStyle = action.color;
    ctx.lineWidth = action.strokeWidth;
    ctx.beginPath();

    if (action.type === "rectangle" && action.startPoint && action.endPoint) {
      ctx.rect(
        action.startPoint.x,
        action.startPoint.y,
        action.endPoint.x - action.startPoint.x,
        action.endPoint.y - action.startPoint.y
      );
    } else if (action.type === "circle" && action.startPoint && action.endPoint) {
      const radiusX = Math.abs(action.endPoint.x - action.startPoint.x) / 2;
      const radiusY = Math.abs(action.endPoint.y - action.startPoint.y) / 2;
      const centerX = action.startPoint.x + (action.endPoint.x - action.startPoint.x) / 2;
      const centerY = action.startPoint.y + (action.endPoint.y - action.startPoint.y) / 2;
      ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI);
    } else if (action.type === "line" && action.startPoint && action.endPoint) {
      ctx.moveTo(action.startPoint.x, action.startPoint.y);
      ctx.lineTo(action.endPoint.x, action.endPoint.y);
    }

    ctx.stroke();
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getPosition(e);
    setIsDrawing(true);
    setStartPoint(pos);
    setCurrentPoints([pos]);

    currentAction.current = {
      type: tool,
      color,
      strokeWidth,
      startPoint: pos,
    };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const pos = getPosition(e);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (tool === "pencil") {
      setCurrentPoints((prev) => [...prev, pos]);
      ctx.strokeStyle = color;
      ctx.lineWidth = strokeWidth;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      const points = [...currentPoints, pos];
      if (points.length > 1) {
        const prevPoint = points[points.length - 2];
        if (prevPoint) {
          ctx.moveTo(prevPoint.x, prevPoint.y);
          ctx.lineTo(pos.x, pos.y);
          ctx.stroke();
        }
      }
    } else {
      const imageData = history[historyIndex];
      if (imageData) {
        ctx.putImageData(imageData, 0, 0);
      }
      currentAction.current = {
        type: tool,
        color,
        strokeWidth,
        startPoint: startPoint!,
        endPoint: pos,
      };
      drawShape(ctx, currentAction.current);
    }
  };

  const handleMouseUp = () => {
    if (!isDrawing) return;
    setIsDrawing(false);

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (tool !== "pencil" && currentAction.current) {
      drawShape(ctx, currentAction.current);
    }

    saveState();
    setCurrentPoints([]);
    setStartPoint(null);
    currentAction.current = null;
  };

  return (
    <div className="flex flex-col h-screen">
      <div className="flex items-center gap-4 p-2 bg-gray-100 border-b">
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          className="w-10 h-10 cursor-pointer"
        />
        <input
          type="range"
          min="1"
          max="20"
          value={strokeWidth}
          onChange={(e) => setStrokeWidth(Number(e.target.value))}
          className="w-24"
        />
        <select
          value={tool}
          onChange={(e) => setTool(e.target.value as Tool)}
          className="px-2 py-1 border rounded"
        >
          <option value="pencil">Pencil</option>
          <option value="rectangle">Rectangle</option>
          <option value="circle">Circle</option>
          <option value="line">Line</option>
        </select>
        <button
          onClick={undo}
          disabled={historyIndex <= 0}
          className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
        >
          Undo
        </button>
        <button
          onClick={redo}
          disabled={historyIndex >= history.length - 1}
          className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
        >
          Redo
        </button>
      </div>
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className="cursor-crosshair"
      />
    </div>
  );
}