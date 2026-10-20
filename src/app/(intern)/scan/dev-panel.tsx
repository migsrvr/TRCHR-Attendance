"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { MOCK_SCENARIOS, type MockScenario } from "@/lib/scan/mock-api";
import { cn } from "@/lib/utils";

/**
 * Development-only controls for testing the scan flow on real phones while
 * the server is mocked. Never rendered in production builds.
 */
export function DevPanel({
  scenario,
  openSince,
  cameraOff,
  onSimulate,
}: {
  scenario: MockScenario;
  openSince: string | null;
  cameraOff: boolean;
  onSimulate: (token: string) => void;
}) {
  const href = (overrides: Record<string, string | null>) => {
    const params = new URLSearchParams();
    const values: Record<string, string | null> = {
      scenario,
      open: openSince,
      camera: cameraOff ? "off" : null,
      ...overrides,
    };
    for (const [key, value] of Object.entries(values)) {
      if (value && !(key === "scenario" && value === "ok")) params.set(key, value);
    }
    const query = params.toString();
    return query ? `/scan?${query}` : "/scan";
  };

  return (
    <details className="shrink-0 rounded-card border border-dashed border-border bg-card px-4 py-3 text-xs leading-[18px]">
      <summary className="cursor-pointer select-none font-semibold text-muted-foreground">
        Developer tools · mock server ({scenario})
      </summary>
      <div className="mt-3 flex flex-col gap-3">
        <div>
          <p className="mb-1.5 font-semibold">Simulate a scan</p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => onSimulate("TR-IN")}>
              IN code
            </Button>
            <Button size="sm" variant="outline" onClick={() => onSimulate("TR-OUT")}>
              OUT code
            </Button>
          </div>
        </div>
        <div>
          <p className="mb-1.5 font-semibold">Server outcome</p>
          <div className="flex flex-wrap gap-1.5">
            {MOCK_SCENARIOS.map((option) => (
              // Plain <a>: a full reload resets the mock server's state.
              <a
                key={option}
                href={href({ scenario: option })}
                aria-current={option === scenario ? "true" : undefined}
                className={cn(
                  "rounded-chip px-2 py-1 font-mono",
                  option === scenario ? "bg-pend-bg font-semibold text-pend" : "border border-border text-muted-foreground",
                )}
              >
                {option}
              </a>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          <a className="font-semibold text-primary" href={href({ open: openSince ? null : "08:57" })}>
            {openSince ? "Start with no session" : "Start already timed in"}
          </a>
          <a className="font-semibold text-primary" href={href({ camera: cameraOff ? null : "off" })}>
            {cameraOff ? "Use the camera" : "Turn the camera off"}
          </a>
          <Link className="font-semibold text-primary" href="/scan/test-codes">
            Test QR codes
          </Link>
        </div>
      </div>
    </details>
  );
}
