import { config } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

// Load .env from the app's working directory first, then from the repo root.
// Variables that are already set (e.g. by Docker) always win.
config({
    path: [path.resolve(process.cwd(), ".env"), path.resolve(here, "../../../.env")],
    quiet: true,
});

function requireEnv(name: string): string {
    const value = process.env[name];
    if (!value) {
        throw new Error(`${name} is not set. Copy .env.example to .env and fill it in.`);
    }
    return value;
}

/** Secret used to sign and verify auth tokens. Must be long and random in production. */
export const JWT_SECRET: string = requireEnv("JWT_SECRET");

if (JWT_SECRET.length < 32) {
    console.warn("JWT_SECRET is shorter than 32 characters; use a long random value in production.");
}

/** How long a sign-in token stays valid, in jsonwebtoken format (e.g. "7d", "12h"). */
export const JWT_EXPIRES_IN: string = process.env.JWT_EXPIRES_IN || "7d";

export const JWT_ALGORITHM = "HS256" as const;
