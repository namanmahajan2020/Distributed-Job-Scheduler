import { Link, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../lib/auth";

const nav = [
  { to: "/", label: "Overview" },
  { to: "/queues", label: "Queues" },
  { to: "/jobs", label: "Jobs" },
  { to: "/workers", label: "Workers" }
];

export const Layout = () => {
  const location = useLocation();
  const { logout, user } = useAuth();

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(245,158,11,0.15),_transparent_30%),linear-gradient(135deg,_#0c0a09,_#1c1917_45%,_#292524)] text-stone-100">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <header className="mb-8 flex flex-col gap-6 rounded-3xl border border-stone-800 bg-stone-900/70 p-6 backdrop-blur">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-amber-400">Distributed Scheduler</p>
              <h1 className="text-4xl font-semibold">Control Plane</h1>
            </div>
            <div className="flex items-center gap-3">
              <div className="rounded-2xl border border-stone-700 bg-stone-950/50 px-4 py-2 text-sm">
                {user?.name ?? "Operator"}
              </div>
              <button onClick={() => void logout()} className="rounded-2xl border border-stone-700 px-4 py-2 text-sm hover:border-amber-400 hover:text-amber-300">
                Logout
              </button>
            </div>
          </div>
          <nav className="flex flex-wrap gap-3">
            {nav.map((item) => (
              <Link
                key={item.to}
                className={`rounded-full border px-4 py-2 text-sm transition ${
                  location.pathname === item.to
                    ? "border-amber-400 bg-amber-400/10 text-amber-300"
                    : "border-stone-700 hover:border-amber-400 hover:text-amber-300"
                }`}
                to={item.to}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </header>
        <Outlet />
      </div>
    </div>
  );
};
