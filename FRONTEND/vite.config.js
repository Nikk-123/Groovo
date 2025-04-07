import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    proxy: {
      "/api": {
        target: "https://spotify-3-0-es19.onrender.com",
        changeOrigin: true,
        secure: true,
        configure: (proxy, _options) => {
          proxy.on("error", (err, _req, _res) => {
            console.log("Proxy error:", err);
          });
          proxy.on("proxyReq", (proxyReq, req, _res) => {
            console.log("Sending Request:", req.method, req.url);
          });
          proxy.on("proxyRes", (proxyRes, req, _res) => {
            console.log("Received Response:", proxyRes.statusCode, req.url);
          });
        },
      },
      "/login": {
        target: "https://spotify-3-0-es19.onrender.com",
        changeOrigin: true,
        secure: true,
      },
      "/signup": {
        target: "https://spotify-3-0-es19.onrender.com",
        changeOrigin: true,
        secure: true,
      },
      "/logout": {
        target: "https://spotify-3-0-es19.onrender.com",
        changeOrigin: true,
        secure: true,
      },
      "/search": {
        target: "https://spotify-3-0-es19.onrender.com",
        changeOrigin: true,
        secure: true,
      },
      "/play": {
        target: "https://spotify-3-0-es19.onrender.com",
        changeOrigin: true,
        secure: true,
      },
      "/library": {
        target: "https://spotify-3-0-es19.onrender.com",
        changeOrigin: true,
        secure: true,
      },
      "/static": {
        target: "https://spotify-3-0-es19.onrender.com",
        changeOrigin: true,
        secure: true,
      },
    },
    historyApiFallback: {
      index: "/index.html",
    },
  },
});
