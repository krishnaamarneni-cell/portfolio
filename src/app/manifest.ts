import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Lucy",
    short_name: "Lucy",
    description:
      "Krishna's personal AI cockpit — notes, agents, briefings, social, chat.",
    start_url: "/admin",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#050505",
    theme_color: "#050505",
    icons: [
      {
        src: "/icon",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    // PWA shortcuts — long-press the home-screen icon (Android) to jump
    // straight to the most-used surfaces.
    shortcuts: [
      {
        name: "Add a note",
        short_name: "Note",
        url: "/admin?tab=personal",
      },
      {
        name: "Open chat",
        short_name: "Chat",
        url: "/admin?tab=chat",
      },
      {
        name: "Run agents",
        short_name: "Agents",
        url: "/admin?tab=agents",
      },
    ],
  };
}
