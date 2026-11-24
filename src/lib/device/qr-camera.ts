/**
 * Rear-camera QR reading for the scan screen (browser only).
 *
 * iOS Safari needs the <video> to be muted and inline, or it refuses to play
 * the stream (or jumps to fullscreen). Both are set here as properties and
 * attributes, because React's `muted` prop does not reliably reach the DOM.
 *
 * @zxing/browser is imported lazily so camera code loads only on the scan page.
 */

export interface QrCameraHandle {
  stop(): void;
}

const CONSTRAINTS: MediaStreamConstraints = {
  audio: false,
  video: {
    // "ideal" rather than "exact": laptops and some Android tablets only have
    // a front camera, and an exact constraint would fail outright.
    facingMode: { ideal: "environment" },
    width: { ideal: 1280 },
    height: { ideal: 720 },
  },
};

function prepareVideo(video: HTMLVideoElement) {
  video.muted = true;
  video.playsInline = true;
  video.setAttribute("muted", "");
  video.setAttribute("playsinline", "");
  video.setAttribute("webkit-playsinline", "");
}

/**
 * Starts the camera and calls `onDecode` once with the first QR text read,
 * then stops. Rejects with the getUserMedia error if the camera can't start.
 */
export async function startQrCamera(
  video: HTMLVideoElement,
  onDecode: (text: string, video: HTMLVideoElement) => void,
): Promise<QrCameraHandle> {
  prepareVideo(video);
  const { BrowserQRCodeReader } = await import("@zxing/browser");
  const reader = new BrowserQRCodeReader(undefined, {
    delayBetweenScanAttempts: 150,
    delayBetweenScanSuccess: 600,
  });

  let finished = false;
  const controls = await reader.decodeFromConstraints(CONSTRAINTS, video, (result, _error, ctl) => {
    if (!result || finished) return;
    finished = true;
    // Notify caller BEFORE stopping stream so the live rear-camera frame can be captured.
    try {
      onDecode(result.getText(), video);
    } finally {
      ctl.stop();
    }
  });

  return {
    stop() {
      finished = true;
      controls.stop();
    },
  };
}

/** A short buzz on decode where supported (Android Chrome); iOS ignores it. */
export function confirmDecodeHaptic() {
  if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    navigator.vibrate(30);
  }
}
