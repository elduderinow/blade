import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Blade",
  description: "A first-person room lit entirely by screen-space global illumination, on WebGPU.",
};

/**
 * No pinch zoom and no rubber band: a double tap meant to throw twice should
 * not zoom the page, and dragging to look should not drag the page with it.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#000000",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
