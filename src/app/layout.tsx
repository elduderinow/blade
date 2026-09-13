import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Blade",
  description: "A first-person room lit entirely by screen-space global illumination, on WebGPU.",
};

/**
 * No pinch zoom and no rubber band: a double tap meant to throw twice should
 * not zoom the page, and dragging to look should not drag the page with it.
 *
 * `viewportFit: "cover"` is what makes the safe-area insets non-zero. Without
 * it iOS letterboxes the page away from the notch and every `env()` reads 0,
 * which is invisible in portrait and puts the pad under the notch as soon as
 * the phone is turned on its side.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#000000",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
