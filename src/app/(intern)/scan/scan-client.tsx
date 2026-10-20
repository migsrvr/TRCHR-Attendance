"use client";

import { useEffect, useReducer, useRef, useState } from "react";

import { InternShell } from "@/components/shell/intern-shell";
import { ScanBlockedView } from "@/components/views/intern/scan-blocked-view";
import { ScanCheckingView } from "@/components/views/intern/scan-checking-view";
import { ScanFailedView } from "@/components/views/intern/scan-failed-view";
import { ScanReadyView } from "@/components/views/intern/scan-ready-view";
import { ScanSavedView } from "@/components/views/intern/scan-saved-view";
import { ScanUnconfirmedView } from "@/components/views/intern/scan-unconfirmed-view";
import { getFreshLocation, LocationError } from "@/lib/device/location";
import {
  cameraSupport,
  classifyCameraError,
  detectInAppBrowser,
  detectPlatform,
  type MobilePlatform,
} from "@/lib/device/platform";
import { confirmDecodeHaptic, startQrCamera, type QrCameraHandle } from "@/lib/device/qr-camera";
import { createHttpScanApi, type ScanApi, type TodaySummary } from "@/lib/scan/api";
import { createMockScanApi, type MockScenario } from "@/lib/scan/mock-api";
import { formatClock, formatShortDate } from "@/lib/ui/format";
import { newId } from "@/lib/ui/id";
import type { ScanContext } from "@/lib/ui/queries/intern";
import { blockedCopy, failureCopy } from "@/lib/ui/scan-copy";
import { initialScanState, scanReducer } from "@/lib/ui/scan-state";

import { DevPanel } from "./dev-panel";

/** A save that hasn't answered by now is treated as a lost response (Technical Design section 6). */
const REQUEST_TIMEOUT_MS = 12_000;
const LOCATION_TIMEOUT_MS = 15_000;

export interface MockSettings {
  scenario: MockScenario;
  cameraOff: boolean;
}

