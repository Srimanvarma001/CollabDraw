"use client";

import { WS_URL } from "@/config";
import { useEffect, useState } from "react";
import { Canvas } from "./Canvas";

export function RoomCanvas({roomId}: {roomId: string}) {
    const [socket, setSocket] = useState<WebSocket | null>(null);
    const [connected, setConnected] = useState(false);

    useEffect(() => {
        const token = localStorage.getItem("token") || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI3Njg0NDMwYy04YzNiLTRlZmQtOGFmNS00YzQwMzdmNjJkYzMiLCJpYXQiOjE3MzcyOTg2NjV9.xacFop0s231DoUVeLZormeIbBmIRaXftTVVI6weIqFo";
        const userName = localStorage.getItem("userName") || `User-${Math.random().toString(36).slice(2, 8)}`;

        const ws = new WebSocket(`${WS_URL}?token=${token}`);

        ws.onopen = () => {
            setSocket(ws);
            setConnected(true);
            const data = JSON.stringify({
                type: "join_room",
                roomId,
                userName
            });
            ws.send(data);
        };

        ws.onclose = () => {
            setConnected(false);
        };
        
    }, [roomId]);
    
    if (!socket || !connected) {
        return <div className="flex items-center justify-center h-screen">
            <div className="text-white text-xl">Connecting to server...</div>
        </div>;
    }

    return <div className="h-screen w-screen overflow-hidden">
        <Canvas roomId={roomId} socket={socket} />
    </div>;
}