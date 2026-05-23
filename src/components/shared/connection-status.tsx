"use client";

import { useState, useEffect } from "react";
import { WifiOff } from "lucide-react";

export function ConnectionStatus() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setOnline(navigator.onLine);
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  if (online) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] bg-destructive text-destructive-foreground text-center py-1 text-sm flex items-center justify-center gap-2">
      <WifiOff className="h-4 w-4" />
      Sin conexion a internet
    </div>
  );
}