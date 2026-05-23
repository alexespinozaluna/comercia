# Propuesta de Refactorización — Sistema POS / Ventas / Créditos MultiTenant

## 1. Objetivo

Transformar la aplicación actual en una plataforma POS moderna, escalable y multiempresa (multitenant), utilizando Next.js como base principal de desarrollo y enfocada en:

- Ventas contado y crédito
- Clientes con múltiples direcciones
- Control de pagos
- Control de deudas
- Seguridad y autenticación
- Roles y permisos
- Arquitectura mantenible
- Escalabilidad futura
- Auditoría y trazabilidad

---

# 2. Problemas Detectados en la Arquitectura Actual

## 2.1 Acceso directo a Supabase desde frontend

Actualmente el frontend accede directamente a Supabase usando anon key.

Problemas:

- Exposición de estructura de BD
- Riesgo de manipulación de datos
- Difícil aplicar seguridad real
- No existe validación centralizada
- Lógica duplicada en frontend
- Difícil auditoría
- Difícil escalar a multitenant

## 2.2 Lógica de negocio mezclada con UI

Ejemplos:

- Cálculo de saldos
- Validación de crédito
- Distribución de abonos
- Reglas de negocio
- Control de stock

Todo está dentro del frontend.

Problemas:

- Difícil mantenimiento
- Difícil testing
- Bugs frecuentes
- Duplicación de reglas

## 2.3 No existe capa de seguridad

Actualmente:

- No hay autenticación robusta
- No hay autorización
- No hay roles
- No hay auditoría
- No hay sesiones controladas

## 2.4 No existe multitenancy

La estructura actual no permite:

- múltiples negocios
- múltiples tiendas
- separación de información
- administración por empresa

---

# 3. Nueva Arquitectura Propuesta

## 3.1 Arquitectura General

```text
Frontend (Next.js)
        ↓
API Backend (Next.js API Routes / Server Actions)
        ↓
Capa Application
        ↓
Capa Domain
        ↓
Capa Infrastructure
        ↓
PostgreSQL
```

---

# 4. Stack Tecnológico Recomendado

La estrategia propuesta prioriza:

- Mantener el stack actual
- Refactorizar progresivamente
- No romper el flujo operativo
- Evitar sobreingeniería
- Maximizar velocidad de entrega
- Aprovechar Next.js como plataforma fullstack

| Capa | Tecnología |
|---|---|
| Frontend | Next.js 16 + TypeScript |
| UI | Tailwind + shadcn/ui |
| Backend | Next.js API Routes / Server Actions |
| ORM | Prisma ORM |
| DB | PostgreSQL |
| Auth | JWT + Refresh Token |
| Estado | Zustand |
| Validación | Zod |
| Cache | PostgreSQL + índices optimizados |
| Logs | Pino |
| Deploy | Vercel |
| Storage | Supabase Storage / S3 |

---

# 5. Arquitectura por Capas

## 5.1 Frontend

Responsabilidades:

- Render UI
- Formularios
- Navegación
- Estado visual
- Validaciones simples
- Consumo API

NO debe:

- Calcular deuda real
- Actualizar stock
- Validar permisos críticos
- Aplicar reglas financieras

---

## 5.2 Backend API

Responsabilidades:

- Seguridad
- Autenticación
- Roles
- Validación
- Reglas de negocio
- Auditoría
- Multitenancy
- Transacciones
- Integridad

---

## 5.3 Domain Layer

Aquí viven:

- VentaService
- PagoService
- DeudaService
- CajaService
- ClienteService

Toda la lógica crítica debe estar aquí.

---

## 5.4 Infrastructure Layer

Responsable de:

- Repositorios
- PostgreSQL
- Storage
- Integraciones
- Adaptadores externos

---

# 6. Arquitectura MultiTenant

## 6.1 Estrategia Recomendada

### Shared Database + TenantId

Todas las tablas tendrán:

```sql
IdTenant BIGINT NOT NULL
```

Ventajas:

- Más económico
- Escalable
- Simple de administrar
- Ideal para SaaS

---

# 7. Nuevas Tablas Base

## 7.1 SistemaTenant

