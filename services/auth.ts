import { db } from "../lib/db";
import { encryptData, decryptData } from "../lib/crypto-utils";
import { Tokens } from "../lib/types";

const TOKEN_KEY = "session"; // clave fija en IndexedDB
const API_BASE = process.env.NEXT_PUBLIC_API_URL;

// 🔒 Seguridad: Limitar información expuesta del dispositivo
function getDeviceInfo() {
  const ua = navigator.userAgent;
  let os = "Unknown";
  let browser = "Unknown";

  if (ua.indexOf("Win") !== -1) os = "Windows";
  else if (ua.indexOf("Mac") !== -1) os = "MacOS";
  else if (ua.indexOf("Linux") !== -1) os = "Linux";
  else if (/Android/i.test(ua)) os = "Android";
  else if (/iPhone|iPad|iPod/i.test(ua)) os = "iOS";

  if (ua.indexOf("Chrome") !== -1) browser = "Chrome";
  else if (ua.indexOf("Safari") !== -1 && ua.indexOf("Chrome") === -1) browser = "Safari";
  else if (ua.indexOf("Firefox") !== -1) browser = "Firefox";
  else if (ua.indexOf("Edg") !== -1) browser = "Edge";

  // 🔒 No exponer userAgent completo, solo hash
  const uaHash = crypto.subtle ? hashString(ua) : "legacy";
  return { os, browser, uaHash };
}

// Hash simple para userAgent
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

export async function getOrCreateDeviceId(): Promise<string> {
  // Buscar en la cache
  let cache = await db.auth.get("device");
  if (cache?.deviceId) {
    return cache.deviceId; // ✅ ya existe, lo reutilizamos
  }
  try{
    // Generar por primera vez
    const info = getDeviceInfo();
    const newId = {
      uuid: crypto.randomUUID(),
      os: info.os,
      browser: info.browser,
      uaHash: info.uaHash, // 🔒 Solo hash, no userAgent completo
      createdAt: new Date().toISOString(),
    };

    const deviceIdStr = JSON.stringify(newId);
    const deviceId = JSON.parse(deviceIdStr);
    // Guardamos en IndexedDB en un registro separado "device"
      await db.devices.put({
        id: "device",
        deviceId,
      });
    return deviceId;
  }catch(e){
    console.log("Error al crear DeviceId en auth.ts ",e);
  }
  return "";
}

/** 🔹 Guardar tokens en IndexedDB */
export async function saveTokens(tokens: Tokens): Promise<void> {
  await db.tokens.put(tokens);
}


/** 🔹 Leer tokens de IndexedDB */
export async function getTokens(): Promise<Tokens | null> {
  const record = await db.tokens.get(TOKEN_KEY);
  if (!record) return null;
  return {
    id:TOKEN_KEY,
    accessToken: await decryptData(record.accessToken),
    refreshToken: await decryptData(record.refreshToken ?? ""), // 👈 fallback string vacío
    expiresAt: record.expiresAt,
    usuarioConfiguracion: record.usuarioConfiguracion,
  };
}

/** 🔹 Borrar tokens → logout */
export async function clearTokens() {
  await db.auth.delete(TOKEN_KEY);
  await db.tokens.delete(TOKEN_KEY);
}

/** 🔹 Refrescar token */
async function refreshTokenWithRetry(refreshTokenValue: string, retries = 3): Promise<Tokens> {
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      headers: { Authorization: `Bearer ${refreshTokenValue}` },
    });

    const data = await res.json();
    
    if (!res.ok) {
      // 🔒 Seguridad: Si el refresh falla, limpiar sesión
      if (res.status === 401 || res.status === 403) {
        await clearTokens();
        throw new Error("Sesión expirada. Por favor, inicia sesión nuevamente.");
      }
      throw new Error("Error al refrescar token: " + JSON.stringify(data));
    }

    const expiresIn = 15 * 60 * 1000;

    const tokens: Tokens = {
      id:TOKEN_KEY,
      accessToken: await encryptData(data.accessToken), 
      refreshToken:await encryptData(data.refreshToken),
      expiresAt: Date.now() + expiresIn,
      usuarioConfiguracion: data.usuarioConfiguracionList
    };

    await saveTokens(tokens);
    return {
      id:TOKEN_KEY,
      accessToken: await decryptData(tokens.accessToken),
      refreshToken: await decryptData(tokens.refreshToken ?? ""), // 👈 fallback string vacío
      expiresAt: tokens.expiresAt,
      usuarioConfiguracion: tokens.usuarioConfiguracion,
    };
  } catch (error) {
    // 🔒 Retry logic para errores de red
    if (retries > 0 && !(error instanceof Error && error.message.includes("Sesión expirada"))) {
      console.warn(`Reintentando refresh token... (intentos restantes: ${retries})`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      return refreshTokenWithRetry(String(refreshTokenValue), retries - 1);
    }
    throw error;
  }
}

/** 🔹 Obtener accessToken válido (renueva si expiró) */
export async function getAccessToken(): Promise<string> {
  let tokens = await getTokens();
  if (!tokens) {
    throw new Error("No hay sesión activa");
  }

  if (Date.now() >= tokens.expiresAt) {
    tokens = await refreshTokenWithRetry(tokens.refreshToken);
  }

  return tokens.accessToken;
}
