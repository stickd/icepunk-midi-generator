"use client";

import { useEffect, useState } from "react";
import { TOKEN_KEY } from "@/lib/api";

type MetricRow = { metricDate: string; metricName: string; count: number };
type Dashboard = { days: number; daily: MetricRow[]; totals: Record<string, number>; generationFailurePercent: number };
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8081";

export default function ProductMetricsPage() {
  const [days, setDays] = useState<7 | 30>(7);
  const [data, setData] = useState<Dashboard | null>(null);
  const [state, setState] = useState<"loading" | "denied" | "error" | "ready">("loading");

  useEffect(() => {
    const token = window.localStorage.getItem(TOKEN_KEY);
    if (!token) { setState("denied"); return; }
    setState("loading");
    fetch(`${API_URL}/admin/product-metrics?days=${days}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (response) => {
        if (response.status === 401 || response.status === 403) { setState("denied"); return; }
        if (!response.ok) throw new Error("METRICS_REQUEST_FAILED");
        setData(await response.json() as Dashboard);
        setState("ready");
      }).catch(() => setState("error"));
  }, [days]);

  return <main className="mx-auto w-full max-w-5xl px-6 py-16 text-ice-secondary">
    <p className="font-mono text-xs tracking-[.2em] text-[color:var(--ice-accent)]">ADMIN / AGGREGATE ONLY</p>
    <div className="mt-3 flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-3xl font-semibold text-ice-primary">Product metrics</h1><p className="mt-2">No user, session, IP or fingerprint-level analytics are shown here.</p></div><label className="text-sm">Window <select aria-label="Metrics period" className="ml-2 rounded border border-[color:var(--ice-border)] bg-transparent px-3 py-2" value={days} onChange={(event) => setDays(Number(event.target.value) as 7 | 30)}><option value={7}>7 days</option><option value={30}>30 days</option></select></label></div>
    {state === "loading" ? <p className="mt-10">Loading…</p> : null}
    {state === "denied" ? <p className="mt-10" role="alert">Administrator access is required.</p> : null}
    {state === "error" ? <p className="mt-10" role="alert">Metrics could not be loaded.</p> : null}
    {state === "ready" && data ? <><section className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[
      ["Successful generations", data.totals.GENERATION_SUCCEEDED ?? 0], ["Failed generations", data.totals.GENERATION_FAILED ?? 0],
      ["Failure rate", `${data.generationFailurePercent.toFixed(1)}%`], ["Completed registrations", data.totals.REGISTRATION_COMPLETED ?? 0],
      ["Public packs", data.totals.PUBLIC_PACK_CREATED ?? 0], ["Export URLs issued", data.totals.EXPORT_URL_ISSUED ?? 0],
    ].map(([label, value]) => <article className="rounded-2xl border border-[color:var(--ice-border)] bg-[color:var(--ice-surface)] p-5" key={String(label)}><p className="text-sm text-ice-muted">{label}</p><strong className="mt-2 block text-2xl text-ice-primary">{value}</strong></article>)}</section>
      <section className="mt-10 overflow-x-auto"><h2 className="text-xl text-ice-primary">Daily counters</h2><table className="mt-4 w-full text-left text-sm"><thead className="border-b border-[color:var(--ice-border)] text-ice-muted"><tr><th className="p-3">Date</th><th className="p-3">Metric</th><th className="p-3">Count</th></tr></thead><tbody>{data.daily.map((row) => <tr className="border-b border-[color:var(--ice-border)]" key={`${row.metricDate}-${row.metricName}`}><td className="p-3">{row.metricDate}</td><td className="p-3">{row.metricName}</td><td className="p-3">{row.count}</td></tr>)}</tbody></table></section></> : null}
  </main>;
}