export function ScanClient({ context, mock }: { context: ScanContext; mock: MockSettings | null }) {
  const [api] = useState<ScanApi>(() =>
    mock
      ? createMockScanApi({ scenario: mock.scenario, openSince: context.openSince, timeZone: context.timeZone })
      : createHttpScanApi(),
  );
  const [state, dispatch] = useReducer(scanReducer, context.openSince ? "TIME_OUT" : "TIME_IN", initialScanState);
  const [openSince, setOpenSince] = useState(context.openSince);
  const [summary, setSummary] = useState<TodaySummary | null | "error">(null);
  const [device, setDevice] = useState<{ platform: MobilePlatform; inApp: string | null }>({
    platform: "other",
    inApp: null,
  });
  const [pageVisible, setPageVisible] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const cameraOff = mock?.cameraOff ?? false;

  // Platform is only knowable in the browser.
  useEffect(() => {
    setDevice({
      platform: detectPlatform(navigator.userAgent, navigator.maxTouchPoints),
      inApp: detectInAppBrowser(navigator.userAgent),
    });
  }, []);

  // Release the camera when the intern switches apps; iOS would black it out anyway.
  useEffect(() => {
    const onVisibility = () => setPageVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  // Each new screen starts at the top of the scroll area.
  useEffect(() => {
    document.getElementById("app-main")?.scrollTo({ top: 0 });
  }, [state.status]);

  // Camera: runs while the scanner is showing and the page is visible.
  const cameraWanted = (state.status === "starting" || state.status === "ready") && pageVisible;
  useEffect(() => {
    if (!cameraWanted) return;
    if (cameraOff) {
      dispatch({ type: "camera-ready" });
      return;
    }
    const unsupported = cameraSupport({
      isSecureContext: window.isSecureContext,
      hasGetUserMedia: typeof navigator.mediaDevices?.getUserMedia === "function",
    });
    if (unsupported) {
      dispatch({ type: "camera-error", reason: unsupported });
      return;
    }
    const video = videoRef.current;
    if (!video) return;

    let cancelled = false;
    let handle: QrCameraHandle | null = null;
    startQrCamera(video, (token) => {
      if (cancelled) return;
      confirmDecodeHaptic();
      dispatch({ type: "decoded", token, requestKey: newId() });
    })
      .then((started) => {
        if (cancelled) {
          started.stop();
          return;
        }
        handle = started;
        dispatch({ type: "camera-ready" });
      })
      .catch((error: unknown) => {
        if (!cancelled) dispatch({ type: "camera-error", reason: classifyCameraError(error) });
      });

    return () => {
      cancelled = true;
      handle?.stop();
    };
  }, [cameraWanted, cameraOff]);

  // Checking: one step per state; the reducer moves us to the next.
  useEffect(() => {
    if (state.status !== "checking") return;
    let cancelled = false;
    const controller = new AbortController();
    const timer =
      state.step === "location" ? undefined : setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    const run = async () => {
      try {
        if (state.step === "intent") {
          const result = await api.createIntent(state.token, controller.signal);
          if (cancelled) return;
          dispatch(result.ok ? { type: "intent-ok", intent: result.value } : { type: "failed", failure: result.failure });
        } else if (state.step === "location") {
          const location = await getFreshLocation(LOCATION_TIMEOUT_MS);
          if (cancelled) return;
          dispatch({ type: "location-ok", location });
        } else if (state.rechecking) {
          const receipt = await api.getReceipt(state.requestKey, controller.signal);
          if (cancelled) return;
          dispatch(receipt ? { type: "saved", receipt } : { type: "failed", failure: { reason: "not-saved" } });
        } else if (state.intent && state.location) {
          const result = await api.submitScan(
            { intentId: state.intent.intentId, requestKey: state.requestKey, location: state.location },
            controller.signal,
          );
          if (cancelled) return;
          dispatch(result.ok ? { type: "saved", receipt: result.value } : { type: "failed", failure: result.failure });
        }
      } catch (error) {
        if (cancelled) return;
        if (error instanceof LocationError) {
          dispatch(
            error.reason === "denied" ? { type: "location-denied" } : { type: "failed", failure: { reason: error.reason } },
          );
        } else {
          // No answer: before saving this means nothing was sent; while saving it may have saved.
          dispatch({ type: "timeout" });
        }
      }
    };
    void run();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      controller.abort();
    };
  }, [state, api]);

  // After a save: keep the identity card current and fetch today's totals for a Time out.
  useEffect(() => {
    if (state.status !== "saved") return;
    if (state.receipt.action === "TIME_IN") {
      setOpenSince(formatClock(new Date(state.receipt.receivedAtUtc), context.timeZone));
      return;
    }
    setOpenSince(null);
    setSummary(null);
    let cancelled = false;
    const controller = new AbortController();
    api
      .getTodaySummary(controller.signal)
      .then((value) => !cancelled && setSummary(value))
      .catch(() => !cancelled && setSummary("error"));
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [state, api, context.timeZone]);

  const identity = {
    name: context.internName,
    department: context.department,
    dateLabel: formatShortDate(context.todayIso, { weekday: true }),
  };

  let body: React.ReactNode;
  switch (state.status) {
    case "starting":
    case "ready":
      body = (
        <ScanReadyView
          identity={identity}
          status={openSince ? { type: "session", value: "OPEN" } : { type: "today", value: "NOT_STARTED" }}
          statusMeta={openSince ? `since ${openSince}` : undefined}
          expected={state.expected}
          cameraState={state.status}
          cameraSlot={
            cameraOff ? (
              <div className="absolute left-3 top-3 text-[11px] leading-4 text-sidebar-foreground">
                Camera off (developer mode)
              </div>
            ) : (
              <video
                ref={videoRef}
                className="camera-video absolute inset-0 size-full object-cover"
                playsInline
                muted
                autoPlay
                aria-label="Camera preview"
              />
            )
          }
          devPanel={
            mock ? (
              <DevPanel
                scenario={mock.scenario}
                openSince={context.openSince}
                cameraOff={cameraOff}
                onSimulate={(token) => dispatch({ type: "decoded", token, requestKey: newId() })}
              />
            ) : undefined
          }
        />
      );
      break;
    case "checking":
      body = (
        <ScanCheckingView
          step={state.step}
          attempted={state.intent?.action ?? state.expected}
          checkpointName={state.intent?.checkpointName}
          rechecking={state.rechecking}
        />
      );
      break;
    case "saved":
      body = (
        <ScanSavedView
          receipt={state.receipt}
          name={context.internName}
          timeZone={context.timeZone}
          summary={summary}
          onDone={() => dispatch({ type: "reset" })}
        />
      );
      break;
    case "failed":
      body = <ScanFailedView copy={failureCopy(state.failure, state.attempted)} onReset={() => dispatch({ type: "reset" })} />;
      break;
    case "unconfirmed":
      body = (
        <ScanUnconfirmedView
          attempted={state.intent.action}
          checkpointName={state.intent.checkpointName}
          onCheckAgain={() => dispatch({ type: "recheck" })}
        />
      );
      break;
    case "blocked": {
      const reason = state.reason;
      body = (
        <ScanBlockedView
          copy={blockedCopy(reason, device)}
          onRetry={() => {
            // Browsers often keep a denial until the page reloads, on iOS especially.
            if (reason === "camera-denied" || reason === "location-denied") window.location.reload();
            else dispatch({ type: "retry-camera" });
          }}
        />
      );
      break;
    }
  }

  // Tabs only while scanning; hidden mid-save and on results so a stray tap can't abandon a scan.
  const showTabs = state.status === "starting" || state.status === "ready";
  return (
    <InternShell active="scan" showTabs={showTabs} initials={context.initials}>
      {body}
    </InternShell>
  );
}
