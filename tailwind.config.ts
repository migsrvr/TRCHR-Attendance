import type { Config } from "tailwindcss";

/** A color backed by an RGB-channel CSS variable from globals.css. */
const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  future: {
    // Only apply hover styles on devices that can hover; stops "sticky" hover
    // colors after a tap on iPhone and Android.
    hoverOnlyWhenSupported: true,
  },
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/lib/**/*.{js,ts,jsx,tsx}",
    "./src/modules/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: token("background"),
        foreground: token("foreground"),
        card: token("card"),
        muted: { DEFAULT: token("muted"), foreground: token("muted-foreground") },
        border: token("border"),
        hairline: token("hairline"),
        ring: token("ring"),
        primary: { DEFAULT: token("primary"), foreground: token("primary-foreground") },
        secondary: { DEFAULT: token("secondary"), foreground: token("secondary-foreground") },
        accent: { DEFAULT: token("accent"), foreground: token("accent-foreground") },
        sidebar: {
          DEFAULT: token("sidebar"),
          foreground: token("sidebar-foreground"),
          accent: token("sidebar-accent"),
          border: token("sidebar-border"),
        },
        attn: { DEFAULT: token("attn"), bg: token("attn-bg") },
        pend: { DEFAULT: token("pend"), bg: token("pend-bg") },
        settled: token("settled"),
        negative: token("negative"),
        inactive: token("inactive"),
        track: token("track"),
        "schedule-band": token("schedule-band"),
        viewfinder: token("viewfinder"),
      },
      fontFamily: {
        sans: ["var(--font-sans)", "Open Sans", "ui-sans-serif", "system-ui", "sans-serif"],
        heading: ["var(--font-heading)", "Oswald", "Open Sans", "sans-serif"],
        mono: ["ui-monospace", "SF Mono", "Cascadia Code", "Menlo", "Consolas", "monospace"],
      },
      borderRadius: {
        chip: "4px",
        nav: "8px",
        btnsm: "10px",
        btn: "12px",
        card: "16px",
        panel: "20px",
      },
      boxShadow: {
        card: "0 1px 3px 0 rgba(0, 0, 0, 0.08)",
      },
      maxWidth: {
        content: "1280px",
      },
    },
  },
  plugins: [],
};

export default config;
