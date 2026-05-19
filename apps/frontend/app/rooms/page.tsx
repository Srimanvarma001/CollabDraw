"use client";

import { useEffect, useState } from "react";
import { HTTP_BACKEND } from "@/config";
import { useRouter } from "next/navigation";
import Link from "next/link";

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
        } catch (e) {
            console.error("Failed to fetch rooms:", e);
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
        } catch (e) {
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
        } catch (e) {
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
        <div className="min-h-screen bg-gray-900 text-white p-8">
            <div className="max-w-4xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-3xl font-bold">Rooms</h1>
                    <Link href="/" className="text-blue-400 hover:underline">
                        ← Back to Home
                    </Link>
                </div>

                <div className="bg-gray-800 rounded-lg p-6 mb-8">
                    <h2 className="text-xl font-semibold mb-4">Create New Room</h2>
                    <div className="flex gap-4">
                        <input
                            type="text"
                            placeholder="Room name"
                            value={newRoomName}
                            onChange={(e) => setNewRoomName(e.target.value)}
                            className="flex-1 p-3 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 outline-none"
                            onKeyDown={(e) => e.key === "Enter" && createRoom()}
                        />
                        <button
                            onClick={createRoom}
                            disabled={creating || !newRoomName.trim()}
                            className="px-6 py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-600 rounded font-medium"
                        >
                            {creating ? "Creating..." : "Create"}
                        </button>
                    </div>
                </div>

                {loading ? (
                    <div className="text-center py-8">Loading...</div>
                ) : rooms.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                        No rooms yet. Create one above!
                    </div>
                ) : (
                    <div className="grid gap-4">
                        {rooms.map((room) => (
                            <div
                                key={room.id}
                                className="bg-gray-800 rounded-lg p-6 flex justify-between items-center"
                            >
                                <div>
                                    <Link
                                        href={`/canvas/${room.slug}`}
                                        className="text-xl font-semibold text-blue-400 hover:underline"
                                    >
                                        {room.slug}
                                    </Link>
                                    <p className="text-gray-400 text-sm mt-1">
                                        Created by {room.admin?.name || room.admin?.email} •{" "}
                                        {new Date(room.createdAt).toLocaleDateString()}
                                    </p>
                                </div>
                                {currentUserId === room.adminId && (
                                    <button
                                        onClick={() => deleteRoom(room.id)}
                                        className="px-4 py-2 bg-red-500 hover:bg-red-600 rounded text-sm"
                                    >
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