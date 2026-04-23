import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    https: {
      cert: fs.readFileSync(path.resolve(__dirname, "certs/timesmith.test.pem")),
      key: fs.readFileSync(path.resolve(__dirname, "certs/timesmith.test-key.pem")),
    },
    allowedHosts: [
      "medieval-solutions-limits-webshots.trycloudflare.com",
      "timesmith.test",
    ],
    proxy: {
    "/api": "http://localhost:3001",
  },
    },
    
  },
);
