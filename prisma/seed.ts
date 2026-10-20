/**
 * Database seed.
 *
 * SKELETON: creates the bootstrap HR account and reference rows (department,
 * office, policy version, checkpoints). No production defaults: office
 * coordinates, timezone and policy values must be supplied before a live pilot.
 * Run with: npm run prisma:generate && npx tsx prisma/seed.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  throw new Error("seed is not implemented yet");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
