import { Prisma } from '@prisma/client';

export { prismaClient } from './client.js';
export { canAccessRoom, visibleRoomsWhere } from './access.js';
export { Prisma };

// Export types from Prisma client
export type {
  User,
  Room,
  Chat,
  RoomMember,
} from '@prisma/client';
