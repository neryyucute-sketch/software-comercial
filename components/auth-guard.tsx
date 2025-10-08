"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user && pathname !== "/login") {
      router.push("/login");
    }
  }, [loading, user, router, pathname]);

  // ✅ Render condicional sin alterar orden de hooks
  if (pathname === "/login") {
    return <>{children}</>; // login no necesita protección
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-gray-500">Verificando sesión...</p>
      </div>
    );
  }

  if (!user) return null;

  return <>{children}</>;
}
