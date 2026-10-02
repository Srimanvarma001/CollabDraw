import { HTTP_BACKEND } from "@/config";
import axios from "axios";
import { replayRoom, RoomState } from "./shapes";

export async function getRoomState(roomId: string): Promise<RoomState> {
    const res = await axios.get(`${HTTP_BACKEND}/chats/${encodeURIComponent(roomId)}`);
    return replayRoom(res.data.messages ?? []);
}
