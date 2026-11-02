/** Cliente HTTP dos front-ends: access token em memória e refresh automático via cookie httpOnly (RNF04). */

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
    public details?: Record<string, string[] | undefined> & Record<string, unknown>,
  ) {
    super(message);
  }
}

export interface ApiClientOptions {
  baseUrl: string;
  refreshPath: string;
  /** Chamado quando o refresh falha (sessão expirada). */
  onUnauthorized?: () => void;
}

export function createApiClient({ baseUrl, refreshPath, onUnauthorized }: ApiClientOptions) {
  let accessToken: string | null = null;
  let refreshing: Promise<boolean> | null = null;

  async function raw(path: string, init: RequestInit = {}): Promise<Response> {
    const headers = new Headers(init.headers);
    if (init.body && !(init.body instanceof FormData)) headers.set("Content-Type", "application/json");
    if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
    return fetch(`${baseUrl}${path}`, { ...init, headers, credentials: "include" });
  }

  async function refresh(): Promise<boolean> {
    refreshing ??= raw(refreshPath, { method: "POST" })
      .then(async (res) => {
        if (!res.ok) {
          accessToken = null;
          return false;
        }
        const body = await res.json();
        accessToken = body.accessToken;
        listeners.forEach((l) => l(body));
        return true;
      })
      .catch(() => false)
      .finally(() => {
        refreshing = null;
      });
    return refreshing;
  }

  const listeners = new Set<(session: unknown) => void>();

  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    let res = await raw(path, init);
    if (res.status === 401 && accessToken !== null && path !== refreshPath) {
      if (await refresh()) res = await raw(path, init);
      else onUnauthorized?.();
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new ApiError(
        res.status,
        body?.error?.message ?? "Algo deu errado. Tente novamente.",
        body?.error?.code,
        body?.error?.details,
      );
    }
    if (res.status === 204) return undefined as T;
    const type = res.headers.get("Content-Type") ?? "";
    return (type.includes("application/json") ? res.json() : res.blob()) as Promise<T>;
  }

  const json = (method: string) => <T>(path: string, body?: unknown) =>
    request<T>(path, { method, body: body === undefined ? undefined : JSON.stringify(body) });

  return {
    request,
    get: <T>(path: string) => request<T>(path),
    post: json("POST"),
    put: json("PUT"),
    patch: json("PATCH"),
    del: json("DELETE"),
    refresh,
    setAccessToken: (token: string | null) => {
      accessToken = token;
    },
    onSessionRefreshed: (listener: (session: unknown) => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;

/** Dispara o download de um Blob (CSV, PDF, JSON). */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
