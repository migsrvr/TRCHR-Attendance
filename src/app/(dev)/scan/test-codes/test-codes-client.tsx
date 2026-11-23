"use client";

import { useEffect, useRef } from "react";

const CODES = [
  { token: "TR-IN", label: "IN", hint: "Time in" },
  { token: "TR-OUT", label: "OUT", hint: "Time out" },
] as const;

/** Draws the mock server's test codes as SVG QR codes. */
export function TestCodes() {
  const refs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    let cancelled = false;
    void import("@zxing/browser").then(({ BrowserQRCodeSvgWriter }) => {
      if (cancelled) return;
      const writer = new BrowserQRCodeSvgWriter();
      CODES.forEach((code, index) => {
        const svg = writer.write(code.token, 260, 260);
        svg.setAttribute("role", "img");
        svg.setAttribute("aria-label", `Test QR code for ${code.hint}`);
        refs.current[index]?.replaceChildren(svg);
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      {CODES.map((code, index) => (
        <section key={code.token} className="flex flex-col items-center gap-3 rounded-card border border-border bg-card p-6 shadow-card">
          <p className="font-heading text-4xl font-bold text-primary">{code.label}</p>
          <div
            ref={(element) => {
              refs.current[index] = element;
            }}
            className="flex size-[260px] items-center justify-center bg-white"
          />
          <p className="font-mono text-sm text-muted-foreground">{code.token}</p>
        </section>
      ))}
    </div>
  );
}
