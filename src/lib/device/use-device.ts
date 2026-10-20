"use client";

import { useEffect, useState } from "react";

import { detectInAppBrowser, detectPlatform, type MobilePlatform } from "@/lib/device/platform";

export interface DeviceInfo {
  platform: MobilePlatform;
  inApp: string | null;
}

/**
 * The intern's phone platform and in-app browser. Starts as "other" (the
 * server can't know), so the first render shows both iPhone and Android help.
 */
export function useDevice(): DeviceInfo {
  const [device, setDevice] = useState<DeviceInfo>({ platform: "other", inApp: null });

  useEffect(() => {
    setDevice({
      platform: detectPlatform(navigator.userAgent, navigator.maxTouchPoints),
      inApp: detectInAppBrowser(navigator.userAgent),
    });
  }, []);

  return device;
}
