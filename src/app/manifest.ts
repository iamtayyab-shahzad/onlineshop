import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Grocery Shop",
    short_name: "Grocery",
    description: "Order your monthly groceries online. Delivered to your door.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#fbfdfb",
    theme_color: "#2f8a4c",
    // Lets the shop see that its own app is already installed on an Android phone (hides "Install our app").
    related_applications: [{ platform: "webapp", url: "/manifest.webmanifest" }],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
