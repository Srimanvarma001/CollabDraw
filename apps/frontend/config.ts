// NEXT_PUBLIC_* values are inlined at build time, so set them before `next build`.
export const HTTP_BACKEND = process.env.NEXT_PUBLIC_HTTP_BACKEND || "http://localhost:3001";
export const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8080";
