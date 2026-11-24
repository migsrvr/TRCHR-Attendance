/**
 * Live WebRTC camera frame capture, pixel-luma variance verification,
 * tamper-evident watermarking, and SHA-256 hashing (browser + mock fallback).
 */

import type { PhotoCaptureFrame } from "@/lib/ui/scan-state";

const TARGET_WIDTH = 480;
const TARGET_HEIGHT = 360;
const JPEG_QUALITY = 0.72;

async function sha256HexBrowser(input: string): Promise<string> {
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const bytes = new TextEncoder().encode(input);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  // Fallback deterministic FNV-style 64-hex for environments without crypto.subtle
  let h1 = 0xdeadbeef ^ input.length;
  let h2 = 0x41c6ce57 ^ input.length;
  for (let i = 0; i < input.length; i += 1) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  const part = (n: number) => (n >>> 0).toString(16).padStart(8, "0");
  return (part(h1) + part(h2)).repeat(4);
}

function computeLumaStdDev(rgba: Uint8ClampedArray): number {
  const pixelCount = Math.floor(rgba.length / 4);
  if (pixelCount === 0) return 0;
  // Sample every 4th pixel for speed (<1ms on 480x360)
  let count = 0;
  let sum = 0;
  let sumSq = 0;
  for (let i = 0; i < rgba.length; i += 16) {
    const r = rgba[i] ?? 0;
    const g = rgba[i + 1] ?? 0;
    const b = rgba[i + 2] ?? 0;
    const luma = 0.299 * r + 0.587 * g + 0.114 * b;
    count += 1;
    sum += luma;
    sumSq += luma * luma;
  }
  if (count <= 1) return 0;
  const mean = sum / count;
  const variance = Math.max(0, sumSq / count - mean * mean);
  return Number(Math.sqrt(variance).toFixed(2));
}

/**
 * Capture a frame from an active <video> element, stamp a tamper-evident
 * watermark bar, compute pixel variance, and return the JPEG data URL + SHA-256.
 */
export async function captureLiveVideoFrame(
  video: HTMLVideoElement | null,
  options: {
    readonly facingMode: "environment" | "user";
    readonly watermarkText: string;
  },
): Promise<PhotoCaptureFrame | null> {
  if (typeof document === "undefined" || !video || video.videoWidth <= 0 || video.videoHeight <= 0) {
    return null;
  }

  const stream = video.srcObject instanceof MediaStream ? video.srcObject : null;
  const track = stream?.getVideoTracks()[0];
  if (track && track.readyState !== "live") {
    return null;
  }

  const canvas = document.createElement("canvas");
  canvas.width = TARGET_WIDTH;
  canvas.height = TARGET_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.drawImage(video, 0, 0, TARGET_WIDTH, TARGET_HEIGHT);
  const imageData = ctx.getImageData(0, 0, TARGET_WIDTH, TARGET_HEIGHT);
  const frameVariance = computeLumaStdDev(imageData.data);

  // Stamp tamper-evident watermark banner at bottom
  ctx.fillStyle = "rgba(11, 18, 32, 0.76)";
  ctx.fillRect(0, TARGET_HEIGHT - 28, TARGET_WIDTH, 28);
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 11px monospace";
  ctx.fillText(options.watermarkText.slice(0, 68), 10, TARGET_HEIGHT - 10);

  const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
  const sha256 = await sha256HexBrowser(dataUrl);

  return {
    dataUrl,
    sha256,
    width: TARGET_WIDTH,
    height: TARGET_HEIGHT,
    frameVariance,
    facingMode: options.facingMode,
    capturedAtUtc: new Date().toISOString(),
  };
}

/**
 * Synthesize a realistic watermarked canvas frame for developer camera-off mode
 * (?camera=off / mock mode) so E2E and desktop testing work without a physical webcam.
 */
export async function createSyntheticDevPhotoFrame(options: {
  readonly facingMode: "environment" | "user";
  readonly watermarkText: string;
}): Promise<PhotoCaptureFrame> {
  const capturedAtUtc = new Date().toISOString();
  if (typeof document !== "undefined") {
    const canvas = document.createElement("canvas");
    canvas.width = TARGET_WIDTH;
    canvas.height = TARGET_HEIGHT;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      const grad = ctx.createLinearGradient(0, 0, TARGET_WIDTH, TARGET_HEIGHT);
      grad.addColorStop(0, options.facingMode === "user" ? "#1A4175" : "#10294C");
      grad.addColorStop(0.5, "#366296");
      grad.addColorStop(1, "#E8ECF2");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, TARGET_WIDTH, TARGET_HEIGHT);

      ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
      ctx.font = "bold 16px sans-serif";
      ctx.fillText(
        options.facingMode === "user" ? "TRCHR DEV SELFIE PREVIEW" : "TRCHR DEV WALL QR SNAPSHOT",
        24,
        160,
      );

      ctx.fillStyle = "rgba(11, 18, 32, 0.8)";
      ctx.fillRect(0, TARGET_HEIGHT - 28, TARGET_WIDTH, 28);
      ctx.fillStyle = "#FFFFFF";
      ctx.font = "bold 11px monospace";
      ctx.fillText(options.watermarkText.slice(0, 68), 10, TARGET_HEIGHT - 10);

      const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
      const sha256 = await sha256HexBrowser(dataUrl);
      return {
        dataUrl,
        sha256,
        width: TARGET_WIDTH,
        height: TARGET_HEIGHT,
        frameVariance: 32.4,
        facingMode: options.facingMode,
        capturedAtUtc,
      };
    }
  }

  const fallbackDataUrl = `data:image/jpeg;base64,${"B".repeat(240)}`;
  const sha256 = await sha256HexBrowser(fallbackDataUrl);
  return {
    dataUrl: fallbackDataUrl,
    sha256,
    width: TARGET_WIDTH,
    height: TARGET_HEIGHT,
    frameVariance: 28.0,
    facingMode: options.facingMode,
    capturedAtUtc,
  };
}
