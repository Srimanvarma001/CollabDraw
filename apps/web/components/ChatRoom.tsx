import axios from "axios";
import { BACKEND_URL } from "../app/config";
import { ChatRoomClient } from "./ChatRoomClient";

async function getCharts(roomId:string) {
    const response = await axios.get(`${BACKEND_URL}/chats/${roomId}`);
    return response.data.message;
    
}

export async function ChatRoom({id}:{
    id:string
}){
    const message = await getCharts(id);
    //@ts-ignore
    return <ChatRoomClient id={id} message={message} />
    
}