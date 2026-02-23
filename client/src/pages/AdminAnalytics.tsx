import { trpc } from "@/lib/trpc";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, ScatterChart, Scatter
} from "recharts";
import { format } from "date-fns";
import { TrendingUp, TrendingDown, Minus, BarChart2, Eye, Home, Video } from "lucide-react";

const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-[#D1D9DF] rounded-xl p-3 shadow-xl">
      <p className="font-heading text-xs text-[#A0B2C2] uppercase tracking-wider mb-2">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} className="font-body text-sm text-[#2A384C]">
          <span className="text-[#A0B2C2]">{p.name}: </span>
          {typeof p.value === "number" ? p.value.toLocaleString() : p.value}
        </p>
      ))}
    </div>
  );
};

function TrendBadge({ pct }: { pct: number }) {
  if (pct > 5) return (
    <span className="flex items-center gap-1 text-xs font-heading text-[#2A384C] bg-[#D1D9DF] px-2 py-0.5 rounded-full">
      <TrendingUp size={11} /> +{pct.toFixed(0)}%
    </span>
  );
  if (pct < -5) return (
    <span className="flex items-center gap-1 text-xs font-heading text-[#F0F0F0] bg-[#2A384C] px-2 py-0.5 rounded-full">
      <TrendingDown size={11} /> {pct.toFixed(0)}%
    </span>
  );
  return (
    <span className="flex items-center gap-1 text-xs font-heading text-[#A0B2C2] bg-[#f5f7f9] px-2 py-0.5 rounded-full">
      <Minus size={11} /> Flat
    </span>
  );
}