```sql
CREATE TABLE SistemaTenant(
    Id BIGSERIAL PRIMARY KEY,
    Codigo VARCHAR(50) NOT NULL,
    Nombre VARCHAR(200) NOT NULL,
    Estado SMALLINT NOT NULL DEFAULT 1,
    FechaCreacion TIMESTAMP NOT NULL DEFAULT NOW()
);
```

---

## 7.2 SistemaUsuario

```sql
CREATE TABLE SistemaUsuario(
    Id BIGSERIAL PRIMARY KEY,
    IdTenant BIGINT NOT NULL,
    Codigo VARCHAR(50) NOT NULL,
    Nombre VARCHAR(200) NOT NULL,
    PasswordHash VARCHAR(500) NOT NULL,
    Rol VARCHAR(50) NOT NULL,
    Estado SMALLINT NOT NULL DEFAULT 1,
    FechaCreacion TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT FK_SistemaUsuario_Tenant
    FOREIGN KEY(IdTenant)
    REFERENCES SistemaTenant(Id)
);
```

---

# 8. Roles del Sistema

## 8.1 Roles Iniciales

| Rol | Acceso |
|---|---|
| ADMIN | Acceso total |
| CAJERO | Ventas y pagos |
| VENDEDOR | Ventas solamente |
| COBRANZA | Gestión de deudas |
| SUPERVISOR | Reportes y auditoría |

---

# 9. Seguridad Propuesta

## 9.1 Autenticación JWT

Flujo:

```text
Login
  ↓
Valida usuario
  ↓
Genera JWT
  ↓
Frontend almacena token
  ↓
Cada request envía Bearer Token
```

---

## 9.2 Password Hash

NO guardar passwords planos.

Usar:

```text
bcrypt
argon2
```

---

## 9.3 Middleware de Seguridad

Cada request:

1. Valida JWT
2. Obtiene usuario
3. Obtiene tenant
4. Obtiene roles
5. Valida permisos

---

# 10. Restricciones por Roles

El usuario indicó:

> No utilizar políticas de base de datos.

Por tanto:

- NO usar RLS de PostgreSQL
- NO usar policies de Supabase
- Todo se validará desde backend

Ejemplo:

```ts
if(usuario.rol !== 'ADMIN') {
   throw new ForbiddenException();
}
```

---

# 11. Refactorización de Base de Datos

## 11.1 Tabla Cliente

```sql
CREATE TABLE Cliente(
    Id BIGSERIAL PRIMARY KEY,
    IdTenant BIGINT NOT NULL,

    Codigo VARCHAR(50),
    Nombre VARCHAR(200) NOT NULL,
    Telefono VARCHAR(50),

    TipoDocumento VARCHAR(20),
    NroDocumento VARCHAR(50),

    LimiteCredito NUMERIC(18,2) DEFAULT 0,

    Estado SMALLINT DEFAULT 1,

    FechaCreacion TIMESTAMP DEFAULT NOW()
);
```

---

## 11.2 ClienteDireccion

```sql
CREATE TABLE ClienteDireccion(
    Id BIGSERIAL PRIMARY KEY,
    IdTenant BIGINT NOT NULL,
    IdCliente BIGINT NOT NULL,

    Direccion TEXT NOT NULL,
    Referencia TEXT,
    Contacto VARCHAR(200),
    Telefono VARCHAR(50),

    Latitud NUMERIC(10,6),
    Longitud NUMERIC(10,6),

    EsPrincipal BOOLEAN DEFAULT FALSE,

    FechaCreacion TIMESTAMP DEFAULT NOW()
);
```

---

## 11.3 Documento

Separar tipo de operación.

### Propuesta:

```sql
TipoDocumento

1 = Venta
2 = Pago
3 = Gasto
4 = NotaCredito
5 = Ajuste
```

---

## 11.4 Documento

