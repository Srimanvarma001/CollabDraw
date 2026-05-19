"use client";

import { useEffect, useRef, useState } from "react";
import { IconButton } from "./IconButton";
import { Circle, Pencil, RectangleHorizontalIcon, Undo2, Redo2, Minus, Users, ArrowUpRight, Eraser, ZoomIn, ZoomOut } from "lucide-react";
import { Game, UserPresence } from "@/draw/Game";

export type Tool = "circle" | "rect" | "pencil" | "line" | "arrow" | "eraser";

const COLORS = [
    "#ffffff",
    "#ef4444",
    "#f97316",
    "#eab308",
    "#22c55e",
    "#06b6d4",
    "#3b82f6",
    "#8b5cf6",
    "#ec4899",
];

export function Canvas({
    roomId,
    socket
}: {
    socket: WebSocket;
    roomId: string;
}) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [game, setGame] = useState<Game>();
    const [selectedTool, setSelectedTool] = useState<Tool>("pencil");
    const [strokeColor, setStrokeColor] = useState("#ffffff");
    const [strokeWidth, setStrokeWidth] = useState(2);
    const [canUndo, setCanUndo] = useState(false);
    const [canRedo, setCanRedo] = useState(false);
    const [users, setUsers] = useState<UserPresence[]>([]);
    const [zoom, setZoom] = useState(1);

    useEffect(() => {
        game?.setTool(selectedTool);
    }, [selectedTool, game]);

    useEffect(() => {
        game?.setStrokeColor(strokeColor);
    }, [strokeColor, game]);

    useEffect(() => {
        game?.setStrokeWidth(strokeWidth);
    }, [strokeWidth, game]);

    useEffect(() => {
        const interval = setInterval(() => {
            setCanUndo(game?.canUndo() ?? false);
            setCanRedo(game?.canRedo() ?? false);
            setUsers(game?.getUsers() ?? []);
            setZoom(game?.getZoom() ?? 1);
        }, 100);
        return () => clearInterval(interval);
    }, [game]);

    useEffect(() => {
        if (canvasRef.current) {
            const g = new Game(canvasRef.current, roomId, socket);
            setGame(g);

            return () => {
                g.destroy();
            }
        }
    }, [canvasRef, roomId, socket]);

    const handleZoomIn = () => {
        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;
        game?.zoomIn(centerX, centerY);
    };

    const handleZoomOut = () => {
        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;
        game?.zoomOut(centerX, centerY);
    };

    const handleResetZoom = () => {
        game?.resetView();
    };

    return (
        <div className="canvas-wrapper">
            <canvas 
                ref={canvasRef} 
                width={window.innerWidth} 
                height={window.innerHeight}
                className="drawing-canvas"
            />
            <Topbar 
                selectedTool={selectedTool} 
                setSelectedTool={setSelectedTool}
                strokeColor={strokeColor}
                setStrokeColor={setStrokeColor}
                strokeWidth={strokeWidth}
                setStrokeWidth={setStrokeWidth}
                onUndo={() => game?.undo()}
                onRedo={() => game?.redo()}
                canUndo={canUndo}
                canRedo={canRedo}
                users={users}
                zoom={zoom}
                onZoomIn={handleZoomIn}
                onZoomOut={handleZoomOut}
                onResetZoom={handleResetZoom}
            />
        </div>
    );
}

