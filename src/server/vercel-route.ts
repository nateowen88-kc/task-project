import type express from "express";

import { createBaseApp } from "./app.js";

function normalizeRequestUrl(request: express.Request, prefix: string) {
  const [pathname, query = ""] = request.url.split("?");
  const normalizedPrefix = prefix.startsWith("/") ? prefix : `/${prefix}`;
  const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`;

  if (normalizedPath === normalizedPrefix || normalizedPath.startsWith(`${normalizedPrefix}/`)) {
    return;
  }

  request.url = `${normalizedPrefix}${normalizedPath === "/" ? "" : normalizedPath}${query ? `?${query}` : ""}`;
}

export function createVercelRouterApp(
  prefix: string,
  mount: (app: express.Express) => void,
) {
  const app = createBaseApp();

  app.use((request, _response, next) => {
    normalizeRequestUrl(request, prefix);
    next();
  });

  mount(app);

  return app;
}
