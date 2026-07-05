import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "../lib/api";
import { useRealtime } from "../hooks/useRealtime";

export const QueuesPage = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  useRealtime(["queue:update", "snapshot:update"], [["queues"]]);

  const { data } = useQuery({
    queryKey: ["queues", search],
    queryFn: async () => (await api.get("/queues", { params: { search, limit: 20 } })).data
  });

  const queueAction = useMutation({
    mutationFn: async ({ queueId, action }: { queueId: string; action: "pause" | "resume" }) =>
      api.post(`/queues/${queueId}/${action}`),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["queues"] })
  });

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-stone-800 bg-stone-900/70 p-4">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search queues"
          className="w-full rounded-2xl border border-stone-700 bg-stone-950/50 px-4 py-3 outline-none focus:border-amber-400"
        />
      </div>
      <div className="grid gap-4">
        {data?.items?.map((queue: any) => (
          <article key={queue.id} className="rounded-3xl border border-stone-800 bg-stone-900/70 p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h2 className="text-2xl font-semibold">{queue.name}</h2>
                <p className="mt-2 text-stone-400">{queue.description || queue.slug}</p>
                <p className="mt-3 text-sm text-stone-500">
                  Concurrency {queue.concurrencyLimit} | Max workers {queue.maxWorkers} | Rate limit {queue.rateLimitPerMin ?? "none"}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="rounded-full border border-stone-700 px-3 py-1 text-xs">{queue.status}</span>
                {queue.status === "ACTIVE" ? (
                  <button onClick={() => queueAction.mutate({ queueId: queue.id, action: "pause" })} className="rounded-2xl border border-amber-500/40 px-4 py-2 text-sm text-amber-300">
                    Pause
                  </button>
                ) : (
                  <button onClick={() => queueAction.mutate({ queueId: queue.id, action: "resume" })} className="rounded-2xl border border-emerald-500/40 px-4 py-2 text-sm text-emerald-300">
                    Resume
                  </button>
                )}
              </div>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-stone-800 bg-stone-950/50 p-4">
                <p className="text-sm text-stone-400">Queued jobs</p>
                <p className="mt-2 text-2xl font-semibold">{queue._count.jobs}</p>
              </div>
              <div className="rounded-2xl border border-stone-800 bg-stone-950/50 p-4">
                <p className="text-sm text-stone-400">Recurring jobs</p>
                <p className="mt-2 text-2xl font-semibold">{queue._count.scheduledJobs}</p>
              </div>
              <div className="rounded-2xl border border-stone-800 bg-stone-950/50 p-4">
                <p className="text-sm text-stone-400">Retry strategy</p>
                <p className="mt-2 text-2xl font-semibold">{queue.retryPolicy?.strategy ?? "none"}</p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
};
