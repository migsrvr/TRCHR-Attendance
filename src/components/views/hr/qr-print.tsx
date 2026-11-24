"use client";

import { Download, Printer } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";

/** Renders a crisp vector QR SVG (scalable to any poster size). */
export function QrSvg({
  token,
  label,
  onReady,
}: {
  token: string;
  label: string;
  onReady?: (svgMarkup: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    void import("@zxing/browser").then(({ BrowserQRCodeSvgWriter }) => {
      if (cancelled || !ref.current) return;
      const svg = new BrowserQRCodeSvgWriter().write(token, 320, 320);
      svg.setAttribute("role", "img");
      svg.setAttribute("aria-label", `QR code for ${label}`);
      svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      ref.current.replaceChildren(svg);
      setReady(true);
      onReady?.(svg.outerHTML);
    });
    return () => {
      cancelled = true;
    };
  }, [token, label, onReady]);

  return (
    <div
      ref={ref}
      className="flex size-80 items-center justify-center rounded-btn border border-hairline bg-white p-2"
      aria-busy={!ready}
    />
  );
}

/** Draws a single checkpoint QR as SVG and offers browser Print + SVG Download. */
export function QrPrint({
  token,
  label,
  fileName,
}: {
  token: string;
  label: string;
  fileName?: string;
}) {
  const [svgMarkup, setSvgMarkup] = useState<string | null>(null);

  function downloadSvg() {
    if (!svgMarkup) return;
    const blob = new Blob([svgMarkup], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName ?? `${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.svg`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <QrSvg token={token} label={label} onReady={setSvgMarkup} />
      <div className="flex flex-wrap items-center justify-center gap-2 print:hidden">
        <Button onClick={() => window.print()}>
          <Printer aria-hidden="true" />
          Print this code
        </Button>
        <Button variant="outline" onClick={downloadSvg} disabled={!svgMarkup}>
          <Download aria-hidden="true" />
          Download SVG
        </Button>
      </div>
    </>
  );
}

/** Triggers browser printing for the multi-page Print All active posters sheet. */
export function PrintAllButton({ count }: { count: number }) {
  return (
    <Button onClick={() => window.print()}>
      <Printer aria-hidden="true" />
      Print all {count} {count === 1 ? "poster" : "posters"}
    </Button>
  );
}
