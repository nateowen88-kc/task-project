import adminHandler from "../../src/server/native/admin-handler.js";
import authHandler from "../../src/server/native/auth-handler.js";
import { getPathname } from "../../src/server/native/http.js";

export default async function authEntry(request: Parameters<typeof authHandler>[0], response: Parameters<typeof authHandler>[1]) {
  const pathname = getPathname(request);

  if (pathname.startsWith("/api/admin")) {
    await adminHandler(request, response);
    return;
  }

  await authHandler(request, response);
}
