import { useQuery } from "@tanstack/react-query";
import { useRealtime } from "../hooks/useRealtime";
import { api } from "../lib/api";

export const WorkersPage = () => {
  useRealtime(["worker:update", "snapshot:update"], [["workers"]]);

  const { data } = useQuery({
    queryKey: ["workers"],
    queryFn: async () => (await api.get("/workers", { params: { limit: 20 } })).data
  });

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {data?.items?.map((worker: any) => (
        <div key={worker.id} className="rounded-3xl border border-stone-800 bg-stone-900/70 p-6">
          <div className="flex items-center justify-between">
            <p className="text-xl font-semibold">{worker.name}</p>
            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-300">
              {worker.status}
            </span>
          </div>
          <div className="mt-4 space-y-2 text-stone-400">
            <p>Concurrency {worker.concurrency}</p>
            <p>Claims {worker._count.claimedJobs}</p>
            <p>Executions {worker._count.executions}</p>
            <p>Last heartbeat {worker.lastHeartbeat ? new Date(worker.lastHeartbeat).toLocaleString() : "never"}</p>
          </div>
          {worker.heartbeats?.[0] ? (
            <div className="mt-4 rounded-2xl border border-stone-800 bg-stone-950/50 p-4 text-sm text-stone-300">
              Active jobs {worker.heartbeats[0].activeJobs} | Memory {worker.heartbeats[0].memoryMb ?? 0} MB
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
};