function Topbar({
    selectedTool, 
    setSelectedTool,
    strokeColor,
    setStrokeColor,
    strokeWidth,
    setStrokeWidth,
    onUndo,
    onRedo,
    canUndo,
    canRedo,
    users,
    zoom,
    onZoomIn,
    onZoomOut,
    onResetZoom
}: {
    selectedTool: Tool,
    setSelectedTool: (s: Tool) => void,
    strokeColor: string,
    setStrokeColor: (c: string) => void,
    strokeWidth: number,
    setStrokeWidth: (w: number) => void,
    onUndo: () => void,
    onRedo: () => void,
    canUndo: boolean,
    canRedo: boolean,
    users: UserPresence[],
    zoom: number,
    onZoomIn: () => void,
    onZoomOut: () => void,
    onResetZoom: () => void
}) {
    return (
        <div className="toolbar-glass toolbar-container" style={{
            position: "fixed",
            top: 12,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 1000,
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            padding: "8px 16px",
            marginTop: 12
        }}>
            <IconButton 
                onClick={() => setSelectedTool("pencil")}
                activated={selectedTool === "pencil"}
                icon={<Pencil size={18} />}
            />
            <IconButton 
                onClick={() => setSelectedTool("rect")}
                activated={selectedTool === "rect"}
                icon={<RectangleHorizontalIcon size={18} />}
            />
            <IconButton 
                onClick={() => setSelectedTool("circle")}
                activated={selectedTool === "circle"}
                icon={<Circle size={18} />}
            />
            <IconButton 
                onClick={() => setSelectedTool("line")}
                activated={selectedTool === "line"}
                icon={<Minus size={18} />}
            />
            <IconButton 
                onClick={() => setSelectedTool("arrow")}
                activated={selectedTool === "arrow"}
                icon={<ArrowUpRight size={18} />}
            />
            <IconButton 
                onClick={() => setSelectedTool("eraser")}
                activated={selectedTool === "eraser"}
                icon={<Eraser size={18} />}
            />
            
            <div style={{ 
                width: "1px", 
                height: "24px", 
                backgroundColor: "rgba(255, 255, 255, 0.15)", 
                margin: "0 8px",
                flexShrink: 0
            }} />
            
            <div style={{ display: "flex", gap: "4px", flexShrink: 0 }}>
                {COLORS.map(color => (
                    <div
                        key={color}
                        onClick={() => setStrokeColor(color)}
                        className="color-dot"
                        style={{
                            width: "22px",
                            height: "22px",
                            borderRadius: "50%",
                            backgroundColor: color,
                            cursor: "pointer",
                            border: strokeColor === color ? "2px solid rgba(255, 255, 255, 0.8)" : "2px solid transparent",
                            boxShadow: strokeColor === color ? "0 0 0 2px rgba(0, 0, 0, 0.5)" : "none",
                            transition: "all 0.15s ease",
                            flexShrink: 0
                        }}
                    />
                ))}
            </div>

            <div style={{ 
                width: "1px", 
                height: "24px", 
                backgroundColor: "rgba(255, 255, 255, 0.15)", 
                margin: "0 8px",
                flexShrink: 0
            }} />
            
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                <input
                    type="range"
                    min="1"
                    max="20"
                    value={strokeWidth}
                    onChange={(e) => setStrokeWidth(Number(e.target.value))}
                    style={{ 
                        width: "80px",
                        accentColor: "#6366f1"
                    }}
                />
                <span style={{ 
                    color: "rgba(255, 255, 255, 0.7)", 
                    fontSize: "12px", 
                    minWidth: "20px",
                    textAlign: "center"
                }}>
                    {strokeWidth}
                </span>
            </div>

            <div style={{ 
                width: "1px", 
                height: "24px", 
                backgroundColor: "rgba(255, 255, 255, 0.15)", 
                margin: "0 8px",
                flexShrink: 0
            }} />
            
            <IconButton 
                onClick={onUndo}
                disabled={!canUndo}
                icon={<Undo2 size={18} />}
            />
            <IconButton 
                onClick={onRedo}
                disabled={!canRedo}
                icon={<Redo2 size={18} />}
            />

            <div style={{ 
                width: "1px", 
                height: "24px", 
                backgroundColor: "rgba(255, 255, 255, 0.15)", 
                margin: "0 8px",
                flexShrink: 0
            }} />

            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                <Users size={16} color="rgba(255, 255, 255, 0.7)" />
                <div style={{ display: "flex", gap: "2px" }}>
                    {users.slice(0, 5).map((user, i) => (
                        <div
                            key={user.userId}
                            title={user.userName}
                            style={{
                                width: "26px",
                                height: "26px",
                                borderRadius: "50%",
                                backgroundColor: COLORS[i % COLORS.length],
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: "11px",
                                fontWeight: "600",
                                color: "#fff",
                                border: "2px solid var(--bg-surface)",
                                marginLeft: i > 0 ? "-8px" : "0",
                                cursor: "pointer"
                            }}
                        >
                            {user.userName.charAt(0).toUpperCase()}
                        </div>
                    ))}
                    {users.length > 5 && (
                        <div style={{
                            width: "26px",
                            height: "26px",
                            borderRadius: "50%",
                            backgroundColor: "rgba(255, 255, 255, 0.2)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "10px",
                            color: "rgba(255, 255, 255, 0.7)",
                            border: "2px solid var(--bg-surface)",
                            marginLeft: "-8px"
                        }}>
                            +{users.length - 5}
                        </div>
                    )}
                </div>
            </div>

            <div style={{ 
                width: "1px", 
                height: "24px", 
                backgroundColor: "rgba(255, 255, 255, 0.15)", 
                margin: "0 8px",
                flexShrink: 0
            }} />

            <IconButton 
                onClick={onZoomOut}
                icon={<ZoomOut size={18} />}
            />
            <span 
                onClick={onResetZoom}
                style={{ 
                    color: "rgba(255, 255, 255, 0.7)", 
                    fontSize: "12px", 
                    minWidth: "40px", 
                    textAlign: "center",
                    flexShrink: 0,
                    cursor: "pointer"
                }}
            >
                {Math.round(zoom * 100)}%
            </span>
            <IconButton 
                onClick={onZoomIn}
                icon={<ZoomIn size={18} />}
            />
        </div>
    );
}