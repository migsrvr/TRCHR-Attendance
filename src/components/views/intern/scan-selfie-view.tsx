"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { captureLiveVideoFrame, createSyntheticDevPhotoFrame } from "@/lib/device/photo-capture";
import type { PhotoCaptureFrame, ScanAction } from "@/lib/ui/scan-state";

export interface ScanSelfieViewProps {
  action: ScanAction;
  checkpointName: string;
  intentId: string;
  wallPoster: PhotoCaptureFrame | null;
  cameraOff: boolean;
  onConfirm: (selfie: PhotoCaptureFrame) => void;
  onCancel: () => void;
}

export function ScanSelfieView({
  action,
  checkpointName,
  intentId,
  wallPoster,
  cameraOff,
  onConfirm,
  onCancel,
}: ScanSelfieViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [streamReady, setStreamReady] = useState(cameraOff);
  const [capturing, setCapturing] = useState(false);
  const actionLabel = action === "TIME_IN" ? "Time in" : "Time out";

  useEffect(() => {
    if (cameraOff) {
      setStreamReady(true);
      return;
    }
    if (typeof navigator === "undefined" || typeof navigator.mediaDevices?.getUserMedia !== "function") {
      setStreamReady(true);
      return;
    }

    let cancelled = false;
    let stream: MediaStream | null = null;

    navigator.mediaDevices
      .getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "user" },
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
      })
      .then((mediaStream) => {
        if (cancelled) {
          mediaStream.getTracks().forEach((track) => track.stop());
          return;
        }
        stream = mediaStream;
        const video = videoRef.current;
        if (video) {
          video.muted = true;
          video.playsInline = true;
          video.srcObject = mediaStream;
          void video.play().catch(() => {});
        }
        setStreamReady(true);
      })
      .catch(() => {
        if (!cancelled) {
          setStreamReady(true);
        }
      });

    return () => {
      cancelled = true;
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [cameraOff]);

  const handleCapture = async () => {
    if (capturing) return;
    setCapturing(true);
    try {
      const watermarkText = `TRCHR · ${action} · ${new Date().toISOString().slice(0, 19)}Z · ${intentId.slice(0, 8)}`;
      const video = videoRef.current;
      let frame: PhotoCaptureFrame | null = null;
      if (!cameraOff && video && video.videoWidth > 0) {
        frame = await captureLiveVideoFrame(video, {
          facingMode: "user",
          watermarkText,
        });
      }
      if (!frame) {
        frame = await createSyntheticDevPhotoFrame({
          facingMode: "user",
          watermarkText,
        });
      }
      onConfirm(frame);
    } finally {
      setCapturing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Step 2 of 2 · Presence check
            </p>
            <h1 className="mt-0.5 text-[18px] font-semibold leading-6 tracking-[-0.01em]">
              Take a quick selfie to save {actionLabel}
            </h1>
            <p className="mt-1 text-[13px] leading-5 text-muted-foreground">
              {checkpointName} · Location verified. Confirm you are at the entrance so HR can verify this scan.
            </p>
          </div>
          {wallPoster ? (
            <div className="shrink-0 text-right">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={wallPoster.dataUrl}
                alt="Captured wall QR poster"
                className="h-12 w-16 rounded border border-border object-cover"
              />
              <span className="mt-0.5 block text-[10px] font-medium text-settled">Wall QR OK</span>
            </div>
          ) : null}
        </div>

        <div className="relative mt-3 aspect-[4/3] w-full overflow-hidden rounded-md border border-border bg-sidebar">
          {cameraOff ? (
            <div className="flex size-full flex-col items-center justify-center p-4 text-center text-sidebar-foreground">
              <p className="text-[13px] font-medium">Front camera preview (developer mode)</p>
              <p className="mt-1 text-[11px] opacity-75">
                Tap below to generate a watermarked verification selfie frame.
              </p>
            </div>
          ) : (
            <video
              ref={videoRef}
              className="size-full -scale-x-100 object-cover"
              playsInline
              muted
              autoPlay
              aria-label="Front camera selfie preview"
            />
          )}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-black/65 px-3 py-1.5 font-mono text-[11px] text-white">
            TRCHR · {action} · {checkpointName}
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-2">
          <Button
            type="button"
            className="h-11 w-full"
            disabled={!streamReady || capturing}
            onClick={() => void handleCapture()}
            data-testid="confirm-selfie-btn"
          >
            {capturing ? "Verifying photo…" : `Take selfie & save ${actionLabel}`}
          </Button>
          <Button type="button" variant="outline" className="h-10 w-full" onClick={onCancel} disabled={capturing}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
