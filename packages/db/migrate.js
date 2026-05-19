import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    await prisma.$queryRaw`ALTER TABLE "Chat" DROP CONSTRAINT IF EXISTS "Chat_roomId_fkey"`.catch(() => {});
    await prisma.$queryRaw`ALTER TABLE "Chat" ALTER COLUMN "roomId" TYPE TEXT`.catch(() => {});
    await prisma.$queryRaw`
      ALTER TABLE "Chat" ADD CONSTRAINT "Chat_roomId_fkey" 
      FOREIGN KEY ("roomId") REFERENCES "Room"("slug") ON DELETE CASCADE
    `.catch(() => {});
    console.log('Migration complete');
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

main();