// Cliente HTTP del frontend. Todas las llamadas al backend pasan por aquí.
//
// Interceptor de 401: cuando el access token (JWT 45 min) vence, el backend
// responde 401. Disparamos UN refresh contra /api/auth/refresh (deduplicado
// entre requests paralelos) y, si renueva, reintentamos el request original
// una sola vez. Si el refresh falla, la sesión murió → vamos a /login.
// Ver docs/propuesta-sesiones-en-bd-refresh-tokens.md.

let refreshPromise: Promise<boolean> | null = null;

function refreshSession(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = fetch("/api/auth/refresh", {
      method: "POST",
      credentials: "same-origin",
    })
      .then((r) => r.ok)
      .catch(() => false)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

async function request(path: string, init: RequestInit): Promise<Response> {
  const opts: RequestInit = { credentials: "same-origin", ...init };
  const res = await fetch(path, opts);

  // No interceptar las propias rutas de auth (evita recursión en login/refresh).
  if (res.status !== 401 || path.startsWith("/api/auth/")) return res;

  const refreshed = await refreshSession();
  if (!refreshed) {
    // Sesión irrecuperable: redirigir al login (en navegador).
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
    return res;
  }
  return fetch(path, opts);
}

async function parseError(res: Response): Promise<never> {
  const err = await res.json().catch(() => ({}));
  throw new Error(err.error || `Error ${res.status}`);
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await request(path, {});
  if (!res.ok) await parseError(res);
  const data = await res.json();
  return data.data as T;
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await request(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) await parseError(res);
  const data = await res.json();
  return data.data as T;
}

export async function apiPut<T>(path: string, body: unknown): Promise<T> {
  const res = await request(path, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) await parseError(res);
  const data = await res.json();
  return data.data as T;
}

export async function apiDelete(path: string): Promise<void> {
  const res = await request(path, { method: "DELETE" });
  if (!res.ok) await parseError(res);
}
