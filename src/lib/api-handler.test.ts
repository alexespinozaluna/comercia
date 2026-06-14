import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";
import type { APIUser } from "@/lib/api-auth";

// Mock de la autenticación: controlamos qué usuario "devuelve" la cookie.
const getCurrentUserFromRequest = vi.fn<() => Promise<APIUser | null>>();
vi.mock("@/lib/api-auth", () => ({
  getCurrentUserFromRequest: () => getCurrentUserFromRequest(),
}));

// Importar DESPUÉS del mock.
const { withAuth, ApiError } = await import("./api-handler");

const USER: APIUser = {
  id: 1,
  codigo: "admin",
  nombre: "Admin",
  rol: "ADMIN",
  idTenant: 1,
  idNegocio: 1,
};

// NextRequest mínimo: withAuth solo lee method y nextUrl.pathname en el catch.
const req = { method: "GET", nextUrl: { pathname: "/api/test" } } as unknown as NextRequest;
const noCtx = undefined as unknown as { params: Promise<Record<string, never>> };

beforeEach(() => getCurrentUserFromRequest.mockReset());

describe("withAuth", () => {
  it("401 cuando no hay usuario autenticado", async () => {
    getCurrentUserFromRequest.mockResolvedValue(null);
    const handler = withAuth(async () => new Response("ok") as never);
    const res = await handler(req, noCtx);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "No autenticado" });
  });

  it("403 cuando el rol no está en la lista permitida", async () => {
    getCurrentUserFromRequest.mockResolvedValue({ ...USER, rol: "VENDEDOR" });
    const handler = withAuth(async () => new Response("ok") as never, {
      roles: ["ADMIN", "SUPERVISOR"],
    });
    const res = await handler(req, noCtx);
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "No autorizado" });
  });

  it("pasa el usuario y los params resueltos al handler", async () => {
    getCurrentUserFromRequest.mockResolvedValue(USER);
    const ctx = { params: Promise.resolve({ id: "42" }) };
    const handler = withAuth<{ id: string }>(async (_r, { user, params }) => {
      return Response.json({ uid: user.id, id: params.id }) as never;
    });
    const res = await handler(req, ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ uid: 1, id: "42" });
  });

  it("ApiError respeta su status y mensaje", async () => {
    getCurrentUserFromRequest.mockResolvedValue(USER);
    const handler = withAuth(async () => {
      throw new ApiError(404, "No encontrado");
    });
    const res = await handler(req, noCtx);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "No encontrado" });
  });

  it("error genérico → 500 'Error interno' (no filtra el mensaje)", async () => {
    getCurrentUserFromRequest.mockResolvedValue(USER);
    const handler = withAuth(async () => {
      throw new Error("detalle interno de la BD");
    });
    const res = await handler(req, noCtx);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Error interno" });
  });

  it("exposeErrors → 400 con el mensaje del Error", async () => {
    getCurrentUserFromRequest.mockResolvedValue(USER);
    const handler = withAuth(
      async () => {
        throw new Error("El monto es mayor a la deuda");
      },
      { exposeErrors: true },
    );
    const res = await handler(req, noCtx);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "El monto es mayor a la deuda" });
  });

  it("rol permitido ejecuta el handler normalmente", async () => {
    getCurrentUserFromRequest.mockResolvedValue(USER);
    const handler = withAuth(async () => Response.json({ ok: true }) as never, {
      roles: ["ADMIN"],
    });
    const res = await handler(req, noCtx);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});

describe("withAuth — rol de solo lectura (SUPERVISOR)", () => {
  const SUPERVISOR: APIUser = { ...USER, rol: "SUPERVISOR" };
  const reqM = (method: string) =>
    ({ method, nextUrl: { pathname: "/api/test" } }) as unknown as NextRequest;
  const okHandler = async () => Response.json({ ok: true }) as never;

  beforeEach(() => getCurrentUserFromRequest.mockResolvedValue(SUPERVISOR));

  it("permite GET (lectura)", async () => {
    const res = await withAuth(okHandler, { roles: ["ADMIN", "SUPERVISOR"] })(reqM("GET"), noCtx);
    expect(res.status).toBe(200);
  });

  it.each(["POST", "PUT", "PATCH", "DELETE"])("bloquea %s con 403 solo lectura", async (method) => {
    const res = await withAuth(okHandler, { roles: ["ADMIN", "SUPERVISOR"] })(reqM(method), noCtx);
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Tu rol es de solo lectura" });
  });

  it("allowReadOnly permite la mutación (autoservicio: sesiones, sucursal)", async () => {
    const res = await withAuth(okHandler, {
      roles: ["ADMIN", "SUPERVISOR"],
      allowReadOnly: true,
    })(reqM("POST"), noCtx);
    expect(res.status).toBe(200);
  });

  it("a un rol que NO es de solo lectura no le afecta el bloqueo", async () => {
    getCurrentUserFromRequest.mockResolvedValue({ ...USER, rol: "CAJERO" });
    const res = await withAuth(okHandler, { roles: ["CAJERO"] })(reqM("POST"), noCtx);
    expect(res.status).toBe(200);
  });
});
