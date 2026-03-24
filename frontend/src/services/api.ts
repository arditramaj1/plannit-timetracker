import { clearStoredAuth, getStoredAuth, setStoredAuth } from "@/lib/auth-storage";
import { AuthPayload, User } from "@/lib/types";

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1").replace(
  /\/$/,
  "",
);

let refreshPromise: Promise<AuthPayload | null> | null = null;

function getUrl(path: string) {
  return `${API_BASE_URL}/${path.replace(/^\//, "")}`;
}

async function parseError(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const payload = (await response.json()) as Record<string, unknown>;
    if (typeof payload.detail === "string") {
      return payload.detail;
    }

    if (Array.isArray(payload.non_field_errors) && typeof payload.non_field_errors[0] === "string") {
      return payload.non_field_errors[0];
    }

    for (const value of Object.values(payload)) {
      if (Array.isArray(value) && typeof value[0] === "string") {
        return value[0];
      }
      if (typeof value === "string") {
        return value;
      }
    }
    return "The request could not be completed.";
  }
  return response.statusText || "Request failed.";
}

async function refreshTokens() {
  if (refreshPromise) {
    return refreshPromise;
  }

  const auth = getStoredAuth();
  if (!auth?.refresh) {
    return null;
  }

  refreshPromise = (async () => {
    const response = await fetch(getUrl("auth/token/refresh/"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ refresh: auth.refresh }),
    });

    if (!response.ok) {
      clearStoredAuth();
      return null;
    }

    const payload = (await response.json()) as { access: string; refresh?: string };
    const updatedAuth: AuthPayload = {
      ...auth,
      access: payload.access,
      refresh: payload.refresh ?? auth.refresh,
    };
    setStoredAuth(updatedAuth);
    return updatedAuth;
  })();

  const result = await refreshPromise;
  refreshPromise = null;
  return result;
}

export async function apiRequest<T>(path: string, init: RequestInit = {}, allowRefresh = true): Promise<T> {
  const auth = getStoredAuth();
  const headers = new Headers(init.headers);
  if (!(init.body instanceof FormData) && !headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }
  if (auth?.access && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${auth.access}`);
  }

  const response = await fetch(getUrl(path), {
    ...init,
    headers,
  });

  if (
    response.status === 401 &&
    allowRefresh &&
    auth?.refresh &&
    path !== "auth/token/" &&
    path !== "auth/token/refresh/"
  ) {
    const refreshed = await refreshTokens();
    if (refreshed) {
      return apiRequest<T>(path, init, false);
    }
  }

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return (await response.json()) as T;
  }
  return (await response.text()) as T;
}

export async function loginRequest(username: string, password: string) {
  const response = await fetch(getUrl("auth/token/"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ username, password }),
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  return (await response.json()) as AuthPayload;
}

export function logoutRequest() {
  clearStoredAuth();
}

export function getCurrentUser() {
  return apiRequest<User>("auth/me/");
}

export async function downloadAuthenticatedFile(path: string) {
  const auth = getStoredAuth();
  const headers = new Headers();
  if (auth?.access) {
    headers.set("Authorization", `Bearer ${auth.access}`);
  }

  let response = await fetch(getUrl(path), { headers });
  if (response.status === 401 && auth?.refresh) {
    const refreshed = await refreshTokens();
    if (refreshed) {
      headers.set("Authorization", `Bearer ${refreshed.access}`);
      response = await fetch(getUrl(path), { headers });
    }
  }

  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return response.blob();
}
