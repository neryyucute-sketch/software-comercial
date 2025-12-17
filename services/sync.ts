import { getAccessToken } from "./auth";


  export async function syncData(
    endpoint: string,
    label: string,
    progress: number,
    params: Record<string, any> = {}
  ): Promise<any[] | null> {    
    const rawToken = await getAccessToken();
    const token = rawToken?.replace(/(\r\n|\n|\r)/gm, "").trim();
    try {
      // 🔒 Seguridad: Sanitizar parámetros
      const sanitizedParams: Record<string, any> = {};
      for (const [key, value] of Object.entries(params)) {
        if (typeof value === 'string') {
          sanitizedParams[key] = value.substring(0, 200); // limitar longitud
        } else {
          sanitizedParams[key] = value;
        }
      }

      // Construcción de query string
      let query = "";
      if (Object.keys(sanitizedParams).length > 0) {
        query =
          "?" +
          Object.entries(sanitizedParams)
            .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
            .join("&");
      }

      let page = 0;
      let totalPages = 1;
      let results: any[] = []; // genérico, puede ser productos, clientes, etc.

      while (page < totalPages) {
        const url = `${process.env.NEXT_PUBLIC_API_URL}/${endpoint}${query}${
          query ? "&" : "?"
        }page=${page}&size=50`;

        console.debug("[syncData] Fetching:", url);
        console.debug("[syncData] Token present:", !!token);

        // 🔒 Seguridad: Timeout de 30 segundos
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        try {
          const res = await fetch(url, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
            signal: controller.signal,
          });
          clearTimeout(timeoutId);

          console.debug("[syncData] Response status:", res.status);

          if (!res.ok) {
            const errorText = await res.text();
            throw new Error(
              `❌ Error al traer datos página ${page}: ${res.status} - ${errorText}`
            );
          }

          const data = await res.json();

          // asumimos que la API devuelve { content: [...], totalPages: N }
          results = results.concat(data.content ?? []);
          totalPages = data.totalPages ?? 1;
          page++;
        } catch (fetchError: any) {
          if (fetchError.name === 'AbortError') {
            throw new Error('⏱️ Timeout: La petición tardó más de 30 segundos');
          }
          throw fetchError;
        }
      }
        // Guardar en IndexedDB usando Dexie
      return results; // 👈 devuelve el array genérico
    } catch (err) {
      console.error(err);
      return null;
    }
  };