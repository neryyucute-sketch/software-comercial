
const API_BASE = process.env.NEXT_PUBLIC_API_URL;


export async function loginService(username: string, password: string, deviceId: string) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password, deviceId }),
  });
  if (!res.ok) return null;
  return res.json(); // { token: "..." }
}
