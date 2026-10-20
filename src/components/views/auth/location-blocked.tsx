"use client";

import { RefreshCw } from "lucide-react";
import { useState } from "react";

import { Button, ButtonLink } from "@/components/ui/button";
import { FirstRunStep } from "@/components/views/auth/first-run-step";
import { BlockedNotice } from "@/components/views/shared/blocked-notice";
import { PermissionHelp } from "@/components/views/shared/permission-help";
import { requestLocationPermission } from "@/lib/device/permissions";
import { useDevice } from "@/lib/device/use-device";
import { blockedCopy } from "@/lib/ui/scan-copy";

const DONE = "/dashboard";

const STILL_OFF = {
  denied: "Location is still off for this page. Check each step above, then try again.",
  unsupported: "This browser can't share your location. Open the page in Safari (iPhone) or Chrome (Android).",
} as const;

/** Location was refused during first run. Steps to turn it back on. */
export function LocationBlocked() {
  const device = useDevice();
  const [checking, setChecking] = useState(false);
  const [stillOff, setStillOff] = useState<keyof typeof STILL_OFF | null>(null);
  const copy = blockedCopy("location-denied", device);

  async function check() {
    if (checking) return;
    setChecking(true);
    setStillOff(null);
    const result = await requestLocationPermission();
    if (result === "granted") {
      window.location.assign(DONE);
      return;
    }
    setChecking(false);
    setStillOff(result);
  }

  return (
    <FirstRunStep
      actions={
        <>
          {stillOff ? (
            <p role="alert" className="text-center text-[13px] font-medium leading-[19px] text-attn">
              {STILL_OFF[stillOff]}
            </p>
          ) : null}
          <Button size="lg" className="w-full" onClick={check} aria-busy={checking}>
            <RefreshCw aria-hidden="true" />
            {checking ? "Checking…" : "I turned it on, check again"}
          </Button>
          <ButtonLink href={DONE} size="lg" variant="ghost" className="h-11 w-full text-sm font-medium text-muted-foreground">
            Skip for now
          </ButtonLink>
        </>
      }
    >
      <BlockedNotice copy={{ ...copy, body: `${copy.body} Turn it on in your browser, then check again.` }} />
      <PermissionHelp copy={copy} />
    </FirstRunStep>
  );
}
