"use client";

import { Camera, RefreshCw } from "lucide-react";
import { useState } from "react";

import { Button, ButtonLink } from "@/components/ui/button";
import { FirstRunHeading, FirstRunHero, FirstRunStep, PromiseList } from "@/components/views/auth/first-run-step";
import { BlockedNotice } from "@/components/views/shared/blocked-notice";
import { PermissionHelp } from "@/components/views/shared/permission-help";
import { requestCameraPermission } from "@/lib/device/permissions";
import { useDevice } from "@/lib/device/use-device";
import { blockedCopy } from "@/lib/ui/scan-copy";
import type { BlockReason } from "@/lib/ui/scan-state";

const NEXT = "/welcome/location";

const PROMISES = [
  "Only turns on when you open Scan",
  "Turns off as soon as a code is read",
  "Never saves photos or video",
];

/** First run, step 2: say what the camera is for, then let the phone ask. */
export function WelcomeCamera() {
  const device = useDevice();
  const [asking, setAsking] = useState(false);
  const [blocked, setBlocked] = useState<BlockReason | null>(null);

  async function allow() {
    if (asking) return;
    setAsking(true);
    const result = await requestCameraPermission();
    if (result === "granted") {
      window.location.assign(NEXT);
      return;
    }
    setAsking(false);
    setBlocked(result);
    document.getElementById("app-main")?.scrollTo({ top: 0 });
  }

  const notNow = (
    <ButtonLink href={NEXT} size="lg" variant="ghost" className="h-11 w-full text-sm font-medium text-muted-foreground">
      Not now
    </ButtonLink>
  );

  if (blocked) {
    const copy = blockedCopy(blocked, device);
    return (
      <FirstRunStep
        actions={
          <>
            <Button size="lg" className="w-full" onClick={allow} aria-busy={asking}>
              <RefreshCw aria-hidden="true" />
              {copy.primary}
            </Button>
            {notNow}
          </>
        }
      >
        <BlockedNotice copy={copy} />
        <PermissionHelp copy={copy} />
      </FirstRunStep>
    );
  }

  return (
    <FirstRunStep
      actions={
        <>
          <p className="text-center text-xs leading-[18px] text-muted-foreground">
            Your phone will ask you to confirm. Choose Allow.
          </p>
          <Button size="lg" className="w-full" onClick={allow} aria-busy={asking}>
            {asking ? "Waiting for your answer…" : "Allow camera"}
          </Button>
          {notNow}
        </>
      }
    >
      <FirstRunHero needs={700}>
        <div className="relative flex size-40 items-center justify-center rounded-full bg-pend-bg">
          <span className="absolute inset-[22px] rounded-full border border-border bg-card" />
          <Camera className="relative size-14 text-primary" strokeWidth={1.75} />
        </div>
      </FirstRunHero>
      <FirstRunHeading
        title="Allow the camera"
        body="You'll use it to scan the IN and OUT codes posted at the office entrance."
      />
      <PromiseList items={PROMISES} />
      {device.inApp ? (
        <PermissionHelp
          copy={{
            help: [],
            inAppSteps: blockedCopy("camera-failed", device).inAppSteps,
          }}
        />
      ) : null}
    </FirstRunStep>
  );
}
