"use client";

import dynamic from "next/dynamic";

/**
 * The scene never renders on the server: it needs a GPU context, and the
 * whole three.js bundle is dead weight in the HTML response.
 */
const BladeScene = dynamic(() => import("@/components/BladeScene"), {
  ssr: false,
  loading: () => <div className="status">Loading the room…</div>,
});

export default function Home() {
  return (
    <main>
      <BladeScene />
    </main>
  );
}
