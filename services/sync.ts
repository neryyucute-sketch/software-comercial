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
      // Construcción de query string
      let query = "";
      if (Object.keys(params).length > 0) {
        query =
          "?" +
          Object.entries(params)
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

        const res = await fetch(url, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

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
      }
        // Guardar en IndexedDB usando Dexie
      return results; // 👈 devuelve el array genérico
    } catch (err) {
      console.error(err);
      return null;
    }
  };