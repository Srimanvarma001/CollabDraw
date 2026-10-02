import { PrismaClient, Prisma } from '@prisma/client';

export const prismaClient = new PrismaClient();

export { Prisma };

// Export types from Prisma client
export type {
  User,
  Room,
  Chat,
} from '@prisma/client';