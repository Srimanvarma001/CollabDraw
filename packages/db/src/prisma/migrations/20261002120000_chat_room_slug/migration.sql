-- Chat rows reference rooms by slug (the WebSocket server and /chats/:roomId
-- both use the slug). Databases that were patched with migrate.js already
-- have this shape; the statements below are safe to run on them too.

-- DropForeignKey
ALTER TABLE "Chat" DROP CONSTRAINT IF EXISTS "Chat_roomId_fkey";

-- AlterTable
ALTER TABLE "Chat" ALTER COLUMN "roomId" SET DATA TYPE TEXT;

-- AddForeignKey
ALTER TABLE "Chat" ADD CONSTRAINT "Chat_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("slug") ON DELETE RESTRICT ON UPDATE CASCADE;
