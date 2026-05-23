import type { Metadata } from "next";
import { Geist, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/layout/app-shell";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ErrorBoundary } from "@/components/shared/error-handler";
import { ConnectionStatus } from "@/components/shared/connection-status";
import { ThemeProvider } from "next-themes";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const jakartaSans = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Comercia - POS",
  description: "Sistema de punto de venta moderno. Ventas, crédito, contado, pagos, egresos e ingresos.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${jakartaSans.variable} ${geistSans.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <ConnectionStatus />
          <ErrorBoundary>
            <TooltipProvider>
              <AppShell>{children}</AppShell>
            </TooltipProvider>
          </ErrorBoundary>
          <Toaster position="bottom-left" richColors />
        </ThemeProvider>
      </body>
    </html>
  );
}