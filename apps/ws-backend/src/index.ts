import { createWsServer } from "./server.js";

const PORT = Number(process.env.PORT ?? 8080);

createWsServer({ port: PORT });
console.log(`WebSocket backend listening on port ${PORT}`);
