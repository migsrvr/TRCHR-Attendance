/**
 * Geodesic distance helpers.
 *
 * Harversine distance on a spherical Earth. Keep one consistent implementation
 * shared by the scan service and any tooling. See Technical Design v1.0
 * section 5 ("Location rule").
 */

const EARTH_RADIUS_METERS = 6_371_008.8;

export interface LatLng {
  readonly latitude: number;
  readonly longitude: number;
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** Great-circle (haversine) distance between two points, in meters. */
export function haversineDistanceMeters(a: LatLng, b: LatLng): number {
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const deltaLat = toRadians(b.latitude - a.latitude);
  const deltaLng = toRadians(b.longitude - a.longitude);

  const sinLat = Math.sin(deltaLat / 2);
  const sinLng = Math.sin(deltaLng / 2);
  const h =
    sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;

  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(h)));
}

export type LocationDecision = "ACCEPT" | "OUTSIDE" | "UNCERTAIN";

/**
 * Evaluate the office location rule:
 *   accept:    accuracy <= maxAccuracy AND distance + accuracy <= radius
 *   outside:   distance - accuracy > radius
 *   otherwise: uncertain
 */
export function evaluateLocation(input: {
  readonly distanceMeters: number;
  readonly accuracyMeters: number;
  readonly geofenceRadiusMeters: number;
  readonly maxAccuracyMeters: number;
}): LocationDecision {
  const { distanceMeters, accuracyMeters, geofenceRadiusMeters, maxAccuracyMeters } =
    input;

  if (accuracyMeters > maxAccuracyMeters) {
    return distanceMeters - accuracyMeters > geofenceRadiusMeters
      ? "OUTSIDE"
      : "UNCERTAIN";
  }

  if (distanceMeters + accuracyMeters <= geofenceRadiusMeters) {
    return "ACCEPT";
  }

  if (distanceMeters - accuracyMeters > geofenceRadiusMeters) {
    return "OUTSIDE";
  }

  return "UNCERTAIN";
}
