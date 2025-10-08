import LoginForm from "@/components/login-form";

export default function LoginPage() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black">
      <div className="w-full max-w-md p-8 rounded-2xl shadow-2xl bg-white/10 backdrop-blur-lg border border-white/20">
        <h1 className="text-2xl font-bold text-center text-white mb-6">
          🚀 Preventa System
        </h1>
        <LoginForm />
      </div>
    </div>
  );
}
