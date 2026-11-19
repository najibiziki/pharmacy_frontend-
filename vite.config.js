import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),

    VitePWA({
      registerType: "autoUpdate",

      manifest: {
        name: "Pharmacy Marrakech",
        short_name: "Pharmacy",
        description: "Find open pharmacies near you in Marrakech",
        start_url: "/",
        scope: "/",
        display: "standalone",
        theme_color: "#ffffff",
        background_color: "#ffffff",

        icons: [
          {
            src: "/icons/icon-192.jpeg",
            sizes: "192x192",
            type: "image/jpeg",
            purpose: "any",
          },
          {
            src: "/icons/icon-512.jpeg",
            sizes: "512x512",
            type: "image/jpeg",
            purpose: "any",
          },
        ],
      },
    }),
  ],

  server: {
    host: true,
    allowedHosts: true,
  },

  preview: {
    allowedHosts: true,
  },
});
