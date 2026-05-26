// Layout para páginas públicas (compartidas sin login). El AppShell se omite
// para estas rutas mediante un guard en src/components/layout/app-shell.tsx.
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-page-bg">{children}</div>;
}
