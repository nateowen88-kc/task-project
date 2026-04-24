import type { IncomingMessage, ServerResponse } from "node:http";

export type NativeRequest = IncomingMessage & {
  method?: string;
  url?: string;
  headers: Record<string, string | string[] | undefined>;
};

export type NativeResponse = ServerResponse<IncomingMessage>;

export function getHeader(request: NativeRequest, name: string) {
  const value = request.headers[name.toLowerCase()];

  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

export function getUrl(request: NativeRequest) {
  const host = getHeader(request, "host") ?? "localhost";
  return new URL(request.url ?? "/", `https://${host}`);
}

export function getPathname(request: NativeRequest) {
  return getUrl(request).pathname;
}

export function getProtocol(request: NativeRequest) {
  return getHeader(request, "x-forwarded-proto") ?? "https";
}

export function getOrigin(request: NativeRequest) {
  return getHeader(request, "origin");
}

export function isAllowedBrowserOrigin(origin: string) {
  try {
    const url = new URL(origin);
    const hostname = url.hostname.toLowerCase();

    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return true;
    }

    if (hostname === "timesmithhq.com" || hostname === "www.timesmithhq.com") {
      return true;
    }

    if (hostname.endsWith(".timesmithhq.com") || hostname.endsWith(".vercel.app")) {
      return true;
    }

    if (hostname === "timesmith.test" || hostname === "storyminer.test") {
      return true;
    }
  } catch {
    return false;
  }

  return false;
}

export function rejectDisallowedBrowserOrigin(request: NativeRequest, response: NativeResponse) {
  const origin = getOrigin(request);

  if (!origin) {
    return false;
  }

  if (isAllowedBrowserOrigin(origin)) {
    return false;
  }

  sendJson(response, 403, { error: "Origin is not allowed." });
  return true;
}

export function matchPath(pathname: string, pattern: string) {
  const sourceParts = pathname.split("/").filter(Boolean);
  const patternParts = pattern.split("/").filter(Boolean);

  if (sourceParts.length !== patternParts.length) {
    return null;
  }

  const params: Record<string, string> = {};

  for (let index = 0; index < patternParts.length; index += 1) {
    const patternPart = patternParts[index]!;
    const sourcePart = sourceParts[index]!;

    if (patternPart.startsWith(":")) {
      params[patternPart.slice(1)] = decodeURIComponent(sourcePart);
      continue;
    }

    if (patternPart !== sourcePart) {
      return null;
    }
  }

  return params;
}

async function readBuffer(request: NativeRequest) {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}

export async function readJsonBody<T>(request: NativeRequest) {
  const buffer = await readBuffer(request);

  if (buffer.length === 0) {
    return null as T | null;
  }

  return JSON.parse(buffer.toString("utf8")) as T;
}

export function sendJson(response: NativeResponse, status: number, body: unknown, headers?: Record<string, string>) {
  const payload = JSON.stringify(body);
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");

  for (const [key, value] of Object.entries(headers ?? {})) {
    response.setHeader(key, value);
  }

  response.end(payload);
}

export function sendText(response: NativeResponse, status: number, body: string, headers?: Record<string, string>) {
  response.statusCode = status;
  response.setHeader("Content-Type", "text/plain; charset=utf-8");

  for (const [key, value] of Object.entries(headers ?? {})) {
    response.setHeader(key, value);
  }

  response.end(body);
}

export function sendEmpty(response: NativeResponse, status = 204, headers?: Record<string, string>) {
  response.statusCode = status;

  for (const [key, value] of Object.entries(headers ?? {})) {
    response.setHeader(key, value);
  }

  response.end();
}

export function notFound(response: NativeResponse) {
  sendJson(response, 404, { error: "Not found." });
}

export function methodNotAllowed(response: NativeResponse) {
  sendJson(response, 405, { error: "Method not allowed." });
}