```sql
CREATE TABLE Documento(
    Id BIGSERIAL PRIMARY KEY,
    IdTenant BIGINT NOT NULL,

    TipoDocumento SMALLINT NOT NULL,

    Serie VARCHAR(20),
    Numero VARCHAR(20),

    FechaEmision TIMESTAMP NOT NULL,

    IdCliente BIGINT,
    IdClienteDireccion BIGINT,

    Estado SMALLINT NOT NULL,

    CondicionPago SMALLINT NOT NULL,
    -- 1 contado
    -- 2 credito

    SubTotal NUMERIC(18,2),
    Descuento NUMERIC(18,2),
    Total NUMERIC(18,2),
    TotalPagado NUMERIC(18,2),
    Saldo NUMERIC(18,2),

    Observacion TEXT,

    IdUsuarioCreacion BIGINT,

    FechaCreacion TIMESTAMP DEFAULT NOW()
);
```

---

## 11.5 Estrategia Temporal de Pagos

Actualmente los pagos y ventas comparten lógica dentro del mismo flujo documental.

La propuesta NO es separar pagos inmediatamente.

Se recomienda:

- Mantener la estructura actual
- Mantener triggers existentes
- Mejorar validaciones
- Mejorar auditoría
- Centralizar reglas desde backend

La separación completa de pagos podrá realizarse en una segunda etapa cuando:

- Exista mayor volumen operativo
- Se requiera auditoría financiera avanzada
- Existan conciliaciones complejas
- Se integren múltiples cajas o bancos

Por ahora el objetivo principal es estabilizar y profesionalizar el sistema sin romper el flujo operativo actual.

---

# 12. Formas de Pago

## 12.1 Catálogo

```sql
CREATE TABLE FormaPago(
    Id SMALLSERIAL PRIMARY KEY,
    Nombre VARCHAR(50)
);
```

Datos iniciales:

| Id | Nombre |
|---|---|
| 1 | EFECTIVO |
| 2 | TRANSFERENCIA |
| 3 | YAPE |
| 4 | QR |
| 5 | TARJETA |

---

# 13. Control de Caja

## 13.1 Caja

```sql
CREATE TABLE Caja(
    Id BIGSERIAL PRIMARY KEY,
    IdTenant BIGINT NOT NULL,

    FechaApertura TIMESTAMP,
    FechaCierre TIMESTAMP,

    MontoInicial NUMERIC(18,2),
    MontoFinal NUMERIC(18,2),

    Estado SMALLINT,

    IdUsuarioApertura BIGINT,
    IdUsuarioCierre BIGINT
);
```

---

# 14. Auditoría

## 14.1 Tabla Auditoria

```sql
CREATE TABLE SistemaAuditoria(
    Id BIGSERIAL PRIMARY KEY,

    IdTenant BIGINT,
    IdUsuario BIGINT,

    Tabla VARCHAR(100),
    Accion VARCHAR(20),

    IdRegistro BIGINT,

    DatosAntes JSONB,
    DatosDespues JSONB,

    Fecha TIMESTAMP DEFAULT NOW()
);
```

Registrar:

- INSERT
- UPDATE
- DELETE
- LOGIN
- LOGOUT
- ANULACIONES

---

# 15. Control de Stock

## 15.1 Kardex

Actualmente el stock es solo un número.

Problema:

- No hay trazabilidad
- No hay movimientos
- No hay historial

## Propuesta

```sql
CREATE TABLE ProductoMovimiento(
    Id BIGSERIAL PRIMARY KEY,

    IdTenant BIGINT,
    IdProducto BIGINT,

    TipoMovimiento SMALLINT,

    Cantidad NUMERIC(18,2),

    StockAnterior NUMERIC(18,2),
    StockNuevo NUMERIC(18,2),

    IdDocumento BIGINT,

    Fecha TIMESTAMP DEFAULT NOW()
);
```

---

# 16. Arquitectura Frontend Recomendada

## 16.1 Estructura

```text
src/
 ├── app/
 ├── components/
 ├── modules/
 │    ├── venta/
 │    ├── cliente/
 │    ├── deuda/
 │    ├── caja/
 │    └── seguridad/
 ├── services/
 ├── stores/
 ├── hooks/
 ├── lib/
 ├── types/
 └── utils/
```

---

# 17. Separación por Módulos

## 17.1 Módulo Seguridad

Debe contener:

