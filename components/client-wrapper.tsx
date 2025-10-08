"use client";

import { usePathname } from "next/navigation";
import { Navigation } from "@/components/navigation";

export default function ClientWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/login";

  return (
    <>
      {!isLoginPage && <Navigation />}
      <main className="pt-14 pb-16 min-h-screen bg-gray-50">
        {children}
      </main>
    </>
  );
}
