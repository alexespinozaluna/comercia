<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Documentar siempre en `docs/`

Toda propuesta, diseño, auditoría, plan de implementación o decisión técnica debe guardarse como `.md` en `docs/` sin que el usuario lo tenga que pedir.

- Nombre del archivo en kebab-case, descriptivo (`auditoria-tipografia-mobile.md`, `plan-implementacion-usuarios-multisucursal.md`).
- Cuando un documento se base en otro previo, enlazarlo al inicio (campo "Base:" o sección de referencias).
- Incluir siempre fecha (`Fecha: YYYY-MM-DD`), alcance y, si hay decisiones abiertas, una sección "Pendientes / próximas decisiones".
- No esperar a que el usuario confirme: ofrecer brevemente "lo guardo como `docs/<nombre>.md`" o guardar directamente y mencionar el path al final.