- Login
- Logout
- Sesiones
- Roles
- Permisos
- Refresh token
- Recuperar password

---

## 17.2 Módulo Ventas

Debe contener:

- POS
- Carrito
- Cotización
- Venta
- Ticket
- Historial

---

## 17.3 Módulo Créditos

Debe contener:

- Estado de cuenta
- Calendario de pagos
- Mora
- Abonos
- Historial

---

# 18. Refactorización del Algoritmo de Deudas

Actualmente:

- Documento mezcla venta y pagos

Problema:

- Difícil trazabilidad
- Difícil conciliación
- Difícil auditoría

## Nueva propuesta

### Venta

Genera:

```text
Documento Venta
```

### Pago

Genera:

```text
DocumentoPago
```

### Estado de deuda

Se calcula:

```sql
Saldo = TotalVenta - SUM(Pagos)
```

Ventajas:

- Más limpio
- Más seguro
- Más auditable

---

# 19. Permisos por Backend

NO usar restricciones SQL.

La seguridad irá:

```text
JWT
→ Middleware
→ Guard
→ Roles
→ Servicios
```

Ejemplo:

```ts
@Roles('ADMIN')
@Delete(':id')
async delete() {}
```

---

# 20. Arquitectura API Recomendada

## 20.1 Endpoints

```text
POST   /auth/login
POST   /auth/refresh
POST   /auth/logout

GET    /clientes
POST   /clientes
PUT    /clientes/:id
DELETE /clientes/:id

GET    /ventas
POST   /ventas
GET    /ventas/:id

POST   /pagos
GET    /deudas

GET    /productos
POST   /productos
```

---

# 21. Validaciones Importantes

## 21.1 Crédito

Validar:

- Cliente obligatorio
- Dirección obligatoria
- Límite de crédito
- Cliente activo

---

## 21.2 Pagos

Validar:

- No exceder saldo
- Documento activo
- Caja abierta

---

## 21.3 Eliminaciones

No eliminar físicamente.

Usar:

```text
Estado = 0
```

---

# 22. Funcionalidades Tipo Trenta Recomendadas

## 22.1 Dashboard Inteligente

- Ventas del día
- Deudas por cobrar
- Productos más vendidos
- Clientes frecuentes
- Caja actual

---

## 22.2 WhatsApp

- Compartir deuda
- Compartir ticket
- Recordatorio de pago

---

## 22.3 Cobranza

- Lista de clientes vencidos
- Alertas
- Mora automática

---

## 22.4 Reportes

- Ventas
- Utilidad
- Productos
- Clientes
- Caja
- Deudas

---

## 22.5 PWA y Modo Offline

La recomendación es construir una Progressive Web App (PWA) utilizando Next.js.

Ventajas:

- Instalación desde navegador
- Funciona en celular y desktop
- Mucho más económico que app nativa
- Reutiliza toda la lógica web
- Permite offline parcial
- Permite notificaciones push

Tecnologías recomendadas:

- IndexedDB
- Queue Sync
- Service Workers

---

# 23. Roadmap de Migración

## Fase 1

- Consolidar backend con Next.js API Routes y Server Actions
- Auth JWT
- Roles
- Usuarios
- API base

## Fase 2

- Refactor ventas
- Refactor pagos
- Refactor deuda
- Auditoría

## Fase 3

- Caja
- Reportes
- Dashboard avanzado

## Fase 4

- PWA
- Offline parcial
- WhatsApp
- Notificaciones push

---

# 24. Análisis de la Base de Datos Actual

Luego de revisar el esquema actual PostgreSQL se identificó que ya existe una buena base funcional.

## 24.1 Tablas Existentes

Actualmente el sistema ya cuenta con:

- Cliente
- ClienteDireccion
- Documento
- DocumentoItem
- DocumentoAudit
- DocumentoItemAudit
- Producto
- MetodoPago
- Negocio

Esto confirma que el sistema ya tiene:

- Gestión comercial operativa
- Manejo de clientes
- Direcciones múltiples
- Manejo documental
- Auditoría parcial
- Productos
- Formas de pago
- Multiempresa inicial

---

## 24.2 Hallazgos Positivos

