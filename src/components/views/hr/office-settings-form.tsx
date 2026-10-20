"use client";

import { CheckCircle2 } from "lucide-react";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { createHttpSetupApi, createMockSetupApi } from "@/lib/setup/api";
import type { OfficeSetupVM } from "@/lib/ui/view-models";

const INPUT = "h-9 w-24 rounded-btn border border-border bg-card px-3 font-mono text-sm text-foreground aria-[invalid=true]:border-attn";

function validate(radius: number, accuracy: number): { radius?: string; accuracy?: string } {
  const errors: { radius?: string; accuracy?: string } = {};
  if (!Number.isInteger(radius) || radius < 10 || radius > 500) errors.radius = "Use 10 to 500 metres.";
  if (!Number.isInteger(accuracy) || accuracy < 5 || accuracy > 100) errors.accuracy = "Use 5 to 100 metres.";
  else if (!errors.radius && accuracy >= radius) errors.accuracy = "Must be smaller than the radius, or no scan could pass.";
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
  const [radius, setRadius] = useState(String(office.radiusM));
  const [accuracy, setAccuracy] = useState(String(office.maxAccuracyM));
  const [errors, setErrors] = useState<{ radius?: string; accuracy?: string }>({});
  const [state, setState] = useState<{ kind: "idle" | "saving" } | { kind: "saved"; version: number } | { kind: "error"; message: string }>({ kind: "idle" });
  const r = Number(radius);
  const a = Number(accuracy);
  const changed = r !== office.radiusM || a !== office.maxAccuracyM;

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const found = validate(r, a);
    setErrors(found);
    if (found.radius || found.accuracy) {
      document.getElementById(found.radius ? "office-radius" : "office-accuracy")?.focus();
      return;
    }
    setState({ kind: "saving" });
    const result = await api.saveOffice({ radiusM: r, maxAccuracyM: a });
    setState(result.ok ? { kind: "saved", version: result.value.settingsVersion } : { kind: "error", message: result.message });
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
        <dd>{office.timeZone}</dd>
      </dl>
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
