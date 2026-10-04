import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Shelf — Your Library",
    short_name: "Shelf",
    description: "A personal online library for reading across every device.",
    start_url: "/",
    display: "standalone",
    background_color: "#fbf7f0",
    theme_color: "#b1502e",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
