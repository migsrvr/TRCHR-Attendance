"use client";

import { Printer } from "lucide-react";
import { useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";

/** Draws the code as SVG (crisp at any print size) and offers the browser's print dialog. */
export function QrPrint({ token, label }: { token: string; label: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    void import("@zxing/browser").then(({ BrowserQRCodeSvgWriter }) => {
      if (cancelled || !ref.current) return;
      const svg = new BrowserQRCodeSvgWriter().write(token, 320, 320);
      svg.setAttribute("role", "img");
      svg.setAttribute("aria-label", `QR code for ${label}`);
      ref.current.replaceChildren(svg);
    });
    return () => {
      cancelled = true;
    };
  }, [token, label]);

  return (
    <>
      <div ref={ref} className="flex size-80 items-center justify-center bg-white" aria-busy="true" />
      <Button onClick={() => window.print()} className="print:hidden">
        <Printer aria-hidden="true" />
        Print this code
      </Button>
    </>
  );
}
