const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? "").trim().replace(/\/$/, "");

function resolveRequestInput(input: RequestInfo) {
  if (typeof input !== "string") {
    return input;
  }

  if (!apiBaseUrl || /^https?:\/\//i.test(input)) {
    return input;
  }

  return `${apiBaseUrl}${input.startsWith("/") ? input : `/${input}`}`;
}

async function request<T>(input: RequestInfo, init?: RequestInit) {
  const isAllWorkspaces =
    typeof window !== "undefined" && window.localStorage.getItem("timesmith-all-workspaces") === "true";

  const response = await fetch(resolveRequestInput(input), {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(isAllWorkspaces ? { "x-timesmith-scope": "all" } : {}),
      ...init?.headers,
    },
    ...init,
  });

  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error ?? "Request failed.");
  }

  if (response.status === 204) {
    return null as T;
  }

  return (await response.json()) as T;
}

export { request };
export { resolveRequestInput };
