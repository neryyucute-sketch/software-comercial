"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker
        .register("/service-worker.js")
        .then((reg) => console.log("SW registrado:", reg))
        .catch((err) => console.error("SW fallo:", err));
    }
  }, []);

  return null; // No renderiza nada en la UI
}
