import { PrismaClient } from '@prisma/client';

export const prismaClient = new PrismaClient();

// Export types from Prisma client
export type {
  User,
  Room,
  Chat,
  Prisma,
} from '@prisma/client';