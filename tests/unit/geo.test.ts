import { describe, expect, it } from "vitest";

import {
  evaluateLocation,
  haversineDistanceMeters,
} from "@/lib/geo/distance";

describe("haversineDistanceMeters", () => {
  it("returns zero for identical points", () => {
    const point = { latitude: 14.5995, longitude: 120.9842 };
    expect(haversineDistanceMeters(point, point)).toBe(0);
  });

  it("is symmetric", () => {
    const a = { latitude: 14.5995, longitude: 120.9842 };
    const b = { latitude: 14.6095, longitude: 120.9942 };
    expect(haversineDistanceMeters(a, b)).toBeCloseTo(
      haversineDistanceMeters(b, a),
      6,
    );
  });

  it("approximates a known short distance", () => {
    const a = { latitude: 14.5995, longitude: 120.9842 };
    const b = { latitude: 14.5995, longitude: 120.9852 };
    expect(haversineDistanceMeters(a, b)).toBeGreaterThan(100);
    expect(haversineDistanceMeters(a, b)).toBeLessThan(120);
  });
});

describe("evaluateLocation", () => {
  const base = {
    geofenceRadiusMeters: 100,
    maxAccuracyMeters: 50,
  };

  it("accepts a confident in-radius sample", () => {
    expect(
      evaluateLocation({
        ...base,
        distanceMeters: 30,
        accuracyMeters: 10,
      }),
    ).toBe("ACCEPT");
  });

  it("rejects a clearly outside sample", () => {
    expect(
      evaluateLocation({
        ...base,
        distanceMeters: 300,
        accuracyMeters: 10,
      }),
    ).toBe("OUTSIDE");
  });

  it("marks a borderline sample as uncertain", () => {
    expect(
      evaluateLocation({
        ...base,
        distanceMeters: 95,
        accuracyMeters: 20,
      }),
    ).toBe("UNCERTAIN");
  });

  it("never accepts a sample beyond the accuracy limit", () => {
    expect(
      evaluateLocation({
        ...base,
        distanceMeters: 0,
        accuracyMeters: 80,
      }),
    ).not.toBe("ACCEPT");
  });
});
