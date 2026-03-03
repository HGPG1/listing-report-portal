import { trpc } from "@/lib/trpc";
import { useParams, useLocation } from "wouter";
import { useEffect, useRef, useState } from "react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from "recharts";
import { format } from "date-fns";
import { MapPin, Calendar, Eye, Video, Home, Star, TrendingUp, ChevronDown, Settings } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";

// ─── Admin Button ────────────────────────────────────────────────────────────
function AdminButton({ listingId }: { listingId?: number }) {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  if (!user || !listingId) return null;

  return (
    <div className="flex justify-center mb-6">
      <button
        onClick={() => navigate(`/admin/listings/${listingId}`)}
        className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-full px-4 py-2 transition-colors"
        title="Go to admin dashboard"
      >
        <Settings size={14} className="text-[#A0B2C2]" />
        <span className="font-heading text-xs text-[#A0B2C2] uppercase tracking-wider">Admin</span>
      </button>
    </div>
  );
}

// ─── Animated Counter ─────────────────────────────────────────────────────────
function AnimatedCounter({ target, duration = 1200 }: { target: number; duration?: number }) {
  const [count, setCount] = useState(0);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (target === 0) return;
    const animate = (ts: number) => {
      if (!startRef.current) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(eased * target));
      if (progress < 1) rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);

  return <>{count.toLocaleString()}</>;
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, icon: Icon, delay = 0 }: { label: string; value: number; icon: any; delay?: number }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  return (
    <div className={`transition-all duration-700 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
      <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-5 text-center">
        <div className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center mx-auto mb-3">
          <Icon size={18} className="text-[#F0F0F0]" />
        </div>
        <p className="font-heading text-3xl font-bold text-white leading-none">
          {visible ? <AnimatedCounter target={value} /> : "0"}
        </p>
        <p className="font-heading text-xs text-[#A0B2C2] uppercase tracking-widest mt-2">{label}</p>
      </div>
    </div>
  );
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────
const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#2A384C] border border-[rgba(160,178,194,0.3)] rounded-xl p-3 shadow-xl">
      <p className="font-heading text-xs text-[#A0B2C2] uppercase tracking-wider mb-2">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} className="font-body text-sm text-white">
          <span className="text-[#A0B2C2]">{p.name}: </span>
          {p.value.toLocaleString()}
        </p>
      ))}
    </div>
  );
};

// ─── Main Report Page ─────────────────────────────────────────────────────────
export default function SellerReport() {
  const params = useParams<{ token: string }>();
  const token = params.token ?? "";
  const { data, isLoading, error } = trpc.magicLinks.validate.useQuery({ token }, { enabled: !!token });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#2A384C" }}>
        <div className="text-center">
          <img src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663289350630/lUoPAFTNBufcYnNy.png" alt="Home Grown Property Group" className="h-16 mx-auto mb-6 opacity-80" />
          <div className="w-8 h-8 border-2 border-[#A0B2C2] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="font-body text-[#A0B2C2] text-sm mt-4">Loading your report...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#2A384C" }}>
        <div className="text-center max-w-sm mx-auto p-8">
          <img src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663289350630/lUoPAFTNBufcYnNy.png" alt="Home Grown Property Group" className="h-16 mx-auto mb-6 opacity-80" />
          <h1 className="font-heading text-xl font-semibold text-white mb-3">Link Expired or Invalid</h1>
          <p className="font-body text-[#A0B2C2] text-sm">
            {error.message || "This report link is no longer active. Please contact your agent for a new link."}
          </p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { listing, weeklyStats, showings, offers, socialPosts } = data;

  // Aggregate totals from all weekly stats
  const totalZillow = weeklyStats.reduce((s, w) => s + (w.zillowViews ?? 0), 0);
  const totalRealtor = weeklyStats.reduce((s, w) => s + (w.realtorViews ?? 0), 0);
  const totalRedfin = weeklyStats.reduce((s, w) => s + (w.redfinViews ?? 0), 0);
  const totalWebsite = weeklyStats.reduce((s, w) => s + (w.websiteViews ?? 0), 0);
  const totalPortal = totalZillow + totalRealtor + totalRedfin + totalWebsite;
  const totalImpressions = weeklyStats.reduce((s, w) => s + (w.totalImpressions ?? 0), 0);
  const totalVideoViews = weeklyStats.reduce((s, w) => s + (w.totalVideoViews ?? 0), 0);
  const totalShowings = showings.length;
  const totalOffers = offers.length;

  // Chart data — last 8 weeks, ascending
  const chartData = [...weeklyStats]
    .sort((a, b) => new Date(a.weekOf).getTime() - new Date(b.weekOf).getTime())
    .slice(-8)
    .map(w => ({
      week: format(new Date(w.weekOf), "MMM d"),
      "Portal Views": (w.zillowViews ?? 0) + (w.realtorViews ?? 0) + (w.redfinViews ?? 0) + (w.websiteViews ?? 0),
      "Impressions": w.totalImpressions ?? 0,
      "Video Views": w.totalVideoViews ?? 0,
      "Showings": w.totalShowings ?? 0,
    }));

  // Social totals
  const socialImpressions = socialPosts.reduce((s, p) => s + (p.impressions ?? 0), 0);
  const socialReach = socialPosts.reduce((s, p) => s + (p.reach ?? 0), 0);
  const socialVideoViews = socialPosts.reduce((s, p) => s + (p.videoViews ?? 0), 0);

  // Portal breakdown for bar chart
  const portalData = [
    { name: "Zillow", views: totalZillow },
    { name: "Realtor.com", views: totalRealtor },
    { name: "Redfin", views: totalRedfin },
    { name: "Website", views: totalWebsite },
  ].filter(d => d.views > 0);

  const daysOnMarket = listing.listDate
    ? Math.floor((Date.now() - new Date(listing.listDate).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <div className="min-h-screen font-body" style={{ backgroundColor: "#2A384C" }}>

      {/* ── Hero Header ── */}
      <header className="relative overflow-hidden">
        {listing.heroPhotoUrl && (
          <div className="absolute inset-0">
            <img src={listing.heroPhotoUrl} alt={listing.address} className="w-full h-full object-cover opacity-20" />
            <div className="absolute inset-0 bg-gradient-to-b from-[#2A384C]/60 via-[#2A384C]/80 to-[#2A384C]" />
          </div>
        )}
        <div className="relative z-10 max-w-4xl mx-auto px-6 pt-10 pb-8">
          {/* Logo */}
          <div className="flex justify-center mb-8">
            <img src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663289350630/lUoPAFTNBufcYnNy.png" alt="Home Grown Property Group" className="h-16" />
          </div>

          {/* Report badge */}
          <div className="text-center mb-6">
            <span className="inline-block font-heading text-xs text-[#A0B2C2] uppercase tracking-[0.2em] border border-[rgba(160,178,194,0.3)] rounded-full px-4 py-1.5">
              Weekly Marketing Report
            </span>
          </div>

          {/* Address */}
          <h1 className="font-heading text-3xl md:text-4xl font-bold text-white text-center mb-2 leading-tight">
            {listing.address}
          </h1>
          {(listing.city || listing.state) && (
            <p className="font-body text-[#A0B2C2] text-center text-sm mb-6">
              {[listing.city, listing.state, listing.zip].filter(Boolean).join(", ")}
            </p>
          )}

          {/* Admin Button - visible only to authenticated admins */}
          <AdminButton listingId={data?.listing.id} />

          {/* Meta row */}
          <div className="flex flex-wrap items-center justify-center gap-4 mb-8">
            {listing.listPrice && (
              <div className="flex items-center gap-1.5 bg-white/10 rounded-full px-4 py-1.5">
                <Home size={13} className="text-[#A0B2C2]" />
                <span className="font-heading text-sm text-white">{listing.listPrice}</span>
              </div>
            )}
            {listing.mlsNumber && (
              <div className="flex items-center gap-1.5 bg-white/10 rounded-full px-4 py-1.5">
                <MapPin size={13} className="text-[#A0B2C2]" />
                <span className="font-heading text-sm text-white">MLS# {listing.mlsNumber}</span>
              </div>
            )}
            {daysOnMarket !== null && (
              <div className="flex items-center gap-1.5 bg-white/10 rounded-full px-4 py-1.5">
                <Calendar size={13} className="text-[#A0B2C2]" />
                <span className="font-heading text-sm text-white">{daysOnMarket} Days on Market</span>
              </div>
            )}
            <div className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 ${
              listing.status === "Active" ? "bg-[#A0B2C2]/20" :
              listing.status === "Under Contract" ? "bg-[#A0B2C2]/30" :
              listing.status === "Sold" ? "bg-blue-500/20" :
              "bg-white/10"
            }`}>
              <span className="font-heading text-sm text-white">{listing.status}</span>
            </div>
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <StatCard label="Portal Views" value={totalPortal} icon={Eye} delay={100} />
            <StatCard label="Impressions" value={totalImpressions} icon={TrendingUp} delay={200} />
            <StatCard label="Video Views" value={totalVideoViews} icon={Video} delay={300} />
            <StatCard label="Showings" value={totalShowings} icon={Home} delay={400} />
          </div>
        </div>
      </header>

      {/* ── Main Content ── */}
      <main className="max-w-4xl mx-auto px-6 pb-16 space-y-8">

        {/* Agent Narrative */}
        {listing.weeklyNarrative && (
          <section className="bg-white/8 backdrop-blur-sm border border-white/15 rounded-2xl p-6">
            <p className="font-heading text-xs text-[#A0B2C2] uppercase tracking-[0.15em] mb-3">A Note From Your Agent</p>
            <p className="font-body text-[#F0F0F0] text-base leading-relaxed italic">"{listing.weeklyNarrative}"</p>
            {listing.agentName && (
              <div className="flex items-center gap-3 mt-4 pt-4 border-t border-white/10">
                {listing.agentPhotoUrl ? (
                  <img src={listing.agentPhotoUrl} alt={listing.agentName} className="w-10 h-10 rounded-full object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-[#A0B2C2]/30 flex items-center justify-center">
                    <span className="font-heading text-sm text-white">{listing.agentName.charAt(0)}</span>
                  </div>
                )}
                <div>
                  <p className="font-heading text-sm text-white">{listing.agentName}</p>
                  <p className="font-body text-xs text-[#A0B2C2]">Home Grown Property Group | Real Broker, LLC</p>
                </div>
              </div>
            )}
          </section>
        )}

        {/* Portal Views Chart */}
        {chartData.length > 0 && (
          <section className="bg-white/8 backdrop-blur-sm border border-white/15 rounded-2xl p-6">
            <p className="font-heading text-xs text-[#A0B2C2] uppercase tracking-[0.15em] mb-1">Portal Views Over Time</p>
            <p className="font-body text-[#F0F0F0] text-sm mb-5">Zillow · Realtor.com · Redfin · Website</p>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="portalGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#A0B2C2" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#A0B2C2" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(160,178,194,0.1)" />
                  <XAxis dataKey="week" tick={{ fill: "#A0B2C2", fontSize: 11, fontFamily: "Cooper Hewitt" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#A0B2C2", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area type="monotone" dataKey="Portal Views" stroke="#A0B2C2" fill="url(#portalGrad)" strokeWidth={2} dot={{ fill: "#A0B2C2", r: 3 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>
        )}

        {/* Impressions Chart */}
        {chartData.length > 0 && totalImpressions > 0 && (
          <section className="bg-white/8 backdrop-blur-sm border border-white/15 rounded-2xl p-6">
            <p className="font-heading text-xs text-[#A0B2C2] uppercase tracking-[0.15em] mb-1">Social Media Impressions</p>
            <p className="font-body text-[#F0F0F0] text-sm mb-5">Total reach across all platforms week-over-week</p>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(160,178,194,0.1)" />
                  <XAxis dataKey="week" tick={{ fill: "#A0B2C2", fontSize: 11, fontFamily: "Cooper Hewitt" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#A0B2C2", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="Impressions" fill="#A0B2C2" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        )}

        {/* Portal Breakdown */}
        {portalData.length > 0 && (
          <section className="bg-white/8 backdrop-blur-sm border border-white/15 rounded-2xl p-6">
            <p className="font-heading text-xs text-[#A0B2C2] uppercase tracking-[0.15em] mb-5">Listing Portal Breakdown</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "Zillow", value: totalZillow },
                { label: "Realtor.com", value: totalRealtor },
                { label: "Redfin", value: totalRedfin },
                { label: "Website", value: totalWebsite },
              ].map(({ label, value }) => (
                <div key={label} className="text-center p-4 bg-white/8 rounded-xl border border-white/10">
                  <p className="font-heading text-2xl font-bold text-white">{value.toLocaleString()}</p>
                  <p className="font-heading text-xs text-[#A0B2C2] uppercase tracking-wider mt-1">{label}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Social Media */}
        {socialPosts.length > 0 && (
          <section className="bg-white/8 backdrop-blur-sm border border-white/15 rounded-2xl p-6">
            <p className="font-heading text-xs text-[#A0B2C2] uppercase tracking-[0.15em] mb-5">Social Media Activity</p>
            <div className="grid grid-cols-3 gap-3 mb-5">
              {[
                { label: "Impressions", value: socialImpressions },
                { label: "Reach", value: socialReach },
                { label: "Video Views", value: socialVideoViews },
              ].map(({ label, value }) => (
                <div key={label} className="text-center p-4 bg-white/8 rounded-xl border border-white/10">
                  <p className="font-heading text-2xl font-bold text-white">{value.toLocaleString()}</p>
                  <p className="font-heading text-xs text-[#A0B2C2] uppercase tracking-wider mt-1">{label}</p>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              {socialPosts.slice(0, 5).map(p => (
                <div key={p.id} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10">
                  <div className="flex items-center gap-3">
                    <span className="font-heading text-xs bg-[#A0B2C2]/20 text-[#A0B2C2] px-2 py-1 rounded-lg">{p.platform}</span>
                    <span className="font-body text-xs text-[#A0B2C2]">
                      {p.postedAt ? format(new Date(p.postedAt), "MMM d") : "—"}
                    </span>
                  </div>
                  <div className="flex gap-4 text-xs font-body text-[#A0B2C2]">
                    <span>{(p.impressions ?? 0).toLocaleString()} impr.</span>
                    {p.postUrl && (
                      <a href={p.postUrl} target="_blank" rel="noopener noreferrer" className="text-[#A0B2C2] hover:text-white transition-colors">↗</a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Showings */}
        {showings.length > 0 && (
          <section className="bg-white/8 backdrop-blur-sm border border-white/15 rounded-2xl p-6">
            <p className="font-heading text-xs text-[#A0B2C2] uppercase tracking-[0.15em] mb-5">
              Showings — {showings.length} Total
            </p>
            <div className="space-y-3">
              {showings.map(s => (
                <div key={s.id} className="p-4 bg-white/5 rounded-xl border border-white/10">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-heading text-sm text-white">{format(new Date(s.showingDate), "MMMM d, yyyy")}</p>
                      {s.buyerAgentName && <p className="font-body text-xs text-[#A0B2C2] mt-0.5">Agent: {s.buyerAgentName}</p>}
                    </div>
                    {s.starRating && (
                      <div className="flex gap-0.5">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star key={i} size={12} className={i < s.starRating! ? "text-[#A0B2C2] fill-[#A0B2C2]" : "text-white/20"} />
                        ))}
                      </div>
                    )}
                  </div>
                  {s.feedbackSummary && (
                    <p className="font-body text-xs text-[#F0F0F0] mt-2 italic opacity-80">"{s.feedbackSummary}"</p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Offers */}
        {offers.length > 0 && (
          <section className="bg-white/8 backdrop-blur-sm border border-white/15 rounded-2xl p-6">
            <p className="font-heading text-xs text-[#A0B2C2] uppercase tracking-[0.15em] mb-5">
              Offers Received — {offers.length} Total
            </p>
            <div className="space-y-3">
              {offers.map(o => (
                <div key={o.id} className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10">
                  <div>
                    <p className="font-heading text-sm text-white">{o.offerPrice ?? "Price undisclosed"}</p>
                    <p className="font-body text-xs text-[#A0B2C2] mt-0.5">{format(new Date(o.offerDate), "MMMM d, yyyy")}</p>
                  </div>
                  <span className={`font-heading text-xs px-3 py-1 rounded-full ${
                    o.status === "Accepted" ? "bg-[#A0B2C2]/30 text-[#F0F0F0]" :
                    o.status === "Declined" ? "bg-white/10 text-[#A0B2C2]" :
                    o.status === "Countered" ? "bg-white/15 text-[#F0F0F0]" :
                    "bg-white/10 text-[#A0B2C2]"
                  }`}>{o.status}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Footer */}
        <footer className="text-center pt-4 pb-2">
          <img src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663289350630/lUoPAFTNBufcYnNy.png" alt="Home Grown Property Group" className="h-12 mx-auto mb-3 opacity-60" />
          {listing.agentName && (
            <p className="font-heading text-xs text-[#A0B2C2] uppercase tracking-wider">{listing.agentName}</p>
          )}
          {listing.agentPhone && (
            <p className="font-body text-xs text-[#A0B2C2] mt-0.5">{listing.agentPhone}</p>
          )}
          {listing.agentEmail && (
            <a href={`mailto:${listing.agentEmail}`} className="font-body text-xs text-[#A0B2C2] hover:text-white transition-colors">
              {listing.agentEmail}
            </a>
          )}
          <p className="font-body text-xs text-[#A0B2C2]/40 mt-4">
            © {new Date().getFullYear()} Home Grown Property Group | Real Broker, LLC
          </p>
        </footer>
      </main>
    </div>
  );
}
