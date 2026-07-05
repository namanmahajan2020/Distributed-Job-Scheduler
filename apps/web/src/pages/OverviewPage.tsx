import { useQuery } from "@tanstack/react-query";
import { Bar, Line } from "react-chartjs-2";
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, PointElement, Tooltip, Legend } from "chart.js";
import { api } from "../lib/api";
import { useRealtime } from "../hooks/useRealtime";

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Tooltip, Legend);

export const OverviewPage = () => {
  useRealtime(["metrics:update", "snapshot:update"], [["metrics"]]);

  const { data } = useQuery({
    queryKey: ["metrics"],
    queryFn: async () => (await api.get("/metrics")).data
  });

  const statusChart = {
    labels: ["Completed", "Failed", "Retries", "Queued"],
    datasets: [
      {
        label: "Jobs",
        data: [data?.completed ?? 0, data?.failed ?? 0, data?.retries ?? 0, data?.queueLength ?? 0],
        backgroundColor: ["#f59e0b", "#ef4444", "#f97316", "#0ea5e9"]
      }
    ]
  };

  const throughput = {
    labels: data?.throughput?.map((point: any) => new Date(point.bucket).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })) ?? [],
    datasets: [
      {
        label: "Completed",
        data: data?.throughput?.map((point: any) => point.completed) ?? [],
        borderColor: "#f59e0b",
        backgroundColor: "rgba(245,158,11,0.2)"
      },
      {
        label: "Failed",
        data: data?.throughput?.map((point: any) => point.failed) ?? [],
        borderColor: "#ef4444",
        backgroundColor: "rgba(239,68,68,0.2)"
      }
    ]
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
      <section className="space-y-6">
        <div className="rounded-3xl border border-stone-800 bg-stone-900/70 p-6">
          <h2 className="mb-4 text-2xl font-semibold">Queue Throughput</h2>
          <Line data={throughput} />
        </div>
        <div className="rounded-3xl border border-stone-800 bg-stone-900/70 p-6">
          <h2 className="mb-4 text-2xl font-semibold">Lifecycle Totals</h2>
          <Bar data={statusChart} />
        </div>
      </section>
      <section className="grid gap-4">
        {[
          ["Workers", data?.workerCount ?? 0],
          ["Success Rate", `${data?.successRate ?? 0}%`],
          ["Failure Rate", `${data?.failureRate ?? 0}%`],
          ["Avg Exec", `${data?.averageExecutionTimeMs ?? 0} ms`],
          ["Jobs / sec", data?.jobsPerSecond ?? 0]
        ].map(([label, value]) => (
          <div key={label} className="rounded-3xl border border-stone-800 bg-stone-900/70 p-6">
            <p className="text-sm uppercase tracking-[0.25em] text-stone-400">{label}</p>
            <p className="mt-3 text-3xl font-semibold">{value}</p>
          </div>
        ))}
      </section>
    </div>
  );
};
