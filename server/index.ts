import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

import app from "../src/server/app.js";

const port = Number(process.env.PORT ?? 3001);
const isProduction = process.env.NODE_ENV === "production";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDistPath = path.resolve(__dirname, "../dist");

if (isProduction) {
  app.use(express.static(clientDistPath));
  app.get("*", (_request, response) => {
    response.sendFile(path.join(clientDistPath, "index.html"));
  });
}

app.listen(port, () => {
  console.log(`TimeSmith server listening on port ${port}`);
});
