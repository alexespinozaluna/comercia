import { SignJWT, jwtVerify } from "jose";

const SECRET_KEY = new TextEncoder().encode(
  process.env.JWT_SECRET_KEY || (() => {
    throw new Error("JWT_SECRET_KEY environment variable is required. Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"");
  })()
);

export interface JWTPayload {
  sub: string; // user id
  codigo: string;
  nombre: string;
  rol: string;
  idTenant: number;
  idNegocio: number | null; // sucursal activa
  iat: number;
  exp: number;
}

// Access token de vida corta: el estado revocable vive en `SistemaSesion`
// (refresh token), no en el JWT. Al expirar, el cliente lo renueva vía
// /api/auth/refresh. Ver docs/propuesta-sesiones-en-bd-refresh-tokens.md.
export async function createToken(
  payload: Omit<JWTPayload, "iat" | "exp">,
  expiresIn: string = "45m",
): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(SECRET_KEY);
}

export async function verifyToken(token: string): Promise<JWTPayload> {
  const { payload } = await jwtVerify(token, SECRET_KEY, { clockTolerance: 60 });
  return payload as unknown as JWTPayload;
}