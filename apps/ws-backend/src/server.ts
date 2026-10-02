import { WebSocket, WebSocketServer, ServerOptions } from "ws";
import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";
import { JWT_ALGORITHM, JWT_SECRET } from "@repo/backend-common";
import { prismaClient } from "@repo/db";

/** Close code sent when the token is missing, invalid or expired. */
export const CLOSE_UNAUTHORIZED = 4001;

const MAX_MESSAGE_BYTES = 1024 * 1024;
const HEARTBEAT_MS = 30_000;
const DRAW_OPS = new Set(["add", "update", "delete"]);

/** One open socket. A user with two tabs open has two connections. */
interface Connection {
    id: string;
    ws: WebSocket;
    userId: string;
    userName?: string;
    rooms: Set<string>;
    alive: boolean;
    // Messages are handled one at a time so a slow join can't race the ops after it.
    queue: Promise<void>;
}

interface WSMessage {
    type: 'join_room' | 'leave_room' | 'chat' | 'cursor';
    roomId?: unknown;
    message?: unknown;
    cursor?: { x?: unknown; y?: unknown };
    userName?: unknown;
}

function checkUser(token: string): string | null {
    try {
        const decoded = jwt.verify(token, JWT_SECRET, { algorithms: [JWT_ALGORITHM] });
        if (typeof decoded === "string" || typeof decoded.userId !== "string") {
            return null;
        }
        return decoded.userId;
    } catch {
        return null;
    }
}

/** Accepts only well-formed drawing ops, so junk never reaches the database. */
export function isValidDrawMessage(message: unknown): message is string {
    if (typeof message !== "string" || message.length > MAX_MESSAGE_BYTES) return false;
    try {
        const data = JSON.parse(message);
        return typeof data === "object" && data !== null && DRAW_OPS.has(data.op);
    } catch {
        return false;
    }
}

export function createWsServer(options: ServerOptions) {
    const wss = new WebSocketServer({ maxPayload: MAX_MESSAGE_BYTES, ...options });
    const connections = new Set<Connection>();

    function send(conn: Connection, message: object) {
        if (conn.ws.readyState === WebSocket.OPEN) {
            conn.ws.send(JSON.stringify(message));
        }
    }

    function broadcast(roomId: string, message: object, except?: Connection) {
        for (const conn of connections) {
            if (conn !== except && conn.rooms.has(roomId)) {
                send(conn, message);
            }
        }
    }

    /** Everyone in the room, listed once per user however many tabs they have open. */
    function presence(roomId: string) {
        const users = new Map<string, { userId: string; userName: string }>();
        for (const conn of connections) {
            if (conn.rooms.has(roomId) && !users.has(conn.userId)) {
                users.set(conn.userId, {
                    userId: conn.userId,
                    userName: conn.userName ?? `User-${conn.userId.slice(0, 6)}`
                });
            }
        }
        return Array.from(users.values());
    }

    function broadcastPresence(roomId: string) {
        broadcast(roomId, { type: "presence", roomId, users: presence(roomId) });
    }

    async function handleMessage(conn: Connection, parsedData: WSMessage) {
        const roomId = typeof parsedData.roomId === "string" ? parsedData.roomId : null;
        if (!roomId) return;

        switch (parsedData.type) {
            case 'join_room': {
                const room = await prismaClient.room.findUnique({ where: { slug: roomId } });
                if (!room) {
                    send(conn, { type: "error", code: "room_not_found", roomId, message: "Room not found" });
                    return;
                }
                if (!conn.userName) {
                    const user = await prismaClient.user.findUnique({
                        where: { id: conn.userId },
                        select: { name: true }
                    });
                    conn.userName = user?.name
                        || (typeof parsedData.userName === "string" ? parsedData.userName.slice(0, 50) : undefined);
                }
                conn.rooms.add(roomId);
                send(conn, { type: "joined", roomId });
                broadcastPresence(roomId);
                break;
            }
            case 'leave_room': {
                if (conn.rooms.delete(roomId)) {
                    broadcastPresence(roomId);
                }
                break;
            }
            case 'cursor': {
                const { cursor } = parsedData;
                if (!conn.rooms.has(roomId) || typeof cursor?.x !== "number" || typeof cursor?.y !== "number") {
                    return;
                }
                broadcast(roomId, {
                    type: "cursor",
                    roomId,
                    userId: conn.userId,
                    userName: conn.userName,
                    cursor: { x: cursor.x, y: cursor.y }
                }, conn);
                break;
            }
            case 'chat': {
                const { message } = parsedData;
                // Only members of the room may write to it.
                if (!conn.rooms.has(roomId)) {
                    send(conn, { type: "error", code: "not_in_room", roomId, message: "Join the room first" });
                    return;
                }
                if (!isValidDrawMessage(message)) return;

                await prismaClient.chat.create({
                    data: {
                        roomId,
                        message,
                        userId: conn.userId
                    }
                });

                // The sender already applied this op locally.
                broadcast(roomId, { type: "chat", message, roomId }, conn);
                break;
            }
        }
    }

    wss.on('connection', function connection(ws, request) {
        const url = request.url ?? "";
        const queryParams = new URLSearchParams(url.split('?')[1] ?? "");
        const userId = checkUser(queryParams.get("token") ?? "");

        if (!userId) {
            ws.close(CLOSE_UNAUTHORIZED, "Unauthorized");
            return;
        }

        const conn: Connection = {
            id: randomUUID(),
            ws,
            userId,
            rooms: new Set(),
            alive: true,
            queue: Promise.resolve()
        };
        connections.add(conn);

        ws.on('pong', () => {
            conn.alive = true;
        });

        ws.on('message', (data) => {
            let parsedData: WSMessage;
            try {
                parsedData = JSON.parse(data.toString());
            } catch {
                return;
            }
            conn.queue = conn.queue
                .then(() => handleMessage(conn, parsedData))
                .catch((e) => console.error('Failed to handle message:', e));
        });

        ws.on('error', (e) => console.error('WebSocket error:', e));

        ws.on('close', () => {
            connections.delete(conn);
            for (const roomId of conn.rooms) {
                broadcastPresence(roomId);
            }
        });
    });

    // Drop connections that stopped answering pings (e.g. a laptop went to sleep),
    // so they don't linger in presence lists.
    const heartbeat = setInterval(() => {
        for (const conn of connections) {
            if (!conn.alive) {
                conn.ws.terminate();
                continue;
            }
            conn.alive = false;
            conn.ws.ping();
        }
    }, HEARTBEAT_MS);
    wss.on('close', () => clearInterval(heartbeat));

    return wss;
}
