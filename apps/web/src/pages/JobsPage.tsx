import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "../lib/api";
import { useRealtime } from "../hooks/useRealtime";

export const JobsPage = () => {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");

  useRealtime(["job:update", "log:create", "snapshot:update"], [["jobs"]]);

  const { data } = useQuery({
    queryKey: ["jobs", status, search],
    queryFn: async () => (await api.get("/jobs", { params: { status: status || undefined, search, limit: 30 } })).data
  });

  const retryMutation = useMutation({
    mutationFn: async (jobId: string) => api.post(`/jobs/${jobId}/retry`),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["jobs"] })
  });

  const cancelMutation = useMutation({
    mutationFn: async (jobId: string) => api.post(`/jobs/${jobId}/cancel`),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["jobs"] })
  });

  return (
    <div className="space-y-6">
      <div className="grid gap-4 rounded-3xl border border-stone-800 bg-stone-900/70 p-4 md:grid-cols-[1fr_220px]">
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search jobs" className="rounded-2xl border border-stone-700 bg-stone-950/50 px-4 py-3 outline-none focus:border-amber-400" />
        <select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-2xl border border-stone-700 bg-stone-950/50 px-4 py-3 outline-none focus:border-amber-400">
          <option value="">All statuses</option>
          {["QUEUED", "SCHEDULED", "RUNNING", "COMPLETED", "FAILED", "RETRYING", "DEAD_LETTER", "CANCELLED"].map((value) => (
            <option key={value} value={value}>{value}</option>
          ))}
        </select>
      </div>
      <div className="space-y-3">
        {data?.items?.map((job: any) => (
          <div key={job.id} className="rounded-3xl border border-stone-800 bg-stone-900/70 p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xl font-semibold">{job.name}</p>
                <p className="mt-2 text-sm text-stone-400">
                  {job.type} | Priority {job.priority} | Retries {job.retryCount}/{job.maxRetries}
                </p>
                <p className="mt-1 text-sm text-stone-500">{job.queue?.project?.name} / {job.queue?.name}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="rounded-full border border-stone-700 px-3 py-1 text-xs">{job.status}</span>
                {job.status === "DEAD_LETTER" ? (
                  <button onClick={() => retryMutation.mutate(job.id)} className="rounded-2xl border border-amber-500/40 px-4 py-2 text-sm text-amber-300">
                    Retry
                  </button>
                ) : null}
                {["QUEUED", "SCHEDULED", "RETRYING"].includes(job.status) ? (
                  <button onClick={() => cancelMutation.mutate(job.id)} className="rounded-2xl border border-red-500/40 px-4 py-2 text-sm text-red-300">
                    Cancel
                  </button>
                ) : null}
              </div>
            </div>
            {job.errorMessage ? <p className="mt-3 text-sm text-red-300">{job.errorMessage}</p> : null}
          </div>
        ))}
      </div>
    </div>
  );
};
