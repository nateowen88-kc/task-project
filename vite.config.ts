import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const certPath = path.resolve(__dirname, "certs/timesmith.test.pem");
const keyPath = path.resolve(__dirname, "certs/timesmith.test-key.pem");
const hasLocalHttpsCerts = fs.existsSync(certPath) && fs.existsSync(keyPath);

export default defineConfig({
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    ...(hasLocalHttpsCerts
      ? {
          https: {
            cert: fs.readFileSync(certPath),
            key: fs.readFileSync(keyPath),
          },
        }
      : {}),
    allowedHosts: [
      "medieval-solutions-limits-webshots.trycloudflare.com",
      "timesmith.test",
    ],
    proxy: {
      "/api": "http://localhost:3001",
    },
  },
});
