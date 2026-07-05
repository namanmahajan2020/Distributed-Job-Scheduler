import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";

export const LoginPage = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState("admin@scheduler.local");
  const [password, setPassword] = useState("Password123!");
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    try {
      const response = await api.post("/auth/login", { email, password });
      await login(response.data.accessToken, response.data.refreshToken);
      navigate("/");
    } catch (submitError: any) {
      setError(submitError.response?.data?.error?.message ?? "Login failed");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(245,158,11,0.15),_transparent_35%),linear-gradient(135deg,_#0c0a09,_#1c1917_45%,_#292524)] px-6 text-stone-100">
      <form onSubmit={onSubmit} className="w-full max-w-md rounded-3xl border border-stone-800 bg-stone-900/70 p-8 shadow-2xl backdrop-blur">
        <p className="text-sm uppercase tracking-[0.3em] text-amber-400">Scheduler Access</p>
        <h1 className="mt-3 text-4xl font-semibold">Control Plane Login</h1>
        <div className="mt-8 space-y-4">
          <label className="block">
            <span className="mb-2 block text-sm text-stone-300">Email</span>
            <input value={email} onChange={(event) => setEmail(event.target.value)} className="w-full rounded-2xl border border-stone-700 bg-stone-950/60 px-4 py-3 text-stone-100 outline-none focus:border-amber-400" />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm text-stone-300">Password</span>
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-2xl border border-stone-700 bg-stone-950/60 px-4 py-3 text-stone-100 outline-none focus:border-amber-400" />
          </label>
        </div>
        {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}
        <button type="submit" className="mt-6 w-full rounded-2xl bg-amber-400 px-4 py-3 font-medium text-stone-950 transition hover:bg-amber-300">
          Sign In
        </button>
      </form>
    </div>
  );
};
