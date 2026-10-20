/**
 * Queries for the sign-in and set-password screens. Sample data until the
 * accounts module issues real setup links.
 */

import { EXPIRED_TOKENS, SETUP_LINKS } from "@/lib/ui/fixtures/auth";
import type { SetupLinkVM } from "@/lib/ui/view-models";

/**
 * Who a setup link belongs to, or null if it's missing, expired or used.
 * In development any other token opens Rina's (intern) link.
 */
export async function getSetupLink(token: string | undefined): Promise<SetupLinkVM | null> {
  // TODO(module): look up the Better Auth verification token and the account
  // it was issued for (src/modules/accounts); return null when invalid.
  if (!token || EXPIRED_TOKENS.has(token)) return null;
  return SETUP_LINKS[token] ?? SETUP_LINKS["demo-intern"]!;
}
