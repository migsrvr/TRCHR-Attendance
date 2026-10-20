/**
 * Better Auth server instance.
 *
 * SKELETON: wiring only. Map Better Auth's user model to the logical User
 * Account (UUID ids) and expose the application role/status fields as
 * server-controlled (never accepted from an intern request). Public signup is
 * disabled; provisioning is HR-driven. Confirm option names against the pinned
 * better-auth version during implementation (Technical Design v1.0 section 2).
 */

import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";

import { prisma } from "@/lib/db";

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
  },
  user: {
    additionalFields: {
      role: { type: "string", required: false, defaultValue: "INTERN" },
      status: { type: "string", required: false, defaultValue: "PENDING" },
    },
  },
});

export type Auth = typeof auth;
