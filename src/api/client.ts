async function request<T>(input: RequestInfo, init?: RequestInit) {
  const isAllWorkspaces =
    typeof window !== "undefined" && window.localStorage.getItem("timesmith-all-workspaces") === "true";

  const response = await fetch(input, {
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
