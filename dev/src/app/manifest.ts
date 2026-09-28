import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AvniX GymOS",
    short_name: "GymOS",
    description: "Gym management that collects fees and keeps members — built for Indian gyms.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#f4f4f5",
    theme_color: "#16a34a",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
