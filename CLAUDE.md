# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Comercia Web is a Next.js point-of-sale (POS) application migrated from .NET MAUI Blazor Hybrid. All UI text is in Spanish (es-ES culture). Backend is Supabase (PostgreSQL via @supabase/supabase-js client).

## Build & Run Commands

```bash
npm run dev        # Dev server (http://localhost:3000)
npm run build      # Production build
npm run start      # Start production server
npm run lint       # ESLint
```

No test projects exist.

## Architecture

**Next.js 16 App Router** with TypeScript, shadcn/ui + Tailwind CSS, Zustand for state.

### Key Patterns
- **API Routes** (`src/app/api/*`) - all backend access goes through Next.js API routes; frontend never talks directly to Supabase
- **Supabase server client** (`src/lib/supabase-server.ts`) - lazy singleton using `NEXT_PUBLIC_SUPABASE_ANON_KEY` for API route queries (the only Supabase client; the frontend never talks to Supabase directly — login goes through `/api/auth/login`)
- **Custom JWT auth** (`src/app/api/auth/*`) - `jose` + `bcryptjs` with `SistemaUsuario` table; no Supabase Auth
- **Service layer** (`src/services/`) - mirrors C# service pattern with master-detail CRUD (diff-based saves for Documento+DocumentoItem and Cliente+ClienteDireccion)
- **Zustand store** (`src/stores/app-store.ts`) - replaces MAUI RefreshService, holds basket state and filter state
- **shadcn/ui with Base UI** - latest shadcn uses Base UI, NOT Radix. **Do NOT use `asChild` prop** on any component (SheetTrigger, DropdownMenuTrigger, etc.)
- **Save buttons MUST use `useGuardar`** (`src/hooks/use-guardar.ts`) - wraps the async save with a re-entry guard (anti double-submit) and exposes `saving` for `disabled`/label. Never hand-roll a `useState` saving flag.
- **Master-detail writes are transactional via Postgres RPCs** (e.g. `guardar_venta_con_items`, `guardar_cliente_con_direcciones`, `guardar_producto_con_kardex`) - PostgREST can't span transactions across calls, so multi-table saves go in a plpgsql function; API routes stay thin (auth + validation + `.rpc()`)
- **Entity naming**: PascalCase matching Supabase column names (e.g., `IdCliente`, `bCredito`)
- **DRY / reuse first**: do NOT duplicate near-identical logic. Factor shared behavior into a single generic function/method/component and pass what varies as parameters (e.g. `fetchMetodosPago(tenantId, flags)` backs both the selectable list and the deuda lookup). Identify domain concepts by semantic flags/columns (`bEfectivo`, `bDeuda`), never by display text (`Nombre`), which is renameable. Write the minimum code needed; prefer extending an existing helper over adding a parallel one.

### Directory Structure
- `src/app/` - Next.js App Router pages
- `src/components/` - Reusable components (layout, ventas, deuda, cliente, shared)
- `src/services/` - Supabase service functions
- `src/stores/` - Zustand stores
- `src/types/` - TypeScript interfaces
- `src/lib/` - Utilities (supabase client, supabase-server, api-client, jwt, password, format, date-utils, bluetooth-printer)
- `src/hooks/` - Custom React hooks

### Domain
- **Documento** with DocumentoItem. `IdTipoDocumento`:
  - `1` = Venta (sale; `bCredito=true` + `Saldo>0` = debt)
  - `2` = Abono (payment to a debt; item references the sale → trigger lowers its `Saldo`)
  - `3` = Gasto (expense)
  - `4` = Saldo a favor (customer credit/anticipo capture; `Saldo` = credit available)
  - `5` = Ajuste/Baja (inventory adjustment / loss — kardex)
  - `6` = Abono con saldo a favor (consumes credit to pay a debt; no cash, not income)
- **Cliente** with ClienteDireccion (master-detail save)
- **Producto** - simple CRUD with Kardex (ProductoMovimiento)
- **MetodoPago** - read-only reference
- **Negocio** - business configuration (single row)
- **Caja** - cash register control (required for sales/payments)
- **SistemaUsuario** / **SistemaPerfil** - auth and role management
- Debt tracking: bCredito=true + Saldo > 0

### Environment Variables
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anon key (used for frontend login and API routes)
- `JWT_SECRET_KEY` - Secret for signing custom JWT tokens (generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)