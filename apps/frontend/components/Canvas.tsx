"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { IconButton } from "./IconButton";
import { Circle, Pencil, RectangleHorizontalIcon, Undo2, Redo2, Minus, Users, ArrowUpRight, Eraser, ZoomIn, ZoomOut, Type, MousePointer2, Download, MessageSquare } from "lucide-react";
import { Game, UserPresence } from "@/draw/Game";
import { HTTP_BACKEND } from "@/config";
import { describeError } from "@/lib/errors";
import { getCurrentUserId } from "@/lib/auth";
import { ChatEntry } from "@/draw/shapes";
import { ChatPanel } from "./ChatPanel";

/** Merges chat messages by id, oldest first. */
function mergeChat(prev: ChatEntry[], incoming: ChatEntry[]): ChatEntry[] {
    const byId = new Map(prev.map(m => [m.id, m]));
    for (const m of incoming) byId.set(m.id, m);
    return Array.from(byId.values()).sort((a, b) => a.sentAt.localeCompare(b.sentAt));
}

export type Tool = "select" | "circle" | "rect" | "pencil" | "line" | "arrow" | "eraser" | "text";

const COLORS = [
    "#ffffff",
    "#ef4444",
    "#f97316",
    "#eab308",
    "#22c55e",
    "#06b6d4",
    "#3b82f6",
    "#2563eb",
    "#ec4899",
];

