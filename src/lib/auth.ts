/**
 * Better Auth server instance (Technical Design v1.0 section 2).
 *
 * - Maps Better Auth users to logical User Accounts with UUID identifiers.
 * - Public signup is disabled; HR provisions accounts through src/modules/accounts.
 * - Session cookie caching is disabled so role/status revocations take effect immediately.
 * - Database hooks reject sign-in for DISABLED or PENDING accounts and stamp lastSignInAtUtc.
 */

import { randomUUID } from "node:crypto";

import { APIError, betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";

import { prisma } from "@/lib/db";

const isProd = process.env.NODE_ENV === "production";

const vercelOrigin = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined;
const vercelProdOrigin = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : undefined;

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL:
    process.env.BETTER_AUTH_URL ??
    process.env.APP_ORIGIN ??
    vercelProdOrigin ??
    vercelOrigin ??
    "http://localhost:3000",
  trustedOrigins: [
    process.env.APP_ORIGIN,
    process.env.BETTER_AUTH_URL,
    vercelProdOrigin,
    vercelOrigin,
  ].filter((origin): origin is string => Boolean(origin)),
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    minPasswordLength: 10,
    maxPasswordLength: 128,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 14, // 14 days when remembered
    updateAge: 60 * 60 * 24,
    cookieCache: {
      enabled: false,
    },
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: "INTERN",
        input: false,
      },
      status: {
        type: "string",
        required: false,
        defaultValue: "PENDING",
        input: false,
      },
    },
  },
  advanced: {
    useSecureCookies: isProd,
    database: {
      generateId: () => randomUUID(),
    },
  },
  databaseHooks: {
    session: {
      create: {
        before: async (session) => {
          const user = await prisma.user.findUnique({
            where: { id: session.userId },
            select: { status: true },
          });
          if (!user || user.status === "DISABLED") {
            throw new APIError("FORBIDDEN", {
              code: "ACCOUNT_DISABLED",
              message: "This account is disabled.",
            });
          }
          if (user.status === "PENDING") {
            throw new APIError("FORBIDDEN", {
              code: "ACCOUNT_PENDING",
              message: "Finish setting your password using the setup link HR emailed you.",
            });
          }
          return { data: session };
        },
        after: async (session) => {
          await prisma.user
            .update({
              where: { id: session.userId },
              data: { lastSignInAtUtc: new Date() },
            })
            .catch(() => undefined);
        },
      },
    },
  },
  plugins: [nextCookies()],
});

export type Auth = typeof auth;
