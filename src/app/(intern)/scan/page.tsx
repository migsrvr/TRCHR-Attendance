import type { Metadata } from "next";

import { isMockModeEnabled } from "@/lib/auth/session";
import { parseMockScenario } from "@/lib/scan/mock-api";
import { getScanContext } from "@/lib/ui/queries/intern";

import { ScanClient, type MockSettings } from "./scan-client";

export const metadata: Metadata = {
  title: "Scan · Top Realty Attendance",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function InternScanPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const single = (key: string) => (typeof params[key] === "string" ? (params[key] as string) : undefined);

  const mockMode = isMockModeEnabled();
  const open = mockMode ? single("open") : undefined;
  const context = await getScanContext({ openSince: open && /^\d{2}:\d{2}$/.test(open) ? open : null });
  const mock: MockSettings | null = mockMode
    ? { scenario: parseMockScenario(single("scenario")), cameraOff: single("camera") === "off" }
    : null;

  return <ScanClient context={context} mock={mock} />;
}
