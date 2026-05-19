"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
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
    const [showRoomModal, setShowRoomModal] = useState(false);
    const [roomModalMode, setRoomModalMode] = useState<"select" | "create" | "join" | "created">("select");
    const [roomName, setRoomName] = useState("");
    const [createdRoomSlug, setCreatedRoomSlug] = useState("");
    const [joinRoomSlug, setJoinRoomSlug] = useState("");
    const [creatingRoom, setCreatingRoom] = useState(false);
    const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

    const router = useRouter();

    const updateCanvasSize = useCallback(() => {
        setCanvasSize({ width: window.innerWidth, height: window.innerHeight });
    }, []);

    useEffect(() => {
        updateCanvasSize();
        window.addEventListener("resize", updateCanvasSize);
        return () => window.removeEventListener("resize", updateCanvasSize);
    }, [updateCanvasSize]);
    const HTTP_BACKEND = typeof window !== "undefined" 
        ? (process.env.NEXT_PUBLIC_HTTP_BACKEND || "http://localhost:3001")
        : "http://localhost:3001";

    async function handleCreateRoom() {
        if (!roomName.trim()) return;
        setCreatingRoom(true);
        const token = localStorage.getItem("token");
        if (!token) {
            alert("Please sign in first");
            router.push("/signin");
            setCreatingRoom(false);
            return;
        }
        try {
            const res = await fetch(`${HTTP_BACKEND}/room`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({ name: roomName.trim() })
            });
            if (res.ok) {
                const data = await res.json();
                setCreatedRoomSlug(data.room.slug);
                setRoomModalMode("created");
            } else {
                const data = await res.json();
                alert(data.message || "Failed to create room");
            }
        } catch (e) {
            console.error(e);
            alert("Failed to create room");
        }
        setCreatingRoom(false);
    }

    function handleJoinRoom() {
        const token = localStorage.getItem("token");
        if (!token) {
            alert("Please sign in first");
            router.push("/signin");
            return;
        }
        if (joinRoomSlug.trim()) {
            router.push(`/canvas/${joinRoomSlug.trim()}`);
            setShowRoomModal(false);
        }
    }

    function copyLink(slug: string) {
        const url = `${window.location.origin}/canvas/${slug}`;
        navigator.clipboard.writeText(url);
    }

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
                onOpenRoomModal={() => setShowRoomModal(true)}
            />

            {showRoomModal && (
                <div 
                    style={{
                        position: "fixed",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: "rgba(0, 0, 0, 0.7)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 2000
                    }}
                    onClick={() => setShowRoomModal(false)}
                >
                    <div 
                        style={{
                            backgroundColor: "#1e1e2e",
                            borderRadius: "16px",
                            padding: "24px",
                            width: "400px",
                            maxWidth: "90%",
                            color: "#fff"
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {roomModalMode === "select" && (
                            <>
                                <h2 style={{ marginBottom: "20px", fontSize: "20px", fontWeight: 600 }}>
                                    Rooms
                                </h2>
                                <button
                                    onClick={() => { setRoomModalMode("create"); setRoomName(""); }}
                                    style={{
                                        width: "100%",
                                        padding: "12px",
                                        marginBottom: "12px",
                                        backgroundColor: "#6366f1",
                                        border: "none",
                                        borderRadius: "8px",
                                        color: "#fff",
                                        fontSize: "16px",
                                        cursor: "pointer"
                                    }}
                                >
                                    Create New Room
                                </button>
                                <button
                                    onClick={() => { setRoomModalMode("join"); setJoinRoomSlug(""); }}
                                    style={{
                                        width: "100%",
                                        padding: "12px",
                                        backgroundColor: "rgba(255, 255, 255, 0.1)",
                                        border: "1px solid rgba(255, 255, 255, 0.2)",
                                        borderRadius: "8px",
                                        color: "#fff",
                                        fontSize: "16px",
                                        cursor: "pointer"
                                    }}
                                >
                                    Join Existing Room
                                </button>
                                <button
                                    onClick={() => setShowRoomModal(false)}
                                    style={{
                                            marginTop: "16px",
                                            width: "100%",
                                            padding: "8px",
                                            backgroundColor: "transparent",
                                            border: "none",
                                            color: "rgba(255, 255, 255, 0.5)",
                                            cursor: "pointer"
                                        }}
                                >
                                    Cancel
                                </button>
                            </>
                        )}

                        {roomModalMode === "create" && (
                            <>
                                <h2 style={{ marginBottom: "20px", fontSize: "20px", fontWeight: 600 }}>
                                    Create Room
                                </h2>
                                <input
                                    type="text"
                                    placeholder="Room name"
                                    value={roomName}
                                    onChange={(e) => setRoomName(e.target.value)}
                                    style={{
                                        width: "100%",
                                        padding: "12px",
                                        marginBottom: "16px",
                                        backgroundColor: "rgba(255, 255, 255, 0.1)",
                                        border: "1px solid rgba(255, 255, 255, 0.2)",
                                        borderRadius: "8px",
                                        color: "#fff",
                                        fontSize: "16px",
                                        outline: "none"
                                    }}
                                    onKeyDown={(e) => e.key === "Enter" && handleCreateRoom()}
                                />
                                <button
                                    onClick={handleCreateRoom}
                                    disabled={creatingRoom}
                                    style={{
                                        width: "100%",
                                        padding: "12px",
                                        backgroundColor: "#6366f1",
                                        border: "none",
                                        borderRadius: "8px",
                                        color: "#fff",
                                        fontSize: "16px",
                                        cursor: creatingRoom ? "not-allowed" : "pointer",
                                        opacity: creatingRoom ? 0.7 : 1
                                    }}
                                >
                                    {creatingRoom ? "Creating..." : "Create"}
                                </button>
                                <button
                                    onClick={() => setRoomModalMode("select")}
                                    style={{
                                            marginTop: "16px",
                                            width: "100%",
                                            padding: "8px",
                                            backgroundColor: "transparent",
                                            border: "none",
                                            color: "rgba(255, 255, 255, 0.5)",
                                            cursor: "pointer"
                                        }}
                                >
                                    Back
                                </button>
                            </>
                        )}

                        {roomModalMode === "join" && (
                            <>
                                <h2 style={{ marginBottom: "20px", fontSize: "20px", fontWeight: 600 }}>
                                    Join Room
                                </h2>
                                <input
                                    type="text"
                                    placeholder="Room code"
                                    value={joinRoomSlug}
                                    onChange={(e) => setJoinRoomSlug(e.target.value)}
                                    style={{
                                        width: "100%",
                                        padding: "12px",
                                        marginBottom: "16px",
                                        backgroundColor: "rgba(255, 255, 255, 0.1)",
                                        border: "1px solid rgba(255, 255, 255, 0.2)",
                                        borderRadius: "8px",
                                        color: "#fff",
                                        fontSize: "16px",
                                        outline: "none"
                                    }}
                                    onKeyDown={(e) => e.key === "Enter" && handleJoinRoom()}
                                />
                                <button
                                    onClick={handleJoinRoom}
                                    disabled={!joinRoomSlug.trim()}
                                    style={{
                                        width: "100%",
                                        padding: "12px",
                                        backgroundColor: "#6366f1",
                                        border: "none",
                                        borderRadius: "8px",
                                        color: "#fff",
                                        fontSize: "16px",
                                        cursor: joinRoomSlug.trim() ? "pointer" : "not-allowed",
                                        opacity: joinRoomSlug.trim() ? 1 : 0.7
                                    }}
                                >
                                    Join
                                </button>
                                <button
                                    onClick={() => setRoomModalMode("select")}
                                    style={{
                                            marginTop: "16px",
                                            width: "100%",
                                            padding: "8px",
                                            backgroundColor: "transparent",
                                            border: "none",
                                            color: "rgba(255, 255, 255, 0.5)",
                                            cursor: "pointer"
                                        }}
                                >
                                    Back
                                </button>
                            </>
                        )}

                        {roomModalMode === "created" && (
                            <>
                                <h2 style={{ marginBottom: "20px", fontSize: "20px", fontWeight: 600 }}>
                                    Room Created!
                                </h2>
                                <div style={{ 
                                    backgroundColor: "rgba(255, 255, 255, 0.1)", 
                                    padding: "12px", 
                                    borderRadius: "8px",
                                    marginBottom: "16px",
                                    textAlign: "center"
                                }}>
                                    <span style={{ color: "rgba(255, 255, 255, 0.6)", fontSize: "14px" }}>
                                        Room Code:
                                    </span>
                                    <div style={{ fontSize: "24px", fontWeight: 600, marginTop: "4px" }}>
                                        {createdRoomSlug}
                                    </div>
                                </div>
                                <p style={{ color: "rgba(255, 255, 255, 0.7)", marginBottom: "16px" }}>
                                    Share this link with others to collaborate:
                                </p>
                                <div style={{ 
                                    display: "flex", 
                                    gap: "8px",
                                    backgroundColor: "rgba(255, 255, 255, 0.1)",
                                    padding: "12px",
                                    borderRadius: "8px",
                                    marginBottom: "16px"
                                }}>
                                    <input
                                        readOnly
                                        value={`${typeof window !== "undefined" ? window.location.origin : ""}/canvas/${createdRoomSlug}`}
                                        style={{
                                            flex: 1,
                                            backgroundColor: "transparent",
                                            border: "none",
                                            color: "#fff",
                                            fontSize: "14px",
                                            outline: "none"
                                        }}
                                    />
                                    <button
                                        onClick={() => copyLink(createdRoomSlug)}
                                        style={{
                                            padding: "8px 16px",
                                            backgroundColor: "#6366f1",
                                            border: "none",
                                            borderRadius: "6px",
                                            color: "#fff",
                                            fontSize: "14px",
                                            cursor: "pointer"
                                        }}
                                    >
                                        Copy
                                    </button>
                                </div>
                                <button
                                    onClick={() => {
                                        router.push(`/canvas/${createdRoomSlug}`);
                                        setShowRoomModal(false);
                                    }}
                                    style={{
                                        width: "100%",
                                        padding: "12px",
                                        backgroundColor: "#22c55e",
                                        border: "none",
                                        borderRadius: "8px",
                                        color: "#fff",
                                        fontSize: "16px",
                                        cursor: "pointer",
                                        marginBottom: "12px"
                                    }}
                                >
                                    Open Room
                                </button>
                                <button
                                    onClick={() => {
                                        setRoomModalMode("select");
                                        setCreatedRoomSlug("");
                                    }}
                                    style={{
                                            width: "100%",
                                            padding: "8px",
                                            backgroundColor: "transparent",
                                            border: "none",
                                            color: "rgba(255, 255, 255, 0.5)",
                                            cursor: "pointer"
                                        }}
                                >
                                    Create Another
                                </button>
                            </>
                        )}
                    </div>
                </div>
            )}
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
    onResetZoom,
    onOpenRoomModal
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
    onResetZoom: () => void,
    onOpenRoomModal: () => void
}) {
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 640);
        checkMobile();
        window.addEventListener("resize", checkMobile);
        return () => window.removeEventListener("resize", checkMobile);
    }, []);

    const iconSize = isMobile ? 16 : 18;
    const buttonSize = isMobile ? 28 : 36;
    const dotSize = isMobile ? 14 : 22;
    const strokeWidthSlider = isMobile ? 50 : 80;
    const userAvatarSize = isMobile ? 20 : 26;
    const iconGap = isMobile ? 2 : 8;
    const separatorHeight = isMobile ? 16 : 24;

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
            gap: isMobile ? 2 : 8,
            padding: isMobile ? "4px 8px" : "8px 16px",
            marginTop: 12,
            maxWidth: isMobile ? "calc(100vw - 20px)" : "fit-content"
        }}>
            <IconButton 
                onClick={() => setSelectedTool("pencil")}
                activated={selectedTool === "pencil"}
                icon={<Pencil size={iconSize} />}
                size={buttonSize}
            />
            <IconButton 
                onClick={() => setSelectedTool("rect")}
                activated={selectedTool === "rect"}
                icon={<RectangleHorizontalIcon size={iconSize} />}
                size={buttonSize}
            />
            <IconButton 
                onClick={() => setSelectedTool("circle")}
                activated={selectedTool === "circle"}
                icon={<Circle size={iconSize} />}
                size={buttonSize}
            />
            <IconButton 
                onClick={() => setSelectedTool("line")}
                activated={selectedTool === "line"}
                icon={<Minus size={iconSize} />}
                size={buttonSize}
            />
            <IconButton 
                onClick={() => setSelectedTool("arrow")}
                activated={selectedTool === "arrow"}
                icon={<ArrowUpRight size={iconSize} />}
                size={buttonSize}
            />
            <IconButton 
                onClick={() => setSelectedTool("eraser")}
                activated={selectedTool === "eraser"}
                icon={<Eraser size={iconSize} />}
                size={buttonSize}
            />
            
            <div style={{ 
                width: "1px", 
                height: separatorHeight, 
                backgroundColor: "rgba(255, 255, 255, 0.15)", 
                margin: `0 ${iconGap}px`,
                flexShrink: 0
            }} />
            
            <div style={{ display: "flex", gap: isMobile ? "1px" : "4px", flexShrink: 0 }}>
                {COLORS.map(color => (
                    <div
                        key={color}
                        onClick={() => setStrokeColor(color)}
                        className="color-dot"
                        style={{
                            width: `${dotSize}px`,
                            height: `${dotSize}px`,
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
                height: separatorHeight, 
                backgroundColor: "rgba(255, 255, 255, 0.15)", 
                margin: `0 ${iconGap}px`,
                flexShrink: 0
            }} />
            
            <div style={{ display: "flex", alignItems: "center", gap: `${iconGap}px`, flexShrink: 0 }}>
                <input
                    type="range"
                    min="1"
                    max="20"
                    value={strokeWidth}
                    onChange={(e) => setStrokeWidth(Number(e.target.value))}
                    style={{ 
                        width: `${strokeWidthSlider}px`,
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
                height: separatorHeight, 
                backgroundColor: "rgba(255, 255, 255, 0.15)", 
                margin: `0 ${iconGap}px`,
                flexShrink: 0
            }} />
            
            <IconButton 
                onClick={onUndo}
                disabled={!canUndo}
                icon={<Undo2 size={iconSize} />}
                size={buttonSize}
            />
            <IconButton 
                onClick={onRedo}
                disabled={!canRedo}
                icon={<Redo2 size={iconSize} />}
                size={buttonSize}
            />

            <div style={{ 
                width: "1px", 
                height: separatorHeight, 
                backgroundColor: "rgba(255, 255, 255, 0.15)", 
                margin: `0 ${iconGap}px`,
                flexShrink: 0
            }} />

            <div style={{ display: "flex", alignItems: "center", gap: `${iconGap}px`, flexShrink: 0 }}>
                <div 
                    onClick={onOpenRoomModal}
                    style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: isMobile ? "4px" : "6px" }}
                    title="Create or Join Room"
                >
                    <Users size={isMobile ? 14 : 16} color="rgba(255, 255, 255, 0.7)" />
                </div>
                <div style={{ display: "flex", gap: "2px" }}>
                    {users.slice(0, isMobile ? 3 : 5).map((user, i) => (
                        <div
                            key={user.userId}
                            title={user.userName}
                            style={{
                                width: isMobile ? "22px" : "26px",
                                height: isMobile ? "22px" : "26px",
                                borderRadius: "50%",
                                backgroundColor: COLORS[i % COLORS.length],
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: isMobile ? "9px" : "11px",
                                fontWeight: "600",
                                color: "#fff",
                                border: "2px solid var(--bg-surface)",
                                marginLeft: i > 0 ? "-6px" : "0",
                                cursor: "pointer"
                            }}
                        >
                            {user.userName.charAt(0).toUpperCase()}
                        </div>
                    ))}
                    {!isMobile && users.length > 5 && (
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
                            marginLeft: "-6px"
                        }}>
                            {users.length - 3}+
                        </div>
                    )}
                </div>
            </div>

            <div style={{ 
                width: "1px", 
                height: separatorHeight, 
                backgroundColor: "rgba(255, 255, 255, 0.15)", 
                margin: isMobile ? "0 4px" : "0 8px",
                flexShrink: 0
            }} />

            <IconButton 
                onClick={onZoomOut}
                icon={<ZoomOut size={iconSize} />}
                size={buttonSize}
            />
            <span 
                onClick={onResetZoom}
                style={{ 
                    color: "rgba(255, 255, 255, 0.7)", 
                    fontSize: isMobile ? "10px" : "12px", 
                    minWidth: isMobile ? "32px" : "40px", 
                    textAlign: "center",
                    flexShrink: 0,
                    cursor: "pointer"
                }}
            >
                {Math.round(zoom * 100)}%
            </span>
            <IconButton 
                onClick={onZoomIn}
                icon={<ZoomIn size={iconSize} />}
                size={buttonSize}
            />
        </div>
    );
}