### Ya existe lógica financiera implementada

Se detectaron:

- Triggers
- Procedures
- Funciones PL/pgSQL

Especialmente:

```sql
fn_actualizar_saldo_total_abono()
```

La lógica actual:

- Actualiza saldo automáticamente
- Calcula total de abonos
- Mantiene consistencia

Esto es importante porque:

- La lógica ya funciona
- El sistema ya está operativo
- No conviene romper el flujo actual
- La refactorización debe ser progresiva

---

## 24.3 Auditoría Existente

Ya existen:

- DocumentoAudit
- DocumentoItemAudit

Esto es una muy buena base.

La recomendación NO es reemplazarla.

La recomendación es:

- Estandarizar auditorías
- Agregar usuario autenticado
- Agregar IdTenant
- Agregar timestamps homogéneos

---

## 24.4 Problema Principal Detectado

El principal problema NO es la base de datos.

El principal problema es:

```text
La lógica crítica vive demasiado cerca del frontend.
```

Por tanto:

La prioridad real debe ser:

1. Centralizar lógica en backend Next.js
2. Implementar autenticación
3. Implementar roles
4. Implementar multitenant correctamente
5. Mejorar trazabilidad
6. Estandarizar validaciones

---

## 24.5 Estrategia Recomendada de Refactorización

NO hacer una reescritura completa.

La recomendación correcta es:

### Estrategia Incremental

```text
Sistema actual
   ↓
Agregar seguridad
   ↓
Agregar multitenant
   ↓
Mover lógica crítica al backend
   ↓
Refactorizar módulos progresivamente
```

Ventajas:

- No rompe operación
- Mantiene velocidad de desarrollo
- Menor riesgo
- Permite despliegues pequeños
- Mantiene compatibilidad

---

## 24.6 Cambios Prioritarios Reales

### PRIORIDAD ALTA

- SistemaUsuario
- JWT
- Roles
- Middleware seguridad
- IdTenant en tablas faltantes
- API centralizada
- Validaciones backend

### PRIORIDAD MEDIA

- Auditoría homogénea
- Optimización índices PostgreSQL
- PWA
- Dashboard
- Offline parcial

### PRIORIDAD BAJA

- Separación completa pagos
- Microservicios
- Event sourcing
- Arquitectura distribuida
- App móvil nativa

---

## 24.7 Recomendación sobre Triggers

Los triggers actuales sí tienen valor.

Especialmente:

- Actualización de saldo
- Actualización de abonos
- Auditoría

Por tanto:

NO eliminarlos inmediatamente.

La recomendación es:

- Mantenerlos
- Documentarlos
- Estandarizarlos
- Reducir complejidad progresivamente

---

## 24.8 Arquitectura Objetivo Realista

La arquitectura recomendada para este proyecto es:

```text
Next.js FullStack
  ├── App Router
  ├── Server Actions
  ├── API Routes
  ├── Middleware JWT
  ├── Prisma ORM
  ├── PostgreSQL
  └── PWA
```

Esto permite:

- Mantener simplicidad
- Tener backend real
- Mantener despliegue simple en Vercel
- Escalar correctamente
- Reducir costos operativos
- Mantener velocidad de desarrollo

---

# 25. Recomendación Final

La aplicación ya tiene una buena base funcional, pero necesita una refactorización importante para convertirse en un sistema profesional y escalable.

Los puntos más críticos a resolver son:

1. Centralizar lógica de negocio en Next.js Server Actions y API Routes
2. Implementar seguridad JWT
3. Implementar roles
4. Implementar multitenant
5. Agregar auditoría
6. Centralizar reglas de negocio
7. Implementar control de caja
8. Mejorar trazabilidad
9. Optimizar consultas e índices PostgreSQL
10. Mantener simplicidad operativa y velocidad de desarrollo

La arquitectura propuesta permitirá:

- Escalar a múltiples negocios
- Tener seguridad real
- Tener auditoría
- Mejorar mantenibilidad
- Soportar crecimiento futuro
- Convertirse en SaaS
- Tener una PWA instalable
- Integrar notificaciones
- Integrar facturación electrónica

