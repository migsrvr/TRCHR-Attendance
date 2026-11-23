"use client";

import { CheckCircle2 } from "lucide-react";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { createHttpSetupApi, createMockSetupApi } from "@/lib/setup/api";
import type { OfficeSetupVM } from "@/lib/ui/view-models";

const INPUT = "h-9 w-24 rounded-btn border border-border bg-card px-3 font-mono text-sm text-foreground aria-[invalid=true]:border-attn";
const WIDE_INPUT = "h-9 w-full rounded-btn border border-border bg-card px-3 font-mono text-sm text-foreground aria-[invalid=true]:border-attn";

interface OfficeFormErrors {
  radius?: string;
  accuracy?: string;
  latitude?: string;
  longitude?: string;
  timezone?: string;
}

function validate(
  radius: number,
  accuracy: number,
  latitudeText: string,
  longitudeText: string,
  timezone: string,
): OfficeFormErrors {
  const errors: OfficeFormErrors = {};
  if (!Number.isInteger(radius) || radius < 10 || radius > 500) errors.radius = "Use 10 to 500 metres.";
  if (!Number.isInteger(accuracy) || accuracy < 5 || accuracy > 100) errors.accuracy = "Use 5 to 100 metres.";
  else if (!errors.radius && accuracy >= radius) errors.accuracy = "Must be smaller than the radius, or no scan could pass.";

  if (latitudeText.trim() !== "") {
    const lat = Number(latitudeText);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) errors.latitude = "Use a latitude between -90 and 90.";
  }
  if (longitudeText.trim() !== "") {
    const lng = Number(longitudeText);
    if (!Number.isFinite(lng) || lng < -180 || lng > 180) errors.longitude = "Use a longitude between -180 and 180.";
  }
  if (!timezone.trim()) {
    errors.timezone = "Enter a valid IANA time zone (for example, Asia/Manila).";
  }
  return errors;
}

/** The geofence drawn to scale: ring = accept radius, halo = worst accuracy allowed. */
function GeofencePreview({ radius, accuracy }: { radius: number; accuracy: number }) {
  const ring = 56;
  const halo = Math.max(4, Math.min(ring, (accuracy / Math.max(radius, 1)) * ring));
  return (
    <svg width="160" height="120" viewBox="0 0 160 120" role="img" aria-label={`Accept radius ${radius} metres; worst accuracy allowed ${accuracy} metres`}>
      <circle cx="80" cy="60" r={ring} className="fill-pend-bg stroke-pend" strokeWidth="1.5" />
      <circle cx="80" cy="60" r="3" className="fill-pend" />
      <circle cx="80" cy="60" r={halo} className="fill-settled" fillOpacity="0.18" />
      <text x="80" y="14" textAnchor="middle" className="fill-pend font-mono text-[11px]">
        {radius} m
      </text>
      <text x="80" y={Math.min(60 + halo + 14, 116)} textAnchor="middle" className="fill-muted-foreground font-mono text-[11px]">
        ±{accuracy} m
      </text>
    </svg>
  );
}