export default function AdminAnalytics() {
  const { data, isLoading } = trpc.analytics.overview.useQuery();

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-[#D1D9DF] rounded" />
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-28 bg-white rounded-xl border border-[#D1D9DF]" />)}
          </div>
          <div className="h-64 bg-white rounded-xl border border-[#D1D9DF]" />
        </div>
      </div>
    );
  }

  // Handle both return shapes
  const listings = (data as any)?.listingPerformance ?? [];

  if (!listings || listings.length === 0) {
    return (
      <div className="p-8">
        <div className="text-center py-16">
          <BarChart2 size={40} className="text-[#D1D9DF] mx-auto mb-4" />
          <h2 className="font-heading text-lg text-[#2A384C] mb-2">No Analytics Yet</h2>
          <p className="font-body text-[#A0B2C2] text-sm">Add listings and enter weekly stats to see analytics here.</p>
        </div>
      </div>
    );
  }

  // Portfolio totals
  const portfolioTotals = listings.reduce((acc: any, l: any) => ({
    totalPortalViews: acc.totalPortalViews + (l.totalPortalViews ?? 0),
    totalImpressions: acc.totalImpressions + (l.totalImpressions ?? 0),
    totalShowings: acc.totalShowings + (l.totalShowings ?? 0),
    totalVideoViews: acc.totalVideoViews + (l.totalVideoViews ?? 0),
  }), { totalPortalViews: 0, totalImpressions: 0, totalShowings: 0, totalVideoViews: 0 });

  // Cross-listing comparison bar chart
  const comparisonData = listings.map((l: any) => ({
    name: (l.address ?? "").split(",")[0].split(" ").slice(0, 3).join(" "),
    "Portal Views": l.totalPortalViews ?? 0,
    "Impressions": l.totalImpressions ?? 0,
    "Showings": l.totalShowings ?? 0,
  }));

  // Scatter: portal views vs showings
  const scatterData = listings
    .filter((l: any) => (l.totalPortalViews ?? 0) > 0)
    .map((l: any) => ({
      name: (l.address ?? "").split(",")[0].split(" ").slice(0, 3).join(" "),
      x: l.totalPortalViews ?? 0,
      y: l.totalShowings ?? 0,
      efficiency: l.totalPortalViews > 0
        ? (((l.totalShowings ?? 0) / l.totalPortalViews) * 1000).toFixed(1)
        : "0",
    }));

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-heading text-2xl font-semibold text-[#2A384C]">Portfolio Analytics</h1>
        <p className="font-body text-[#A0B2C2] text-sm mt-0.5">Cross-listing performance trends and predictive insights</p>
      </div>

      {/* Portfolio KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Portal Views", value: portfolioTotals.totalPortalViews, icon: Eye },
          { label: "Total Impressions", value: portfolioTotals.totalImpressions, icon: TrendingUp },
          { label: "Total Showings", value: portfolioTotals.totalShowings, icon: Home },
          { label: "Total Video Views", value: portfolioTotals.totalVideoViews, icon: Video },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="bg-white rounded-xl border border-[#D1D9DF] p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="font-heading text-xs text-[#A0B2C2] uppercase tracking-wider">{label}</p>
              <div className="w-8 h-8 rounded-full bg-[#f5f7f9] flex items-center justify-center">
                <Icon size={14} className="text-[#2A384C]" />
              </div>
            </div>
            <p className="font-heading text-2xl font-bold text-[#2A384C]">{value.toLocaleString()}</p>
            <p className="font-body text-xs text-[#A0B2C2] mt-1">{listings.length} listing{listings.length !== 1 ? "s" : ""}</p>
          </div>
        ))}
      </div>

      {/* Cross-Listing Comparison */}
      {comparisonData.length > 1 && (
        <div className="bg-white rounded-xl border border-[#D1D9DF] p-6">
          <h2 className="font-heading text-sm font-semibold text-[#2A384C] uppercase tracking-wider mb-1">Cross-Listing Comparison</h2>
          <p className="font-body text-[#A0B2C2] text-sm mb-5">Cumulative performance across all active listings</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={comparisonData} margin={{ top: 5, right: 5, left: -20, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f5f7f9" />
                <XAxis dataKey="name" tick={{ fill: "#A0B2C2", fontSize: 10, fontFamily: "Cooper Hewitt" }} angle={-20} textAnchor="end" axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#A0B2C2", fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontFamily: "Cooper Hewitt", fontSize: 11, color: "#A0B2C2", paddingTop: 8 }} />
                <Bar dataKey="Portal Views" fill="#2A384C" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Impressions" fill="#A0B2C2" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Showings" fill="#4A6080" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Efficiency Scatter */}
      {scatterData.length > 1 && (
        <div className="bg-white rounded-xl border border-[#D1D9DF] p-6">
          <h2 className="font-heading text-sm font-semibold text-[#2A384C] uppercase tracking-wider mb-1">Views-to-Showings Efficiency</h2>
          <p className="font-body text-[#A0B2C2] text-sm mb-5">Portal views (X) vs. showings (Y) — higher Y relative to X = better conversion</p>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f5f7f9" />
                <XAxis dataKey="x" name="Portal Views" tick={{ fill: "#A0B2C2", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis dataKey="y" name="Showings" tick={{ fill: "#A0B2C2", fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ strokeDasharray: "3 3" }} content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload;
                  return (
                    <div className="bg-white border border-[#D1D9DF] rounded-xl p-3 shadow-xl">
                      <p className="font-heading text-xs text-[#2A384C] mb-1">{d.name}</p>
                      <p className="font-body text-xs text-[#A0B2C2]">{d.x.toLocaleString()} views → {d.y} showings</p>
                      <p className="font-body text-xs text-[#2A384C] font-semibold">{d.efficiency} showings / 1K views</p>
                    </div>
                  );
                }} />
                <Scatter data={scatterData} fill="#2A384C" />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Per-Listing Performance + Insights */}
      <div className="bg-white rounded-xl border border-[#D1D9DF] p-6">
        <h2 className="font-heading text-sm font-semibold text-[#2A384C] uppercase tracking-wider mb-1">Per-Listing Performance</h2>
        <p className="font-body text-[#A0B2C2] text-sm mb-5">Weekly trend, totals, and predictive recommendations</p>
        <div className="space-y-4">
          {listings.map((l: any, idx: number) => {
            const sparklineData = (l.weeklyBreakdown ?? [])
              .slice().reverse()
              .map((w: any) => ({ week: w.weekOf ? format(new Date(w.weekOf), "MMM d") : "", views: w.portalViews ?? 0 }));

            return (
              <div key={l.listingId} className="border border-[#D1D9DF] rounded-xl p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-heading text-sm font-semibold text-[#2A384C]">{l.address}</p>
                    <p className="font-body text-xs text-[#A0B2C2] mt-0.5">
                      {l.status} · {l.listPrice || "Price TBD"}
                      {l.daysOnMarket !== null && ` · ${l.daysOnMarket} DOM`}
                    </p>
                  </div>
                  <TrendBadge pct={l.portalTrend ?? 0} />
                </div>

                {/* Mini stats */}
                <div className="grid grid-cols-4 gap-3 mb-4">
                  {[
                    { label: "Portal Views", value: l.totalPortalViews ?? 0 },
                    { label: "Impressions", value: l.totalImpressions ?? 0 },
                    { label: "Showings", value: l.totalShowings ?? 0 },
                    { label: "Video Views", value: l.totalVideoViews ?? 0 },
                  ].map(({ label, value }) => (
                    <div key={label} className="text-center p-3 bg-[#f5f7f9] rounded-lg">
                      <p className="font-heading text-lg font-bold text-[#2A384C]">{value.toLocaleString()}</p>
                      <p className="font-heading text-xs text-[#A0B2C2] uppercase tracking-wider">{label}</p>
                    </div>
                  ))}
                </div>

                {/* Sparkline */}
                {sparklineData.length > 1 && (
                  <div className="h-16 mb-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={sparklineData} margin={{ top: 2, right: 2, left: 0, bottom: 2 }}>
                        <defs>
                          <linearGradient id={`grad${idx}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#2A384C" stopOpacity={0.2} />
                            <stop offset="95%" stopColor="#2A384C" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <Area type="monotone" dataKey="views" stroke="#2A384C" fill={`url(#grad${idx})`} strokeWidth={1.5} dot={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Insight */}
                {l.insight && (
                  <div className="flex items-start gap-2 p-3 bg-[#f5f7f9] rounded-lg border border-[#D1D9DF]">
                    <TrendingUp size={14} className="text-[#A0B2C2] flex-shrink-0 mt-0.5" />
                    <p className="font-body text-xs text-[#2A384C]">
                      <span className="font-heading text-xs text-[#A0B2C2] uppercase tracking-wider mr-1">Insight:</span>
                      {l.insight}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
