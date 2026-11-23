import type { Metadata, Viewport } from "next";
import { Open_Sans, Oswald } from "next/font/google";

import { MockModeProvider } from "@/components/shell/dev-mode-banner";
import { getMockModeReason, isMockModeEnabled } from "@/lib/auth/session";

import "./globals.css";

const openSans = Open_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const oswald = Oswald({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-heading",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Top Realty Attendance",
  description: "Intern attendance for Top Realty",
  appleWebApp: {
    capable: true,
    title: "TR Attendance",
    statusBarStyle: "default",
  },
  formatDetection: {
    // Stop iOS from turning times and numbers into tappable phone links.
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Lets the layout reach under the notch and home indicator; safe-area
  // utilities in globals.css pad content back out of those areas.
  viewportFit: "cover",
  themeColor: "#1A4175",
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const mock = isMockModeEnabled();
  const reason = getMockModeReason();
  return (
    <html lang="en" className={`${openSans.variable} ${oswald.variable}`}>
      <body>
        <MockModeProvider mock={mock} reason={reason}>
          {children}
        </MockModeProvider>
      </body>
    </html>
  );
}