export function Canvas({
    roomId,
    socket,
    users
}: {
    socket: WebSocket;
    roomId: string;
    users: UserPresence[];
}) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [game, setGame] = useState<Game>();
    const [selectedTool, setSelectedTool] = useState<Tool>("pencil");
    const [strokeColor, setStrokeColor] = useState("#ffffff");
    const [strokeWidth, setStrokeWidth] = useState(2);
    const [canUndo, setCanUndo] = useState(false);
    const [canRedo, setCanRedo] = useState(false);
    const [zoom, setZoom] = useState(1);
    const [showRoomModal, setShowRoomModal] = useState(false);
    const [roomModalMode, setRoomModalMode] = useState<"select" | "create" | "join" | "created">("select");
    const [roomName, setRoomName] = useState("");
    const [roomPrivate, setRoomPrivate] = useState(false);
    const [createdRoomSlug, setCreatedRoomSlug] = useState("");
    const [joinRoomSlug, setJoinRoomSlug] = useState("");
    const [creatingRoom, setCreatingRoom] = useState(false);
    const [textInput, setTextInput] = useState<{ x: number; y: number; text: string } | null>(null);
    const [chat, setChat] = useState<ChatEntry[]>([]);
    const [chatOpen, setChatOpen] = useState(false);
    const [unread, setUnread] = useState(0);
    const chatOpenRef = useRef(chatOpen);
    chatOpenRef.current = chatOpen;
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);

    useEffect(() => {
        setCurrentUserId(getCurrentUserId());
    }, []);

    const router = useRouter();

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
                body: JSON.stringify({ name: roomName.trim(), isPrivate: roomPrivate })
            });
            if (res.ok) {
                const data = await res.json();
                setCreatedRoomSlug(data.room.slug);
                setRoomModalMode("created");
            } else {
                const data = await res.json();
                alert(describeError(data) || "Failed to create room");
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
        if (selectedTool !== "text") {
            setTextInput(null);
        }
    }, [selectedTool]);

    useEffect(() => {
        const interval = setInterval(() => {
            setCanUndo(game?.canUndo() ?? false);
            setCanRedo(game?.canRedo() ?? false);
            setZoom(game?.getZoom() ?? 1);
        }, 100);
        return () => clearInterval(interval);
    }, [game]);

    useEffect(() => {
        if (canvasRef.current) {
            const g = new Game(canvasRef.current, roomId, socket);
            g.onChat = (entries, replace) => {
                // History only grows, so merging by id also keeps messages
                // that arrived while it was being (re)loaded.
                setChat(prev => mergeChat(prev, entries));
                if (!replace && !chatOpenRef.current) {
                    setUnread(n => n + entries.filter(e => e.userId !== getCurrentUserId()).length);
                }
            };
            g.setTool(selectedTool);
            g.setStrokeColor(strokeColor);
            g.setStrokeWidth(strokeWidth);
            setGame(g);

            return () => {
                g.destroy();
            }
        }
        // The game outlives reconnects; a new socket is handed over below.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [canvasRef, roomId]);

    useEffect(() => {
        game?.setSocket(socket);
    }, [game, socket]);

    useEffect(() => {
        game?.setUsers(users);
    }, [game, users]);

    const handleExport = async () => {
        const blob = await game?.exportPng();
        if (!blob) {
            alert("Nothing to export yet - draw something first.");
            return;
        }
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${roomId}.png`;
        link.click();
        URL.revokeObjectURL(url);
    };

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

    const handleToolChange = (tool: Tool) => {
        setSelectedTool(tool);
        game?.setTool(tool);
    };

    const handleColorChange = (color: string) => {
        setStrokeColor(color);
        game?.setStrokeColor(color);
    };

    const handleStrokeWidthChange = (width: number) => {
        setStrokeWidth(width);
        game?.setStrokeWidth(width);
    };

    const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (selectedTool === "text" && !textInput) {
            e.preventDefault();
            e.stopPropagation();
            const rect = canvasRef.current?.getBoundingClientRect();
            if (rect) {
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                setTimeout(() => {
                    setTextInput({ x, y, text: "" });
                }, 0);
            }
        }
    };

    const handleTextSubmit = () => {
        setTimeout(() => {
            if (textInput && textInput.text.trim() && game) {
                game.addText(textInput.x, textInput.y, textInput.text.trim(), strokeColor, strokeWidth * 10);
                setTextInput(null);
            }
        }, 0);
    };

    return (
        <div className="canvas-wrapper">
            <canvas 
                ref={canvasRef} 
                className="drawing-canvas"
                onMouseDown={handleCanvasMouseDown}
            />
            {textInput && (
                <input
                    autoFocus
                    type="text"
                    value={textInput.text}
                    onChange={(e) => setTextInput({ ...textInput, text: e.target.value })}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") handleTextSubmit();
                        if (e.key === "Escape") setTextInput(null);
                    }}
                    onBlur={handleTextSubmit}
                    style={{
                        position: "fixed",
                        left: textInput.x,
                        top: textInput.y,
                        background: "rgba(0, 0, 0, 0.8)",
                        border: `1px solid ${strokeColor}`,
                        borderRadius: "4px",
                        color: strokeColor,
                        fontSize: `${strokeWidth * 10}px`,
                        fontFamily: "sans-serif",
                        outline: "none",
                        minWidth: "100px",
                        padding: "4px 8px",
                        zIndex: 9999
                    }}
                />
            )}
            <Topbar 
                selectedTool={selectedTool} 
                setSelectedTool={handleToolChange}
                strokeColor={strokeColor}
                setStrokeColor={handleColorChange}
                strokeWidth={strokeWidth}
                setStrokeWidth={handleStrokeWidthChange}
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
                onExport={handleExport}
                chatOpen={chatOpen}
                unread={unread}
                onToggleChat={() => {
                    setChatOpen(open => !open);
                    setUnread(0);
                }}
            />
            {chatOpen && (
                <ChatPanel
                    messages={chat}
                    currentUserId={currentUserId}
                    onSend={(text) => game?.sendChat(text) ?? false}
                    onClose={() => setChatOpen(false)}
                />
            )}

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
                                    onClick={() => { setRoomModalMode("create"); setRoomName(""); setRoomPrivate(false); }}
                                    style={{
                                        width: "100%",
                                        padding: "12px",
                                        marginBottom: "12px",
                                        backgroundColor: "#3b82f6",
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
                                    placeholder="Room name (letters, numbers, - and _)"
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
                                <label style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px", fontSize: "14px", color: "rgba(255, 255, 255, 0.8)", cursor: "pointer" }}>
                                    <input type="checkbox" checked={roomPrivate} onChange={(e) => setRoomPrivate(e.target.checked)} />
                                    Private (invite people from the Rooms page)
                                </label>
                                <button
                                    onClick={handleCreateRoom}
                                    disabled={creatingRoom}
                                    style={{
                                        width: "100%",
                                        padding: "12px",
                                        backgroundColor: "#3b82f6",
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
                                        backgroundColor: "#3b82f6",
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
                                            backgroundColor: "#3b82f6",
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
    onOpenRoomModal,
    onExport,
    chatOpen,
    unread,
    onToggleChat
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
    onOpenRoomModal: () => void,
    onExport: () => void,
    chatOpen: boolean,
    unread: number,
    onToggleChat: () => void
}) {
    const [isMobile, setIsMobile] = useState(false);
    const [isTablet, setIsTablet] = useState(false);

    useEffect(() => {
        const checkScreen = () => {
            const width = window.innerWidth;
            setIsMobile(width < 480);
            setIsTablet(width >= 480 && width < 1024);
        };
        checkScreen();
        window.addEventListener("resize", checkScreen);
        return () => window.removeEventListener("resize", checkScreen);
    }, []);

    const iconSize = isMobile ? 14 : isTablet ? 16 : 18;
    const buttonSize = isMobile ? 24 : isTablet ? 28 : 36;
    const dotSize = isMobile ? 10 : isTablet ? 14 : 22;
    const strokeWidthSlider = isMobile ? 40 : isTablet ? 50 : 80;
    const iconGap = isMobile ? 1 : isTablet ? 2 : 8;
    const separatorHeight = isMobile ? 14 : isTablet ? 16 : 24;
    const paddingX = isMobile ? "4px 6px" : isTablet ? "6px 10px" : "8px 16px";

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
            gap: isMobile ? 2 : isTablet ? 4 : 8,
            padding: paddingX,
            marginTop: 12,
            maxWidth: isMobile ? "calc(100vw - 20px)" : "fit-content",
            overflowX: "auto",
            overflowY: "hidden",
            scrollbarWidth: "thin",
            scrollbarColor: "rgba(255,255,255,0.3) transparent",
            WebkitOverflowScrolling: "touch"
        }}>
            <IconButton 
                onClick={() => setSelectedTool("select")}
                activated={selectedTool === "select"}
                title="Select and move (Delete removes)"
                icon={<MousePointer2 size={iconSize} />}
                size={buttonSize}
            />
            <IconButton 
                onClick={() => setSelectedTool("pencil")}
                activated={selectedTool === "pencil"}
                title="Pencil"
                icon={<Pencil size={iconSize} />}
                size={buttonSize}
            />
            <IconButton 
                onClick={() => setSelectedTool("rect")}
                activated={selectedTool === "rect"}
                title="Rectangle"
                icon={<RectangleHorizontalIcon size={iconSize} />}
                size={buttonSize}
            />
            <IconButton 
                onClick={() => setSelectedTool("circle")}
                activated={selectedTool === "circle"}
                title="Circle"
                icon={<Circle size={iconSize} />}
                size={buttonSize}
            />
            <IconButton 
                onClick={() => setSelectedTool("line")}
                activated={selectedTool === "line"}
                title="Line"
                icon={<Minus size={iconSize} />}
                size={buttonSize}
            />
            <IconButton 
                onClick={() => setSelectedTool("arrow")}
                activated={selectedTool === "arrow"}
                title="Arrow"
                icon={<ArrowUpRight size={iconSize} />}
                size={buttonSize}
            />
            <IconButton 
                onClick={() => setSelectedTool("eraser")}
                activated={selectedTool === "eraser"}
                title="Eraser"
                icon={<Eraser size={iconSize} />}
                size={buttonSize}
            />
            <IconButton 
                onClick={() => setSelectedTool("text")}
                activated={selectedTool === "text"}
                title="Text"
                icon={<Type size={iconSize} />}
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
                        accentColor: "#3b82f6"
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
                title="Undo (Ctrl+Z)"
                icon={<Undo2 size={iconSize} />}
                size={buttonSize}
            />
            <IconButton 
                onClick={onRedo}
                disabled={!canRedo}
                title="Redo (Ctrl+Y)"
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
                                color: COLORS[i % COLORS.length] === "#ffffff" ? "#111" : "#fff",
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
                            +{users.length - 5}
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
                title="Zoom out"
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
                title="Zoom in"
                icon={<ZoomIn size={iconSize} />}
                size={buttonSize}
            />

            <div style={{ 
                width: "1px", 
                height: separatorHeight, 
                backgroundColor: "rgba(255, 255, 255, 0.15)", 
                margin: isMobile ? "0 4px" : "0 8px",
                flexShrink: 0
            }} />

            <IconButton 
                onClick={onExport}
                title="Export as PNG"
                icon={<Download size={iconSize} />}
                size={buttonSize}
            />
            <div style={{ position: "relative", flexShrink: 0 }}>
                <IconButton 
                    onClick={onToggleChat}
                    activated={chatOpen}
                    title={unread > 0 ? `Chat (${unread} unread)` : "Chat"}
                    icon={<MessageSquare size={iconSize} />}
                    size={buttonSize}
                />
                {unread > 0 && (
                    <span style={{
                        position: "absolute",
                        top: -4,
                        right: -4,
                        minWidth: 16,
                        height: 16,
                        padding: "0 4px",
                        borderRadius: 8,
                        background: "#ef4444",
                        color: "#fff",
                        fontSize: 10,
                        fontWeight: 600,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        pointerEvents: "none"
                    }}>
                        {unread > 99 ? "99+" : unread}
                    </span>
                )}
            </div>
        </div>
    );
}