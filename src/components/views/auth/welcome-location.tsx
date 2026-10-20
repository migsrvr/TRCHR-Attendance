"use client";

import { MapPin } from "lucide-react";
import { useState } from "react";

import { Button, ButtonLink } from "@/components/ui/button";
import { FirstRunHeading, FirstRunHero, FirstRunStep, PromiseList } from "@/components/views/auth/first-run-step";
import { requestLocationPermission } from "@/lib/device/permissions";
import type { MobilePlatform } from "@/lib/device/platform";
import { useDevice } from "@/lib/device/use-device";

const DONE = "/dashboard";
const BLOCKED = "/welcome/location-blocked";

const PROMISES = [
  "Read once, only at the moment you scan",
  "Never tracked in the background",
  "Only HR can see where a scan came from",
];

/** Each phone words the precise/approximate choice differently. */
function PreciseTip({ platform }: { platform: MobilePlatform }) {
  return (
    <div className="flex items-start gap-2.5 rounded-btn bg-pend-bg px-3.5 py-3">
      <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
      <p className="text-[13px] leading-[19px]">
        {platform === "ios" ? (
          <>
            When your iPhone asks, keep <span className="font-semibold">Precise: On</span>.
          </>
        ) : platform === "android" ? (
          <>
            When your phone asks, choose <span className="font-semibold">Precise</span>, not Approximate.
          </>
        ) : (
          <>
            When your phone asks, keep <span className="font-semibold">Precise location</span> on.
          </>
        )}{" "}
        Rough location usually isn&apos;t accurate enough to save a scan.
      </p>
    </div>
  );
}

/** First run, step 3: say what location is for, then let the phone ask. */
export function WelcomeLocation() {
  const device = useDevice();
  const [asking, setAsking] = useState(false);

  async function allow() {
    if (asking) return;
    setAsking(true);
    const result = await requestLocationPermission();
    window.location.assign(result === "granted" ? DONE : BLOCKED);
  }

  return (
    <FirstRunStep
      actions={
        <>
          <Button size="lg" className="w-full" onClick={allow} aria-busy={asking}>
            {asking ? "Waiting for your phone…" : "Allow location"}
          </Button>
          <ButtonLink href={DONE} size="lg" variant="ghost" className="h-11 w-full text-sm font-medium text-muted-foreground">
            Not now
          </ButtonLink>
        </>
      }
    >
      <FirstRunHero needs={816}>
        <svg width="160" height="160" viewBox="0 0 160 160">
          <circle cx="80" cy="80" r="76" className="fill-pend-bg" />
          <circle cx="80" cy="80" r="52" className="fill-card stroke-primary" strokeWidth="1.5" strokeDasharray="4 4" />
          <circle cx="80" cy="80" r="5" className="fill-primary" />
          <circle cx="96" cy="66" r="14" className="fill-accent" fillOpacity="0.18" />
          <circle cx="96" cy="66" r="6" className="fill-accent" />
        </svg>
      </FirstRunHero>
      <FirstRunHeading
        title="Allow location"
        body="Each scan checks that you're at the office entrance before it's saved."
      />
      <PromiseList items={PROMISES} />
      <PreciseTip platform={device.platform} />
    </FirstRunStep>
  );
}
