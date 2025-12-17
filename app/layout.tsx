import type React from "react";
import type { Metadata, Viewport } from "next";
import "./globals.css";

import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";

import { ThemeProvider } from "@/contexts/theme-context";
import { AuthProvider } from "@/contexts/AuthContext";
import AuthGuard from "@/components/auth-guard";
import { PreventaProvider } from "@/contexts/preventa-context";
import { ProductsProvider } from "@/contexts/ProductsContext";
import ClientWrapper from "../components/client-wrapper";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import { ClientesProvider } from "@/contexts/ClientesContext";
import { OrdersProvider } from "@/contexts/OrdersContext";
import { OffersProvider } from "@/contexts/offers-context";
import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: "Sistema de Preventa",
  description: "Sistema completo de gestión de preventas con almacenamiento local",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#3b82f6",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className={`${GeistSans.className} antialiased`}>
        <ThemeProvider>
          <AuthProvider>
            <AuthGuard>
              <PreventaProvider>
                <ClientesProvider>
                  <ProductsProvider>
                    <OrdersProvider>
                      <OffersProvider>
                        <ClientWrapper>{children}</ClientWrapper>
                        <Toaster />
                        <ServiceWorkerRegister /> {/* ✅ Aquí queda */}
                      </OffersProvider>
                    </OrdersProvider>
                  </ProductsProvider>
                </ClientesProvider>
              </PreventaProvider>
            </AuthGuard>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
