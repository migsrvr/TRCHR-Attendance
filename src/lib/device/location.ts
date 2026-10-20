/**
 * One fresh location fix per scan (Technical Design section 5). Never cached,
 * never watched in the background.
 */

import { classifyLocationError } from "@/lib/device/platform";
import type { LocationFix } from "@/lib/ui/scan-state";

export class LocationError extends Error {
  constructor(readonly reason: ReturnType<typeof classifyLocationError>) {
    super(reason);
    this.name = "LocationError";
  }
}

export function getFreshLocation(timeoutMs = 15_000): Promise<LocationFix> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      reject(new LocationError("location-unavailable"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracyMeters: position.coords.accuracy,
          capturedAtUtc: new Date(position.timestamp).toISOString(),
        }),
      (error) => reject(new LocationError(classifyLocationError(error.code))),
      // maximumAge 0: a cached fix could come from before the intern arrived.
      { enableHighAccuracy: true, maximumAge: 0, timeout: timeoutMs },
    );
  });
}
