"use client";

import { useState, useEffect } from "react";
import { DocumentoAudit, DocumentoItemAudit } from "@/types/database";
import { apiGet } from "@/lib/api-client";
import { AuthUser, getCurrentUser } from "@/lib/auth-client";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Search, FileText, Clock, User, ArrowLeftRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

const OPERACIONES = ["INSERT", "UPDATE", "DELETE"];
const ALLOWED_ROLES = ["ADMIN", "SUPERVISOR"];

function diffBadgeColor(op: string) {
  switch (op) {
    case "INSERT": return "bg-emerald-50 text-emerald-600 border-emerald-200";
    case "UPDATE": return "bg-sky-50 text-sky-600 border-sky-200";
    case "DELETE": return "bg-red-50 text-red-600 border-red-200";
    default: return "bg-muted text-muted-foreground";
  }
}

function DiffView({ oldData, newData }: { oldData: Record<string, unknown> | null; newData: Record<string, unknown> | null }) {
  const keys = new Set([...Object.keys(oldData ?? {}), ...Object.keys(newData ?? {})]);
  const changes: { key: string; old: string; neu: string }[] = [];
  for (const key of keys) {
    const o = oldData?.[key] ?? "";
    const n = newData?.[key] ?? "";
    if (o !== n) {
      changes.push({ key, old: String(o), neu: String(n) });
    }
  }
  if (changes.length === 0) return null;
  return (
    <div className="mt-2 space-y-1 text-xs">
      {changes.map((c) => (
        <div key={c.key} className="flex items-start gap-2">
          <span className="font-medium text-muted-foreground min-w-[80px]">{c.key}:</span>
          <span className="text-red-600 line-through">{c.old || "null"}</span>
          <ArrowLeftRight className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />
          <span className="text-emerald-600">{c.neu || "null"}</span>
        </div>
      ))}
    </div>
  );
}

export default function AuditoriaPage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [docs, setDocs] = useState<DocumentoAudit[]>([]);
  const [items, setItems] = useState<DocumentoItemAudit[]>([]);
  const [tab, setTab] = useState<"doc" | "item">("doc");
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [operacion, setOperacion] = useState("");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    getCurrentUser().then((u) => {
      setUser(u);
      if (!u || !ALLOWED_ROLES.includes(u.rol)) {
        setLoading(false);
      }
    });
  }, []);

  useEffect(() => {
    if (!user || !ALLOWED_ROLES.includes(user.rol)) return;
    async function load() {
      try {
        const params = new URLSearchParams();
        if (fechaInicio) params.set("fechaInicio", fechaInicio);
        if (fechaFin) params.set("fechaFin", fechaFin);
        if (operacion) params.set("operacion", operacion);
        const query = params.toString() ? `?${params.toString()}` : "";
        const [d, i] = await Promise.all([
          apiGet<DocumentoAudit[]>(`/api/auditoria/documentos${query}`),
          apiGet<DocumentoItemAudit[]>(`/api/auditoria/items${query}`),
        ]);
        setDocs(d);
        setItems(i);
      } catch (err) {
        console.error(err);
        toast.error("Error al cargar auditoria");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user, fechaInicio, fechaFin, operacion]);

  const filteredDocs = search
    ? docs.filter((d) =>
        d.Operacion.toLowerCase().includes(search.toLowerCase()) ||
        (d.UsuarioAudit?.toLowerCase() ?? "").includes(search.toLowerCase()) ||
        String(d.IdDocumento).includes(search)
      )
    : docs;

  const filteredItems = search
    ? items.filter((i) =>
        i.Operacion.toLowerCase().includes(search.toLowerCase()) ||
        (i.UsuarioAudit?.toLowerCase() ?? "").includes(search.toLowerCase()) ||
        String(i.IdDocumentoItem).includes(search)
      )
    : items;

  const data = tab === "doc" ? filteredDocs : filteredItems;

  // Access control (espejo del guard del API: ADMIN / SUPERVISOR)
  if (user && !ALLOWED_ROLES.includes(user.rol)) {
    return (
      <div className="max-w-lg">
        <EmptyState
          title="Acceso restringido"
          description="Solo administradores y supervisores pueden ver la auditoría."
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-2 max-w-3xl mx-auto">
      <div className="flex items-center gap-2">
        <FileText className="h-5 w-5 text-primary" />
        <h2 className="text-base font-semibold tracking-tight">Auditoria</h2>
      </div>

      {/* Filters */}
      <Card className="border-none ring-1 ring-border/60 shadow-sm">
        <CardContent className="p-3 space-y-3">
          <div className="flex flex-wrap gap-2">
            <div className="flex gap-2">
              <Input type="date" className="h-8 text-xs w-36" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} />
              <Input type="date" className="h-8 text-xs w-36" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} />
            </div>
            <div className="flex gap-1">
              {OPERACIONES.map((op) => (
                <Button
                  key={op}
                  variant={operacion === op ? "default" : "outline"}
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => setOperacion(operacion === op ? "" : op)}
                >
                  {op}
                </Button>
              ))}
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              className="pl-9 h-8 text-xs"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <div className="flex gap-2">
        <Button
          variant={tab === "doc" ? "default" : "outline"}
          size="sm"
          className="text-xs"
          onClick={() => setTab("doc")}
        >
          Documentos ({filteredDocs.length})
        </Button>
        <Button
          variant={tab === "item" ? "default" : "outline"}
          size="sm"
          className="text-xs"
          onClick={() => setTab("item")}
        >
          Items ({filteredItems.length})
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-xl border ring-1 ring-border/60 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="text-xs font-semibold">Fecha</TableHead>
              <TableHead className="text-xs font-semibold">Operacion</TableHead>
              <TableHead className="text-xs font-semibold">Usuario</TableHead>
              <TableHead className="text-xs font-semibold">ID</TableHead>
              <TableHead className="text-xs font-semibold">Cambios</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">
                  Sin registros
                </TableCell>
              </TableRow>
            )}
            {data.map((row) => (
              <TableRow key={row.id} className="hover:bg-accent/30">
                <TableCell className="text-xs whitespace-nowrap">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {format(new Date(row.FechaAudit), "dd/MM/yyyy HH:mm")}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={cn("text-[10px]", diffBadgeColor(row.Operacion))}>
                    {row.Operacion}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs">
                  <div className="flex items-center gap-1">
                    <User className="h-3 w-3 text-muted-foreground" />
                    {row.UsuarioAudit ?? "—"}
                  </div>
                </TableCell>
                <TableCell className="text-xs font-medium">
                  {tab === "doc" ? (row as DocumentoAudit).IdDocumento : (row as DocumentoItemAudit).IdDocumentoItem}
                </TableCell>
                <TableCell className="text-xs max-w-[300px]">
                  <DiffView oldData={row.DataOld} newData={row.DataNew} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
