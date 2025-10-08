const SECRET = "Cod$25%#.{}"; // 👈 clave fija, podrías moverla a .env

async function getKey() {
  const enc = new TextEncoder().encode(SECRET);
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc,
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: new TextEncoder().encode("codimisa-salt"), // 👈 otro valor fijo
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptData(data: string): Promise<string> {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(data);
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
  return JSON.stringify({ cipher: Array.from(new Uint8Array(cipher)), iv: Array.from(iv) });
}

export async function decryptData(data: string): Promise<string> {
  const { cipher, iv } = JSON.parse(data);
  const key = await getKey();
  const buffer = new Uint8Array(cipher);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: new Uint8Array(iv) }, key, buffer);
  return new TextDecoder().decode(plain);
}
