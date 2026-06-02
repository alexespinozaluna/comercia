import { nowIso } from "./format";

/**
 * Helpers de auditoría — inyectan los campos IdUsuarioCreacion /
 * IdUsuarioModificacion / FechaModificacion en payloads que se mandan a
 * `.insert()` / `.update()` o a RPCs (vía JSON).
 *
 * FechaCreacion la pone el DEFAULT now() de la columna, no se setea aquí.
 *
 * Convención: el caller pasa el id del usuario actor (normalmente `user.id`
 * desde `getCurrentUserFromRequest`); el helper se encarga del resto.
 */

export function auditCreate<T extends object>(idUsuario: number, payload: T) {
  return { ...payload, IdUsuarioCreacion: idUsuario };
}

export function auditUpdate<T extends object>(idUsuario: number, patch: T) {
  return {
    ...patch,
    IdUsuarioModificacion: idUsuario,
    FechaModificacion: nowIso(),
  };
}
