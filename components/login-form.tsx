"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

export default function LoginForm() {
  const { login, loading } = useAuth();
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // 🔹 Mandamos usuario y clave al backend a través de AuthContext
    const success = await login(username, password);

    if (success) {
      router.push("/products"); // 👈 redirige si login OK
    } else {
      setError("Usuario o contraseña incorrectos");
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 w-full max-w-sm mx-auto p-6 bg-white/10 backdrop-blur-md rounded-xl shadow-lg"
    >
      <h1 className="text-lg font-bold text-center text-white">Iniciar sesión</h1>

      <Input
        type="text"
        placeholder="👤 Usuario"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        className="bg-white/20 text-white placeholder-white/60 border-white/30 focus:ring-2 focus:ring-cyan-400"
      />

      <Input
        type="password"
        placeholder="🔒 Contraseña"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="bg-white/20 text-white placeholder-white/60 border-white/30 focus:ring-2 focus:ring-cyan-400"
      />

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <Button
        type="submit"
        disabled={loading}
        className="bg-cyan-500 hover:bg-cyan-600 text-white font-semibold rounded-lg py-2 flex items-center justify-center"
      >
        {loading ? (
          <>
            <Loader2 className="animate-spin mr-2" size={18} />
            Conectando...
          </>
        ) : (
          "Entrar"
        )}
      </Button>
    </form>
  );
}
