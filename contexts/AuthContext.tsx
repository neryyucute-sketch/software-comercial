"use client";

import React, { createContext, useContext, useMemo, useState, useEffect, use } from "react";
import type { AuthUser, PermissionAction, PermissionModule, Tokens } from "@/lib/types";
import { clearTokens, saveTokens, getTokens } from "../services/auth"; // 👈 usamos tu nuevo auth.ts
import { loginService} from "@/services/authService";
import { getOrCreateDeviceId } from "@/services/auth"; 
import { encryptData, decryptData } from "@/lib/crypto-utils";
import { getToken } from "@/lib/db";

type HasPermissionFn = (module: PermissionModule, action: PermissionAction) => boolean;

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  hasPermission: HasPermissionFn;
  rolUsuario: string;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/** Permisos por defecto */
const ROLE_DEFAULT_PERMS: Record<string, Array<[PermissionModule, PermissionAction]>> = {
  JEFE_SISTEMAS: [
    ["products","create"],["products","read"],["products","update"],["products","delete"],
    ["orders","create"],["orders","read"],["orders","update"],["orders","cancel"],
    ["customers","create"],["customers","read"],["customers","update"],
    ["offers","create"],["offers","read"],["offers","update"],
    ["prices","read"],["stats","read"],["users","read"],["vendors","read"],["vendor_classifications","read"]
  ],
  Manager: [
    ["products","read"],["products","update"],
    ["orders","create"],["orders","read"],["orders","update"],["orders","cancel"],
    ["customers","read"],["offers","read"],["prices","read"],["stats","read"],["vendors","read"]
  ],
  VENDEDOR: [
    ["products","read"],
    ["orders","create"],["orders","read"],
    ["customers","read"]
  ],
};

const keyOf = (m: PermissionModule, a: PermissionAction) => `${m}:${a}`;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [rolUsuario, setRolUsuario] = useState<string>("");
  const [menuUsuario, setMenuUsuario] = useState<Record<string, string>>({}); // 👈 aquí guardas las opciones de menú  
  const [refreshAuth, setRefreshAuth] = useState(0);

  // 🔹 Al iniciar, intentar reconstruir usuario desde token guardado
  useEffect(() => {
    (async () => {
      try {
        const tokens = await getTokens();
        const token = await getToken();
        if (tokens && tokens.usuarioConfiguracion) {
          const rolEntry = tokens.usuarioConfiguracion.find(
            (item: any) => item.configuracion === "ROL"
          );
          if (rolEntry) {
            setRolUsuario(rolEntry.valor); // 👈 esto sería "JEFE_SISTEMAS"
            const authUserSave: AuthUser = {
              id:"",
              usuario: "",
              clave: "",
              nombre: "",
              apellido:"",
              rol: rolEntry.valor,                   // viene de la entrada de rol
              puesto: "",
              estado: "",
              usuarioConfiguracion:tokens?.usuarioConfiguracion,
              token: token?.accessToken ?? "",      // el accessToken que guardaste
            };
            setUser(authUserSave);
          }

          const menuEntry = tokens.usuarioConfiguracion.find(
            (item: any) => item.configuracion === "MENU_PREVENTA"
          );

          if (menuEntry) {
            try {
              const parsedMenu: Record<string, string> = JSON.parse(menuEntry.valor);
              setMenuUsuario(parsedMenu); // ahora es objeto, no array
            } catch (err) {
              console.error("Error parseando MENU_PREVENTA:", err, menuEntry.valor);
            }
          }
        }
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [refreshAuth]);

  const login = async (username: string, password: string) => {
    setLoading(true);
    let valorReturn = false;
    try {
      const deviceId = await getOrCreateDeviceId(); // string JSON
      if (navigator.onLine) {
        // 🔹 Caso online → pega al backend

        const response = await loginService(username, password, deviceId);
        if (!response) return false;
        const expiresAt = 15 * 60 * 1000; // 15 minutos
        const authUser: AuthUser = {
          ...response.user,
          token: await encryptData(response.token),
        };

        // Guardamos token + credenciales en IndexedDB

//       await saveToken(authUser, response.token, expiresAt, deviceId);

        const tokens: Tokens = {
          id:"session",
          accessToken: await encryptData(response.accessToken), // soporta ambos
          refreshToken:await encryptData(response.refreshToken),
          expiresAt: Date.now() + expiresAt,
          usuarioConfiguracion: response.usuarioConfiguracionList,
        };
        setUser(authUser);
        saveTokens(tokens); // guardamos tokens usando tu función
        setRefreshAuth((prev) => prev + 1); // 👈 esto dispara el useEffect
        valorReturn = true;
        return true;
      } 
    } catch (e) {
      console.log("Error en login ",e);
      valorReturn = false;
      return false;
    } finally {
      setLoading(false);
      return valorReturn;
    }
  };


  const logout = async () => {
    await clearTokens();
    setUser(null);
  };

  const hasPermission: HasPermissionFn = useMemo(() => {
    return (module, action) => {
      if (!user) return false;


      // ✅ Verificar permisos en menuUsuario
      const permisos = menuUsuario[module]; // ej. "crud"
      if (!permisos) return false;

      // Mapear acciones a letras
      const map: Record<string, string> = {
        create: "c",
        read: "r",
        update: "u",
        delete: "d",
        extra: "x",
      };

      return permisos.includes(map[action]);
    };
  }, [user, rolUsuario, menuUsuario]);



  const value: AuthContextValue = {
    user,
    loading,
    login,
    logout,
    hasPermission,
    rolUsuario,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  }
  return ctx;
}
