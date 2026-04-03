"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";

interface ClientRow {
  client_name: string;
  generations: string;
  edits: string;
  total_calls: string;
  total_cost: string;
}

interface ModelRow {
  model: string;
  call_count: string;
  total_cost: string;
}

interface Totals {
  total_calls: string;
  total_cost: string;
  first_log: string | null;
  last_log: string | null;
}

interface RecentRow {
  client_name: string;
  route: string;
  model: string;
  estimated_cost: string;
  timestamp: string;
}

interface AdminData {
  clients: ClientRow[];
  models: ModelRow[];
  totals: Totals;
  recent: RecentRow[];
}

function AdminContent() {
  const searchParams = useSearchParams();
  const key = searchParams.get("key");
  const [data, setData] = useState<AdminData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!key) {
      setError("Access denied. Missing key.");
      setLoading(false);
      return;
    }

    fetch(`/api/admin?key=${encodeURIComponent(key)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setData(d);
      })
      .catch(() => setError("Failed to load data."))
      .finally(() => setLoading(false));
  }, [key]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050507] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-purple-500/30 border-t-purple-400 rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#050507] flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 text-lg font-bold mb-2">Access Denied</p>
          <p className="text-neutral-500 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const fmt = (cost: string | number) => `$${Number(cost).toFixed(4)}`;
  const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

  return (
    <div className="min-h-screen bg-[#050507] text-white p-6 md:p-10">
      {/* Header */}
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-8 h-8 rounded-lg bg-purple-600 flex items-center justify-center text-xs font-bold">A</div>
          <h1 className="text-xl font-bold">Augra Admin</h1>
        </div>
        <p className="text-neutral-500 text-sm mb-8">Usage tracking and cost monitoring</p>

        {/* Overview Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5">
            <p className="text-xs text-neutral-500 uppercase tracking-wider mb-1">Total Calls</p>
            <p className="text-2xl font-bold">{data.totals.total_calls}</p>
          </div>
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5">
            <p className="text-xs text-neutral-500 uppercase tracking-wider mb-1">Total Cost</p>
            <p className="text-2xl font-bold text-purple-400">{fmt(data.totals.total_cost)}</p>
          </div>
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5">
            <p className="text-xs text-neutral-500 uppercase tracking-wider mb-1">First Log</p>
            <p className="text-sm text-neutral-300">{fmtDate(data.totals.first_log)}</p>
          </div>
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5">
            <p className="text-xs text-neutral-500 uppercase tracking-wider mb-1">Last Log</p>
            <p className="text-sm text-neutral-300">{fmtDate(data.totals.last_log)}</p>
          </div>
        </div>

        {/* Client Usage Table */}
        <h2 className="text-lg font-bold mb-4">Usage by Client</h2>
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl overflow-hidden mb-10">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left px-4 py-3 text-xs text-neutral-500 uppercase tracking-wider">Client</th>
                <th className="text-right px-4 py-3 text-xs text-neutral-500 uppercase tracking-wider">Generations</th>
                <th className="text-right px-4 py-3 text-xs text-neutral-500 uppercase tracking-wider">Edits</th>
                <th className="text-right px-4 py-3 text-xs text-neutral-500 uppercase tracking-wider">Total Calls</th>
                <th className="text-right px-4 py-3 text-xs text-neutral-500 uppercase tracking-wider">Total Cost</th>
              </tr>
            </thead>
            <tbody>
              {data.clients.map((row) => (
                <tr key={row.client_name} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                  <td className="px-4 py-3 font-medium">{row.client_name}</td>
                  <td className="px-4 py-3 text-right text-neutral-400">{row.generations}</td>
                  <td className="px-4 py-3 text-right text-neutral-400">{row.edits}</td>
                  <td className="px-4 py-3 text-right">{row.total_calls}</td>
                  <td className="px-4 py-3 text-right text-purple-400 font-medium">{fmt(row.total_cost)}</td>
                </tr>
              ))}
              {data.clients.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-neutral-600">No usage data yet</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Model Breakdown */}
        <h2 className="text-lg font-bold mb-4">Cost by Model</h2>
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl overflow-hidden mb-10">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left px-4 py-3 text-xs text-neutral-500 uppercase tracking-wider">Model</th>
                <th className="text-right px-4 py-3 text-xs text-neutral-500 uppercase tracking-wider">Calls</th>
                <th className="text-right px-4 py-3 text-xs text-neutral-500 uppercase tracking-wider">Total Cost</th>
                <th className="text-right px-4 py-3 text-xs text-neutral-500 uppercase tracking-wider">Avg/Call</th>
              </tr>
            </thead>
            <tbody>
              {data.models.map((row) => (
                <tr key={row.model} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                  <td className="px-4 py-3 font-mono text-xs">{row.model}</td>
                  <td className="px-4 py-3 text-right text-neutral-400">{row.call_count}</td>
                  <td className="px-4 py-3 text-right text-purple-400 font-medium">{fmt(row.total_cost)}</td>
                  <td className="px-4 py-3 text-right text-neutral-400">
                    {fmt(Number(row.total_cost) / Number(row.call_count))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Recent Activity */}
        <h2 className="text-lg font-bold mb-4">Recent Activity</h2>
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left px-4 py-3 text-xs text-neutral-500 uppercase tracking-wider">Time</th>
                <th className="text-left px-4 py-3 text-xs text-neutral-500 uppercase tracking-wider">Client</th>
                <th className="text-left px-4 py-3 text-xs text-neutral-500 uppercase tracking-wider">Route</th>
                <th className="text-left px-4 py-3 text-xs text-neutral-500 uppercase tracking-wider">Model</th>
                <th className="text-right px-4 py-3 text-xs text-neutral-500 uppercase tracking-wider">Cost</th>
              </tr>
            </thead>
            <tbody>
              {data.recent.map((row, i) => (
                <tr key={i} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                  <td className="px-4 py-2 text-xs text-neutral-500">{fmtDate(row.timestamp)}</td>
                  <td className="px-4 py-2 text-xs">{row.client_name}</td>
                  <td className="px-4 py-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${row.route === "generate" ? "bg-purple-500/15 text-purple-400" : "bg-teal-500/15 text-teal-400"}`}>
                      {row.route}
                    </span>
                  </td>
                  <td className="px-4 py-2 font-mono text-[10px] text-neutral-500">{row.model}</td>
                  <td className="px-4 py-2 text-right text-xs">{fmt(row.estimated_cost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function AdminPage() {
  return (
    <Suspense>
      <AdminContent />
    </Suspense>
  );
}
