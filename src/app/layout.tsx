import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Blade",
  description: "A first-person room lit entirely by screen-space global illumination, on WebGPU.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