export function OfficeSettingsForm({ office, mock }: { office: OfficeSetupVM["office"]; mock: boolean }) {
  const [api] = useState(() => (mock ? createMockSetupApi() : createHttpSetupApi()));
  const initialLat = office.latitude !== undefined ? String(office.latitude) : "";
  const initialLng = office.longitude !== undefined ? String(office.longitude) : "";
  const [radius, setRadius] = useState(String(office.radiusM));
  const [accuracy, setAccuracy] = useState(String(office.maxAccuracyM));
  const [latitude, setLatitude] = useState(initialLat);
  const [longitude, setLongitude] = useState(initialLng);
  const [timezone, setTimezone] = useState(office.timeZone);
  const [configVersion, setConfigVersion] = useState(office.settingsVersion);
  const [errors, setErrors] = useState<OfficeFormErrors>({});
  const [state, setState] = useState<{ kind: "idle" | "saving" } | { kind: "saved"; version: number } | { kind: "error"; message: string }>({ kind: "idle" });
  const r = Number(radius);
  const a = Number(accuracy);
  const changed =
    r !== office.radiusM ||
    a !== office.maxAccuracyM ||
    latitude !== initialLat ||
    longitude !== initialLng ||
    timezone.trim() !== office.timeZone;

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const found = validate(r, a, latitude, longitude, timezone);
    setErrors(found);
    const firstField = found.radius
      ? "office-radius"
      : found.accuracy
        ? "office-accuracy"
        : found.latitude
          ? "office-latitude"
          : found.longitude
            ? "office-longitude"
            : found.timezone
              ? "office-timezone"
              : null;
    if (firstField) {
      document.getElementById(firstField)?.focus();
      return;
    }
    setState({ kind: "saving" });
    const result = await api.saveOffice({
      ...(office.id ? { officeId: office.id } : {}),
      expectedConfigVersion: configVersion,
      radiusM: r,
      maxAccuracyM: a,
      ...(latitude.trim() !== "" ? { latitude: Number(latitude) } : {}),
      ...(longitude.trim() !== "" ? { longitude: Number(longitude) } : {}),
      ...(timezone.trim() !== office.timeZone ? { timezone: timezone.trim() } : {}),
    });
    if (result.ok) {
      setConfigVersion(result.value.settingsVersion);
      setState({ kind: "saved", version: result.value.settingsVersion });
    } else {
      setState({ kind: "error", message: result.message });
    }
  }

  return (
    <form noValidate onSubmit={save} className="flex flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-5 px-5 pb-4">
        <GeofencePreview radius={Number.isFinite(r) && r > 0 ? r : office.radiusM} accuracy={Number.isFinite(a) && a > 0 ? a : office.maxAccuracyM} />
        <div className="flex min-w-0 flex-1 basis-48 flex-col gap-3">
          {[
            { id: "office-radius", label: "Accept radius", unit: "metres from the office pin", value: radius, set: setRadius, error: errors.radius },
            { id: "office-accuracy", label: "Worst accuracy allowed", unit: "metres", value: accuracy, set: setAccuracy, error: errors.accuracy },
          ].map((field) => (
            <div key={field.id} className="flex flex-col gap-1.5">
              <label htmlFor={field.id} className="text-[13px] font-semibold leading-[18px]">
                {field.label}
              </label>
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  id={field.id}
                  type="number"
                  inputMode="numeric"
                  value={field.value}
                  onChange={(event) => {
                    field.set(event.target.value);
                    setState({ kind: "idle" });
                  }}
                  aria-invalid={field.error ? true : undefined}
                  aria-describedby={field.error ? `${field.id}-error` : undefined}
                  className={INPUT}
                />
                {field.unit}
              </span>
              {field.error ? (
                <p id={`${field.id}-error`} className="text-xs font-medium text-attn">
                  {field.error}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      </div>
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 border-t border-hairline px-5 py-4 text-[13px] leading-[18px]">
        <dt className="text-muted-foreground">Office</dt>
        <dd>{office.name}</dd>
        <dt className="text-muted-foreground">Pin</dt>
        <dd className="font-mono">{office.pinLabel}</dd>
        <dt className="text-muted-foreground">Time zone</dt>
        <dd>{timezone}</dd>
      </dl>
      <details className="border-t border-hairline px-5 py-3">
        <summary className="cursor-pointer select-none text-xs font-semibold text-primary hover:underline">
          Edit pin coordinates and time zone
        </summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="office-latitude" className="text-xs font-semibold leading-4 text-muted-foreground">
              Pin latitude
            </label>
            <input
              id="office-latitude"
              type="number"
              step="0.000001"
              placeholder="14.554700"
              value={latitude}
              onChange={(event) => {
                setLatitude(event.target.value);
                setState({ kind: "idle" });
              }}
              aria-invalid={errors.latitude ? true : undefined}
              aria-describedby={errors.latitude ? "office-latitude-error" : undefined}
              className={WIDE_INPUT}
            />
            {errors.latitude ? (
              <p id="office-latitude-error" className="text-xs font-medium text-attn">
                {errors.latitude}
              </p>
            ) : null}
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="office-longitude" className="text-xs font-semibold leading-4 text-muted-foreground">
              Pin longitude
            </label>
            <input
              id="office-longitude"
              type="number"
              step="0.000001"
              placeholder="121.024400"
              value={longitude}
              onChange={(event) => {
                setLongitude(event.target.value);
                setState({ kind: "idle" });
              }}
              aria-invalid={errors.longitude ? true : undefined}
              aria-describedby={errors.longitude ? "office-longitude-error" : undefined}
              className={WIDE_INPUT}
            />
            {errors.longitude ? (
              <p id="office-longitude-error" className="text-xs font-medium text-attn">
                {errors.longitude}
              </p>
            ) : null}
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="office-timezone" className="text-xs font-semibold leading-4 text-muted-foreground">
              Time zone
            </label>
            <input
              id="office-timezone"
              type="text"
              value={timezone}
              onChange={(event) => {
                setTimezone(event.target.value);
                setState({ kind: "idle" });
              }}
              aria-invalid={errors.timezone ? true : undefined}
              aria-describedby={errors.timezone ? "office-timezone-error" : undefined}
              className={WIDE_INPUT}
            />
            {errors.timezone ? (
              <p id="office-timezone-error" className="text-xs font-medium text-attn">
                {errors.timezone}
              </p>
            ) : null}
          </div>
        </div>
      </details>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-hairline px-5 py-4">
        <p className="min-w-0 flex-1 basis-56 text-xs leading-[18px] text-muted-foreground">
          A scan counts only when the whole accuracy circle sits inside the radius.
        </p>
        {state.kind === "saved" ? (
          <p role="status" className="flex items-center gap-1.5 text-[13px] font-medium text-settled">
            <CheckCircle2 aria-hidden="true" className="size-4" />
            Saved as settings v{state.version}. New scans use it.
          </p>
        ) : (
          <Button type="submit" disabled={!changed} aria-busy={state.kind === "saving"}>
            {state.kind === "saving" ? "Saving…" : "Save location"}
          </Button>
        )}
        {state.kind === "error" ? (
          <p role="alert" className="basis-full text-xs text-attn">
            {state.message}
          </p>
        ) : null}
      </div>
    </form>
  );
}
