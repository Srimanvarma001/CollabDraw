import { WebSocket, WebSocketServer } from "ws";
import jwt, { JwtPayload } from "jsonwebtoken";
import { JWT_SECRET } from "@repo/backend-common";
import { prismaClient } from "@repo/db";

const wss = new WebSocketServer({ port: 8080 });

interface User {
    ws: WebSocket;
    rooms: string[];
    userId: string;
}

interface WSMessage {
    type: 'join_room' | 'leave_room' | 'chat';
    roomId: string;
    message?: string;
}

const users: User[] = [];

function checkUser(token: string): string | null {
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (typeof decoded === "string") {
            return null;
        }
        if (!decoded || !('userId' in decoded)) {
            return null;
        }
        return decoded.userId as string;
    } catch (e) {
        return null;
    }
}

wss.on('connection', function connection(ws: WebSocket, request) {
    const url = request.url;
    if (!url) {
        ws.close();
        return;
    }

    const queryParams = new URLSearchParams(url.split('?')[1]);
    const token = queryParams.get("token") || "";
    const userId = checkUser(token);

    if (!userId) {
        ws.close();
        return;
    }

    users.push({
        userId,
        rooms: [],
        ws
    });

    ws.on('message',async function message(data) {
        try {
            const parsedData = JSON.parse(data.toString()) as WSMessage;

            switch (parsedData.type) {
                case 'join_room': {
                    const user = users.find(x => x.ws === ws);
                    if (user && parsedData.roomId) {
                        user.rooms.push(parsedData.roomId);
                    }
                    break;
                }
                case 'leave_room': {
                    const user = users.find(x => x.ws === ws);
                    if (user && parsedData.roomId) {
                        user.rooms = user.rooms.filter(x => x !== parsedData.roomId);
                    }
                    break;
                }
                case 'chat': {
                    const { roomId, message } = parsedData;
                    if (!roomId || !message) return;

                    await prismaClient.chat.create({
                        data:{
                            //@ts-ignore
                            roomId,
                            message,
                            userId
                        }
                    })

                    users.forEach(user => {
                        if (user.rooms.includes(roomId)) {
                            user.ws.send(JSON.stringify({
                                type: "chat",
                                message,
                                roomId
                            }));
                        }
                    });
                    break;
                }
            }
        } catch (e) {
            console.error('Failed to parse message:', e);
        }
    });

    ws.on('close', () => {
        const index = users.findIndex(x => x.ws === ws);
        if (index > -1) {
            users.splice(index, 1);
        }
    });
});