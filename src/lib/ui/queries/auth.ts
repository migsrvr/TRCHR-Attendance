/**
 * Queries for the sign-in and set-password screens.
 * Uses the live accounts module by default; falls back to fixtures only when
 * USE_MOCK_APIS=1 or inside unit tests.
 */

import { EXPIRED_TOKENS, SETUP_LINKS } from "@/lib/ui/fixtures/auth";
import type { SetupLinkVM } from "@/lib/ui/view-models";
import { getSetupLinkByToken } from "@/modules/accounts";

function useFixtures(): boolean {
  return process.env.USE_MOCK_APIS === "1" || process.env.NODE_ENV === "test";
}

export async function getSetupLink(token: string | undefined): Promise<SetupLinkVM | null> {
  if (useFixtures()) {
    if (!token || EXPIRED_TOKENS.has(token)) return null;
    return SETUP_LINKS[token] ?? SETUP_LINKS["demo-intern"]!;
  }
  return getSetupLinkByToken(token);
}
