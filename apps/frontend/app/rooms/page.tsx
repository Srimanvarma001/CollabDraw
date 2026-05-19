"use client";

import { useEffect, useState } from "react";
import { HTTP_BACKEND } from "@/config";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Trash2, ArrowLeft, Layout } from "lucide-react";

interface Room {
    id: number;
    slug: string;
    createdAt: string;
    adminId: string;
    admin: { name: string; email: string };
}

export default function RoomsPage() {
    const [rooms, setRooms] = useState<Room[]>([]);
    const [newRoomName, setNewRoomName] = useState("");
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const router = useRouter();

    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

    useEffect(() => {
        fetchRooms();
    }, []);

    async function fetchRooms() {
        try {
            const res = await fetch(`${HTTP_BACKEND}/rooms`);
            const data = await res.json();
            setRooms(data.rooms || []);
        } catch {
            console.error("Failed to fetch rooms");
        }
        setLoading(false);
    }

    async function createRoom() {
        if (!newRoomName.trim()) return;
        if (!token) {
            alert("Please sign in first");
            router.push("/signin");
            return;
        }

        setCreating(true);
        try {
            const res = await fetch(`${HTTP_BACKEND}/room`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({ name: newRoomName.trim() })
            });

            if (res.ok) {
                setNewRoomName("");
                fetchRooms();
            } else {
                const data = await res.json();
                alert(data.message || "Failed to create room");
            }
        } catch {
            alert("Something went wrong");
        }
        setCreating(false);
    }

    async function deleteRoom(roomId: number) {
        if (!confirm("Are you sure you want to delete this room?")) return;
        if (!token) return;

        try {
            const res = await fetch(`${HTTP_BACKEND}/room/${roomId}`, {
                method: "DELETE",
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            });

            if (res.ok) {
                fetchRooms();
            } else {
                const data = await res.json();
                alert(data.message || "Failed to delete room");
            }
        } catch {
            alert("Something went wrong");
        }
    }

    function getCurrentUserId(): string | null {
        if (!token) return null;
        try {
            const payload = JSON.parse(atob(token.split(".")[1]));
            return payload.userId;
        } catch {
            return null;
        }
    }

    const currentUserId = getCurrentUserId();

    return (
        <div 
            className="min-h-screen animate-fade-in" 
            style={{ 
                background: "var(--bg-primary)",
                padding: "40px 20px"
            }}
        >
            <div style={{ 
                maxWidth: "800px", 
                margin: "0 auto" 
            }}>
                <div style={{ 
                    display: "flex", 
                    justifyContent: "space-between", 
                    alignItems: "center", 
                    marginBottom: "40px"
                }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                        <Link 
                            href="/" 
                            style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                width: "40px",
                                height: "40px",
                                borderRadius: "10px",
                                background: "rgba(255, 255, 255, 0.05)",
                                border: "1px solid var(--border-subtle)",
                                color: "var(--text-secondary)",
                                textDecoration: "none",
                                transition: "all 0.2s ease"
                            }}
                        >
                            <ArrowLeft size={18} />
                        </Link>
                        <div>
                            <h1 style={{
                                fontSize: "28px",
                                fontWeight: "600",
                                color: "var(--text-primary)",
                                margin: 0
                            }}>
                                Rooms
                            </h1>
                            <p style={{
                                color: "var(--text-muted)",
                                fontSize: "14px",
                                margin: "4px 0 0"
                            }}>
                                Manage your collaborative spaces
                            </p>
                        </div>
                    </div>
                </div>

                <div 
                    className="card-glass"
                    style={{ 
                        padding: "24px",
                        marginBottom: "32px"
                    }}
                >
                    <h2 style={{
                        fontSize: "16px",
                        fontWeight: "600",
                        color: "var(--text-primary)",
                        marginBottom: "16px"
                    }}>
                        Create New Room
                    </h2>
                    <div style={{ display: "flex", gap: "12px" }}>
                        <input
                            type="text"
                            placeholder="Enter room name"
                            value={newRoomName}
                            onChange={(e) => setNewRoomName(e.target.value)}
                            className="input-dark"
                            style={{ flex: 1 }}
                            onKeyDown={(e) => e.key === "Enter" && createRoom()}
                        />
                        <button
                            onClick={createRoom}
                            disabled={creating || !newRoomName.trim()}
                            className="btn-primary"
                            style={{ 
                                padding: "12px 20px",
                                minWidth: "120px"
                            }}
                        >
                            {creating ? "Creating..." : (
                                <>
                                    <Plus size={16} style={{ marginRight: "8px" }} />
                                    Create
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {loading ? (
                    <div style={{ 
                        textAlign: "center", 
                        padding: "60px 0",
                        color: "var(--text-muted)"
                    }}>
                        Loading...
                    </div>
                ) : rooms.length === 0 ? (
                    <div style={{ 
                        textAlign: "center", 
                        padding: "60px 0",
                        color: "var(--text-muted)"
                    }}>
                        <Layout size={48} style={{ opacity: 0.3, marginBottom: "16px" }} />
                        <p>No rooms yet. Create one above!</p>
                    </div>
                ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                        {rooms.map((room) => (
                            <div
                                key={room.id}
                                className="card-glass"
                                style={{
                                    padding: "20px 24px",
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    transition: "all 0.2s ease"
                                }}
                            >
                                <div>
                                    <Link
                                        href={`/canvas/${room.slug}`}
                                        style={{
                                            fontSize: "18px",
                                            fontWeight: "600",
                                            color: "#6366f1",
                                            textDecoration: "none",
                                            transition: "opacity 0.2s ease"
                                        }}
                                    >
                                        {room.slug}
                                    </Link>
                                    <p style={{
                                        color: "var(--text-muted)",
                                        fontSize: "13px",
                                        marginTop: "4px"
                                    }}>
                                        Created by {room.admin?.name || room.admin?.email} • {" "}
                                        {new Date(room.createdAt).toLocaleDateString()}
                                    </p>
                                </div>
                                {currentUserId === room.adminId && (
                                    <button
                                        onClick={() => deleteRoom(room.id)}
                                        style={{
                                            padding: "8px 16px",
                                            background: "rgba(239, 68, 68, 0.1)",
                                            border: "1px solid rgba(239, 68, 68, 0.2)",
                                            borderRadius: "8px",
                                            color: "#ef4444",
                                            fontSize: "13px",
                                            fontWeight: "500",
                                            cursor: "pointer",
                                            display: "flex",
                                            alignItems: "center",
                                            gap: "6px",
                                            transition: "all 0.2s ease"
                                        }}
                                    >
                                        <Trash2 size={14} />
                                        Delete
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}