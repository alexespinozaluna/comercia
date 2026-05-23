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
- **Supabase server client** (`src/lib/supabase-server.ts`) - lazy singleton using `NEXT_PUBLIC_SUPABASE_ANON_KEY` for API route queries
- **Supabase client** (`src/lib/supabase.ts`) - anon key for frontend auth (login only)
- **Custom JWT auth** (`src/app/api/auth/*`) - `jose` + `bcryptjs` with `SistemaUsuario` table; no Supabase Auth
- **Service layer** (`src/services/`) - mirrors C# service pattern with master-detail CRUD (diff-based saves for Documento+DocumentoItem and Cliente+ClienteDireccion)
- **Zustand store** (`src/stores/app-store.ts`) - replaces MAUI RefreshService, holds basket state and filter state
- **shadcn/ui with Base UI** - latest shadcn uses Base UI, NOT Radix. **Do NOT use `asChild` prop** on any component (SheetTrigger, DropdownMenuTrigger, etc.)
- **Entity naming**: PascalCase matching Supabase column names (e.g., `IdCliente`, `bCredito`)

### Directory Structure
- `src/app/` - Next.js App Router pages
- `src/components/` - Reusable components (layout, ventas, deuda, cliente, shared)
- `src/services/` - Supabase service functions
- `src/stores/` - Zustand stores
- `src/types/` - TypeScript interfaces
- `src/lib/` - Utilities (supabase client, supabase-server, api-client, jwt, password, format, date-utils, bluetooth-printer)
- `src/hooks/` - Custom React hooks

### Domain
- **Documento** (IdTipoDocumento: 1=sale, 2=payment, 3=expense) with DocumentoItem
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