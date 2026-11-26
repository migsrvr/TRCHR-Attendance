import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma: PrismaClient =
  globalForPrisma.prisma ?? new PrismaClient();

// Reuse the PrismaClient singleton across both dev HMR and warm serverless Lambda invocations.
globalForPrisma.prisma = prisma;
