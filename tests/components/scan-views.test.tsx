import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { StatusMark } from "@/components/ui/status-mark";
import { ScanBlockedView } from "@/components/views/intern/scan-blocked-view";
import { ScanCheckingView } from "@/components/views/intern/scan-checking-view";
import { ScanFailedView } from "@/components/views/intern/scan-failed-view";
import { ScanReadyView } from "@/components/views/intern/scan-ready-view";
import { ScanSavedView } from "@/components/views/intern/scan-saved-view";
import { ScanSelfieView } from "@/components/views/intern/scan-selfie-view";
import { ScanUnconfirmedView } from "@/components/views/intern/scan-unconfirmed-view";
import { blockedCopy, failureCopy } from "@/lib/ui/scan-copy";
import type { ScanReceipt } from "@/lib/ui/scan-state";

const noop = () => {};
const identity = { name: "Ana Reyes", department: "Marketing", dateLabel: "Mon, Oct 19" };
const receipt: ScanReceipt = {
  receiptId: "4f2a91c0-7d1e-4b8a-9c2f-000000000000",
  action: "TIME_IN",
  receivedAtUtc: "2026-10-19T00:57:12Z",
  checkpointName: "Main entrance · IN",
};

describe("StatusMark", () => {
  it("renders an attention chip with its label", () => {
    const html = renderToStaticMarkup(<StatusMark kind={{ type: "session", value: "REVIEW" }} audience="hr" />);
    expect(html).toContain("Needs review");
    expect(html).toContain("bg-attn-bg");
  });

  it("renders a live mark with meta text", () => {
    const html = renderToStaticMarkup(
      <StatusMark kind={{ type: "session", value: "OPEN" }} audience="intern" meta="since 08:57" />,
    );
    expect(html).toContain("In office");
    expect(html).toContain("since 08:57");
  });
});

describe("ScanReadyView", () => {
  it("asks for the IN code before a session is open", () => {
    const html = renderToStaticMarkup(
      <ScanReadyView
        identity={identity}
        status={{ type: "today", value: "NOT_STARTED" }}
        expected="TIME_IN"
        cameraState="ready"
        cameraSlot={<video data-testid="cam" />}
      />,
    );
    expect(html).toContain("Ana Reyes");
    expect(html).toContain("Point your camera at the IN code");
    expect(html).toContain('data-testid="cam"');
    expect(html).not.toContain("Starting camera");
  });

  it("asks for the OUT code during an open session and shows a starting overlay", () => {
    const html = renderToStaticMarkup(
      <ScanReadyView
        identity={identity}
        status={{ type: "session", value: "OPEN" }}
        statusMeta="since 08:57"
        expected="TIME_OUT"
        cameraState="starting"
        cameraSlot={null}
      />,
    );
    expect(html).toContain("Point your camera at the OUT code");
    expect(html).toContain("Starting camera");
  });
});

describe("ScanCheckingView", () => {
  it("says the scan is not saved yet and never uses the success color", () => {
    const html = renderToStaticMarkup(
      <ScanCheckingView step="location" attempted="TIME_IN" checkpointName="Main entrance · IN" />,
    );
    expect(html).toContain("Not saved yet");
    expect(html).toContain('role="status"');
    expect(html).toContain("Checking your location");
    expect(html).toContain("Saving your Time in");
    expect(html).not.toContain("text-settled\"");
  });
});

describe("ScanSavedView", () => {
  it("shows the server time with seconds and the receipt for a Time in", () => {
    const html = renderToStaticMarkup(
      <ScanSavedView receipt={receipt} name="Ana Reyes" timeZone="Asia/Manila" summary={null} onDone={noop} />,
    );
    expect(html).toContain("Time in saved");
    expect(html).toContain("08:57");
    expect(html).toContain(":12");
    expect(html).toContain("4F2A-91C0");
    expect(html).toContain("Scan the OUT code before you leave");
  });

  it("adds today's credit and totals for a Time out", () => {
    const html = renderToStaticMarkup(
      <ScanSavedView
        receipt={{ ...receipt, action: "TIME_OUT", receivedAtUtc: "2026-10-19T10:05:08Z" }}
        name="Ana Reyes"
        timeZone="Asia/Manila"
        summary={{
          sessionStart: "08:57",
          sessionEnd: "18:05",
          creditedTodayMinutes: 480,
          creditedTotalMinutes: 19230,
          requiredMinutes: 29160,
          pendingCorrections: 1,
        }}
        onDone={noop}
      />,
    );
    expect(html).toContain("Time out saved");
    expect(html).toContain("+8h 00m");
    expect(html).toContain("320h 30m");
    expect(html).toContain("165h 30m");
  });
});

describe("ScanFailedView", () => {
  it("renders the failure copy as an alert with facts", () => {
    const copy = failureCopy(
      { reason: "outside", distanceMeters: 412, radiusMeters: 60, accuracyMeters: 35, maxAccuracyMeters: 25 },
      "TIME_IN",
    );
    const html = renderToStaticMarkup(<ScanFailedView copy={copy} onReset={noop} />);
    expect(html).toContain('role="alert"');
    expect(html).toContain("You&#x27;re outside the office area");
    expect(html).toContain("412 m");
    expect(html).toContain("Scan again");
    expect(html).toContain('href="/corrections/new"');
  });
});

describe("ScanUnconfirmedView", () => {
  it("offers only a re-check, never a new scan", () => {
    const html = renderToStaticMarkup(
      <ScanUnconfirmedView attempted="TIME_OUT" checkpointName="Main entrance · OUT" onCheckAgain={noop} />,
    );
    expect(html).toContain("Check again");
    expect(html).toContain("may already be saved");
    expect(html).not.toContain("Scan again");
  });
});

describe("ScanBlockedView", () => {
  it("lists the platform steps", () => {
    const html = renderToStaticMarkup(
      <ScanBlockedView copy={blockedCopy("camera-denied", { platform: "ios", inApp: null })} onRetry={noop} />,
    );
    expect(html).toContain("Camera access is off");
    expect(html).toContain("Safari on iPhone");
    expect(html).toContain("Website Settings");
  });

  it("shows open-in-browser steps inside Messenger", () => {
    const html = renderToStaticMarkup(
      <ScanBlockedView copy={blockedCopy("camera-denied", { platform: "android", inApp: "Messenger" })} onRetry={noop} />,
    );
    expect(html).toContain("Open in Chrome");
  });
});

describe("ScanSelfieView", () => {
  it("renders front-camera confirmation and wall QR badge", () => {
    const html = renderToStaticMarkup(
      <ScanSelfieView
        action="TIME_IN"
        checkpointName="Main entrance · IN"
        intentId="11111111-1111-4111-8111-111111111111"
        wallPoster={{
          dataUrl: "data:image/jpeg;base64,d2FsbA==",
          sha256: "0".repeat(64),
          capturedAtUtc: "2026-10-19T00:57:10Z",
          facingMode: "environment",
          width: 480,
          height: 360,
          frameVariance: 18,
        }}
        cameraOff={true}
        onConfirm={noop}
        onCancel={noop}
      />,
    );
    expect(html).toContain("Take a quick selfie to save Time in");
    expect(html).toContain("Wall QR OK");
    expect(html).toContain("Take selfie &amp; save Time in");
  });
});
