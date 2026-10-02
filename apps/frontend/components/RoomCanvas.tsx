"use client";

import { WS_URL } from "@/config";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Canvas } from "./Canvas";
import { UserPresence } from "@/draw/Game";

/** Must match CLOSE_UNAUTHORIZED in apps/ws-backend. */
const CLOSE_UNAUTHORIZED = 4001;
const MAX_RECONNECT_DELAY_MS = 15_000;

type Status = "connecting" | "connected" | "reconnecting" | "room_not_found";

export function RoomCanvas({roomId}: {roomId: string}) {
    const [socket, setSocket] = useState<WebSocket | null>(null);
    const [status, setStatus] = useState<Status>("connecting");
    // Tracked here rather than in Game: the first presence update arrives
    // right after "joined", before the canvas has mounted.
    const [users, setUsers] = useState<UserPresence[]>([]);
    const router = useRouter();

    useEffect(() => {
        const signinUrl = `/signin?returnUrl=/canvas/${encodeURIComponent(roomId)}`;
        const token = localStorage.getItem("token");
        if (!token) {
            router.push(signinUrl);
            return;
        }

        const userName = localStorage.getItem("userName") || undefined;
        let disposed = false;
        let attempt = 0;
        let retryTimer: ReturnType<typeof setTimeout> | undefined;
        let ws: WebSocket | null = null;

        function connect() {
            const current = new WebSocket(`${WS_URL}?token=${encodeURIComponent(token!)}`);
            ws = current;
            let roomMissing = false;

            current.onopen = () => {
                current.send(JSON.stringify({ type: "join_room", roomId, userName }));
            };

            current.addEventListener("message", (event) => {
                let message;
                try {
                    message = JSON.parse(event.data);
                } catch {
                    return;
                }
                if (message.type === "joined" && message.roomId === roomId) {
                    attempt = 0;
                    setSocket(current);
                    setStatus("connected");
                } else if (message.type === "presence" && message.roomId === roomId) {
                    setUsers(message.users ?? []);
                } else if (message.type === "error" && message.code === "room_not_found") {
                    roomMissing = true;
                    setStatus("room_not_found");
                    current.close();
                }
            });

            current.onclose = (event) => {
                if (disposed || roomMissing) return;
                if (event.code === CLOSE_UNAUTHORIZED) {
                    // Token is invalid or expired: sign in again.
                    localStorage.removeItem("token");
                    router.push(signinUrl);
                    return;
                }
                setStatus("reconnecting");
                const delay = Math.min(1000 * 2 ** attempt, MAX_RECONNECT_DELAY_MS);
                attempt++;
                retryTimer = setTimeout(connect, delay);
            };
        }

        connect();

        return () => {
            disposed = true;
            clearTimeout(retryTimer);
            ws?.close();
        };
    }, [roomId, router]);

    if (status === "room_not_found") {
        return <div className="flex flex-col items-center justify-center h-screen gap-4">
            <div className="text-white text-xl">Room &quot;{roomId}&quot; does not exist.</div>
            <Link href="/rooms" style={{ color: "#3b82f6" }}>Back to rooms</Link>
        </div>;
    }

    if (!socket) {
        return <div className="flex items-center justify-center h-screen">
            <div className="text-white text-xl">
                {status === "reconnecting" ? "Can't reach the server, retrying..." : "Connecting to server..."}
            </div>
        </div>;
    }

    return <div className="h-screen w-screen overflow-hidden">
        <Canvas roomId={roomId} socket={socket} users={users} />
        {status === "reconnecting" && (
            <div style={{
                position: "fixed",
                bottom: 16,
                left: "50%",
                transform: "translateX(-50%)",
                zIndex: 3000,
                padding: "8px 16px",
                borderRadius: 8,
                background: "rgba(234, 179, 8, 0.9)",
                color: "#000",
                fontSize: 14
            }}>
                Connection lost. Reconnecting... Your changes will sync when it is back.
            </div>
        )}
    </div>;
}
