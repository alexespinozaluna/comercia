export interface AuthUser {
  id: number;
  codigo: string;
  nombre: string;
  rol: string;
  idTenant: number;
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    const res = await fetch("/api/auth/me", { credentials: "same-origin" });
    if (!res.ok) return null;
    const data = await res.json();
    return data.user as AuthUser;
  } catch {
    return null;
  }
}

export async function logout(): Promise<void> {
  await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
}
