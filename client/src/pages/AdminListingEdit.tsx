import { trpc } from "@/lib/trpc";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLocation } from "wouter";
import { ArrowLeft, Save, Link, Send, RefreshCw, Plus, Trash2,
  BarChart2, Home, Users, FileText, Mail, ExternalLink, Copy, Check, Upload, X as XIcon
} from "lucide-react";
import { useState, useRef } from "react";
import { toast } from "sonner";
import { format } from "date-fns";

interface Props { id: number; }

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="text-[#A0B2C2] hover:text-[#2A384C] transition-colors"
      title="Copy to clipboard"
    >
      {copied ? <Check size={14} className="text-[#A0B2C2]" /> : <Copy size={14} />}
    </button>
  );
}

export default function AdminListingEdit({ id }: Props) {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const { data: showingRequests } = trpc.showingtime.getForListing.useQuery({ listingId: id });

  const { data, isLoading, error } = trpc.listings.getFull.useQuery({ id });
  const { data: magicLink, refetch: refetchLink } = trpc.magicLinks.getForListing.useQuery({ listingId: id });

  // Mutations
  const updateMutation = trpc.listings.update.useMutation({
    onSuccess: () => { toast.success("Listing updated."); utils.listings.getFull.invalidate({ id }); },
    onError: (e) => toast.error(e.message),
  });
  const refreshLinkMutation = trpc.magicLinks.refresh.useMutation({
    onSuccess: () => { toast.success("New magic link generated (30-day expiry)."); refetchLink(); },
    onError: (e) => toast.error(e.message),
  });
  const sendNowMutation = trpc.email.sendNow.useMutation({
    onSuccess: (r) => {
      if (r.success) toast.success("Report event posted to Follow Up Boss!");
      else toast.error("FUB event failed. Check FUB Contact ID.");
      utils.email.getLog.invalidate({ listingId: id });
    },
    onError: (e) => toast.error(e.message),
  });
  const upsertStatsMutation = trpc.stats.upsertWeekly.useMutation({
    onSuccess: () => { toast.success("Weekly stats saved."); utils.listings.getFull.invalidate({ id }); },
    onError: (e) => toast.error(e.message),
  });
  const createShowingMutation = trpc.showings.create.useMutation({
    onSuccess: () => { toast.success("Showing logged."); utils.listings.getFull.invalidate({ id }); },
    onError: (e) => toast.error(e.message),
  });
  const deleteShowingMutation = trpc.showings.delete.useMutation({
    onSuccess: () => utils.listings.getFull.invalidate({ id }),
    onError: (e) => toast.error(e.message),
  });
  const createOfferMutation = trpc.offers.create.useMutation({
    onSuccess: () => { toast.success("Offer logged."); utils.listings.getFull.invalidate({ id }); },
    onError: (e) => toast.error(e.message),
  });
  const deleteOfferMutation = trpc.offers.delete.useMutation({
    onSuccess: () => utils.listings.getFull.invalidate({ id }),
    onError: (e) => toast.error(e.message),
  });
  const syncShowingTimeEmailsMutation = trpc.showingtime.syncEmails.useMutation({
    onSuccess: (result) => {
      toast.success(`Synced ${result.synced} ShowingTime emails`);
      utils.showingtime.getForListing.invalidate({ listingId: id });
    },
    onError: (e) => toast.error(e.message),
  });
  const createSocialMutation = trpc.stats.createSocial.useMutation({
    onSuccess: () => { toast.success("Social post added."); utils.listings.getFull.invalidate({ id }); },
    onError: (e) => toast.error(e.message),
  });
  const deleteSocialMutation = trpc.stats.deleteSocial.useMutation({
    onSuccess: () => utils.listings.getFull.invalidate({ id }),
    onError: (e) => toast.error(e.message),
  });

  // Local form state
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [uploadingPhoto, setUploadingPhoto] = useState<"hero" | "agent" | null>(null);
  const heroInputRef = useRef<HTMLInputElement>(null);
  const agentInputRef = useRef<HTMLInputElement>(null);

  const uploadPhotoMutation = trpc.magicLinks.uploadPhoto.useMutation({
    onSuccess: (r, vars) => {
      setEditForm(f => ({ ...f, [vars.type === "hero" ? "heroPhotoUrl" : "agentPhotoUrl"]: r.url }));
      toast.success(`${vars.type === "hero" ? "Hero" : "Agent"} photo uploaded.`);
      setUploadingPhoto(null);
    },
    onError: (e: any) => { toast.error(e.message); setUploadingPhoto(null); },
  });
  // Zillow sync disabled — using ListTrac instead
  // const zillowSyncMutation = trpc.zillow.syncListing.useMutation({...});
  const listTracSyncMutation = trpc.listtrac.syncListing.useMutation({
    onMutate: (vars) => {
      console.log("[UI] ListTrac mutation starting:", vars);
    },
    onSuccess: async (data) => {
      console.log("[UI] ListTrac sync succeeded", data);
      toast.success("ListTrac data synced!");
      // Invalidate the cache first to force a fresh fetch
      await utils.listings.getFull.invalidate({ id });
      // Then refetch to get the new data
      const refreshedData = await utils.listings.getFull.refetch({ id });
      // Auto-populate form with new synced data
      await new Promise(resolve => setTimeout(resolve, 500)); // Wait for cache to update
      const updatedData = await utils.listings.getFull.getData({ id });
      if (updatedData?.weeklyStats?.[0]) {
        const stats = updatedData.weeklyStats[0];
        setWeeklyForm({
          weekOf: format(new Date(stats.weekOf), "yyyy-MM-dd"),
          zillowListtracViews: String(stats.zillowListtracViews ?? 0),
          realtorListtracViews: String(stats.realtorListtracViews ?? 0),
          mlsListtracViews: String(stats.mlsListtracViews ?? 0),
          oneHomeListtracViews: String(stats.oneHomeListtracViews ?? 0),
          truliaListtracViews: String(stats.truliaListtracViews ?? 0),
          otherSourcesListtracViews: String(stats.otherSourcesListtracViews ?? 0),
          totalImpressions: String(stats.totalImpressions ?? 0),
          totalVideoViews: String(stats.totalVideoViews ?? 0),
          totalShowings: String(stats.totalShowings ?? 0),
        });
      }
    },
    onError: (e) => {
      console.error("[UI] ListTrac sync failed:", e);
      toast.error(`ListTrac sync failed: ${e.message}`);
    },
    onSettled: () => {
      console.log("[UI] ListTrac mutation settled");
    },
  });

  const handlePhotoFile = (type: "hero" | "agent") => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) { toast.error("Photo must be under 8 MB."); return; }
    setUploadingPhoto(type);
    const reader = new FileReader();
    reader.onload = () => {
      uploadPhotoMutation.mutate({ base64: reader.result as string, filename: file.name, listingId: id, type });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };
  const [timePeriod, setTimePeriod] = useState<7 | 14 | 30 | -1>(7);
  
  const latestStats = data?.weeklyStats?.[0];
  const [weeklyForm, setWeeklyForm] = useState<Record<string, string>>(() => ({
    weekOf: latestStats ? format(new Date(latestStats.weekOf), "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
    zillowListtracViews: String(latestStats?.zillowListtracViews ?? 0),
    realtorListtracViews: String(latestStats?.realtorListtracViews ?? 0),
    mlsListtracViews: String(latestStats?.mlsListtracViews ?? 0),
    oneHomeListtracViews: String(latestStats?.oneHomeListtracViews ?? 0),
    truliaListtracViews: String(latestStats?.truliaListtracViews ?? 0),
    otherSourcesListtracViews: String(latestStats?.otherSourcesListtracViews ?? 0),
    totalImpressions: String(latestStats?.totalImpressions ?? 0),
    totalShowings: String(latestStats?.totalShowings ?? 0),
  }));
  const [showingForm, setShowingForm] = useState({ showingDate: format(new Date(), "yyyy-MM-dd"), buyerAgentName: "", feedbackSummary: "", starRating: "" });
  const [offerForm, setOfferForm] = useState({ offerDate: format(new Date(), "yyyy-MM-dd"), offerPrice: "", status: "Active", notes: "" });
  const [socialForm, setSocialForm] = useState({ platform: "Instagram", postUrl: "", impressions: "0", reach: "0", linkClicks: "0", videoViews: "0", postedAt: format(new Date(), "yyyy-MM-dd") });

  const { data: emailLog } = trpc.email.getLog.useQuery({ listingId: id });

  if (isLoading) return (
    <div className="p-8">
      <div className="animate-pulse space-y-4">
        <div className="h-8 w-64 bg-[#D1D9DF] rounded" />
        <div className="h-64 bg-white rounded-xl border border-[#D1D9DF]" />
      </div>
    </div>
  );

  if (error || !data) return (
    <div className="p-8">
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
        <p className="text-red-700 font-body">Listing not found or access denied.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/admin")}>Back to Listings</Button>
      </div>
    </div>
  );

  const { listing, weeklyStats, showings, offers, socialPosts } = data;

  const getField = (key: keyof typeof listing) =>
    editForm[key] !== undefined ? editForm[key] : ((listing as any)[key] ?? "");

  const handleSaveListing = () => {
    const updates: Record<string, any> = { id };
    for (const [k, v] of Object.entries(editForm)) {
      updates[k] = v;
    }
    updateMutation.mutate(updates as any);
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/admin")} className="text-[#A0B2C2] hover:text-[#2A384C] transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="font-heading text-xl font-semibold text-[#2A384C]">{listing.address}</h1>
            <p className="font-body text-[#A0B2C2] text-sm">{listing.mlsNumber ? `MLS# ${listing.mlsNumber}` : "No MLS#"} · {listing.status}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {magicLink && (
            <Button
              variant="outline"
              size="sm"
              className="font-heading text-xs border-[#D1D9DF]"
              onClick={() => window.open(magicLink.url, "_blank")}
            >
              <ExternalLink size={13} className="mr-1" />
              Preview Report
            </Button>
          )}
          <Button
            size="sm"
            className="bg-[#2A384C] hover:bg-[#1e2a38] text-white font-heading text-xs tracking-wide"
            onClick={() => sendNowMutation.mutate({ listingId: id })}
            disabled={sendNowMutation.isPending}
          >
            <Send size={13} className="mr-1" />
            {sendNowMutation.isPending ? "Sending..." : "Send Report Now"}
          </Button>
        </div>
      </div>

      {/* Magic Link Banner */}
      {magicLink && (
        <div className={`mb-6 rounded-xl border p-4 flex items-center justify-between ${magicLink.isExpired ? "bg-red-50 border-red-200" : "bg-[#f5f7f9] border-[#D1D9DF]"}`}>
          <div className="flex items-center gap-3">
            <Link size={16} className={magicLink.isExpired ? "text-red-400" : "text-[#A0B2C2]"} />
            <div>
              <p className="font-heading text-xs text-[#2A384C] uppercase tracking-wider">
                {magicLink.isExpired ? "⚠ Magic Link Expired" : "Seller Magic Link"}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="font-body text-xs text-[#A0B2C2] truncate max-w-md">{magicLink.url}</p>
                <CopyButton text={magicLink.url} />
              </div>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="font-heading text-xs border-[#D1D9DF] flex-shrink-0"
            onClick={() => refreshLinkMutation.mutate({ listingId: id })}
            disabled={refreshLinkMutation.isPending}
          >
            <RefreshCw size={13} className="mr-1" />
            Refresh Link
          </Button>
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="details">
        <TabsList className="bg-white border border-[#D1D9DF] rounded-xl p-1 mb-6 w-full justify-start gap-1">
          {[
            { value: "details", label: "Details", icon: Home },
            { value: "stats", label: "Weekly Stats", icon: BarChart2 },
            { value: "showings", label: "Showings", icon: Users },
            { value: "offers", label: "Offers", icon: FileText },
            { value: "social", label: "Social Media", icon: BarChart2 },
            { value: "email", label: "Email Log", icon: Mail },
          ].map(({ value, label, icon: Icon }) => (
            <TabsTrigger
              key={value}
              value={value}
              className="font-heading text-xs tracking-wide data-[state=active]:bg-[#2A384C] data-[state=active]:text-white rounded-lg px-4 py-2"
            >
              <Icon size={13} className="mr-1.5" />
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* ── Details Tab ── */}
        <TabsContent value="details">
          <div className="space-y-6">
            <section className="bg-white rounded-xl border border-[#D1D9DF] p-6">
              <h3 className="font-heading text-sm font-semibold text-[#2A384C] uppercase tracking-wider mb-4">Property</h3>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { key: "address", label: "Address" },
                  { key: "city", label: "City" },
                  { key: "state", label: "State" },
                  { key: "zip", label: "ZIP" },
                  { key: "mlsNumber", label: "MLS Number" },
                  { key: "listPrice", label: "List Price" },
                ].map(({ key, label }) => (
                  <div key={key}>
                    <Label className="font-heading text-xs text-[#2A384C] uppercase tracking-wider">{label}</Label>
                    <Input
                      value={getField(key as any)}
                      onChange={e => setEditForm(f => ({ ...f, [key]: e.target.value }))}
                      className="mt-1 font-body border-[#D1D9DF]"
                    />
                  </div>
                ))}
                {/* Hero Photo Upload */}
                <div className="col-span-2">
                  <Label className="font-heading text-xs text-[#2A384C] uppercase tracking-wider">Hero Photo</Label>
                  <div className="mt-2 flex items-start gap-4">
                    {getField("heroPhotoUrl") ? (
                      <div className="relative w-40 h-28 rounded-lg overflow-hidden border border-[#D1D9DF] flex-shrink-0">
                        <img src={getField("heroPhotoUrl")} alt="Hero" className="w-full h-full object-cover" />
                        <button
                          onClick={() => setEditForm(f => ({ ...f, heroPhotoUrl: "" }))}
                          className="absolute top-1 right-1 bg-[#2A384C]/70 text-white rounded-full p-0.5 hover:bg-[#2A384C] transition-colors"
                        >
                          <XIcon size={12} />
                        </button>
                      </div>
                    ) : (
                      <div className="w-40 h-28 rounded-lg border-2 border-dashed border-[#D1D9DF] flex items-center justify-center bg-[#f5f7f9] flex-shrink-0">
                        <p className="font-body text-xs text-[#A0B2C2] text-center px-2">No photo yet</p>
                      </div>
                    )}
                    <div className="flex-1 space-y-2">
                      <input ref={heroInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoFile("hero")} />
                      <Button
                        type="button" variant="outline" size="sm"
                        className="font-heading text-xs border-[#D1D9DF] w-full"
                        onClick={() => heroInputRef.current?.click()}
                        disabled={uploadingPhoto === "hero"}
                      >
                        <Upload size={13} className="mr-1.5" />
                        {uploadingPhoto === "hero" ? "Uploading..." : "Upload Photo"}
                      </Button>
                      <p className="font-body text-xs text-[#A0B2C2]">Or paste a URL directly:</p>
                      <Input
                        value={getField("heroPhotoUrl")}
                        onChange={e => setEditForm(f => ({ ...f, heroPhotoUrl: e.target.value }))}
                        placeholder="https://..."
                        className="font-body border-[#D1D9DF] text-xs"
                      />
                    </div>
                  </div>
                </div>
                <div>
                  <Label className="font-heading text-xs text-[#2A384C] uppercase tracking-wider">Status</Label>
                  <Select value={getField("status")} onValueChange={v => setEditForm(f => ({ ...f, status: v }))}>
                    <SelectTrigger className="mt-1 font-body border-[#D1D9DF]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["Active", "Under Contract", "Sold", "Back on Market", "Withdrawn"].map(s => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </section>

            <section className="bg-white rounded-xl border border-[#D1D9DF] p-6">
              <h3 className="font-heading text-sm font-semibold text-[#2A384C] uppercase tracking-wider mb-4">Agent & Seller</h3>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { key: "agentName", label: "Agent Name" },
                  { key: "agentEmail", label: "Agent Email" },
                  { key: "agentPhone", label: "Agent Phone" },
                  { key: "sellerName", label: "Seller Name" },
                  { key: "sellerEmail", label: "Seller Email" },
                  { key: "fubContactId", label: "FUB Contact ID" },
                ].map(({ key, label }) => (
                  <div key={key}>
                    <Label className="font-heading text-xs text-[#2A384C] uppercase tracking-wider">{label}</Label>
                    <Input
                      value={getField(key as any)}
                      onChange={e => setEditForm(f => ({ ...f, [key]: e.target.value }))}
                      className="mt-1 font-body border-[#D1D9DF]"
                    />
                  </div>
                ))}
                {/* Agent Photo Upload */}
                <div className="col-span-2">
                  <Label className="font-heading text-xs text-[#2A384C] uppercase tracking-wider">Agent Photo</Label>
                  <div className="mt-2 flex items-start gap-4">
                    {getField("agentPhotoUrl") ? (
                      <div className="relative w-20 h-20 rounded-full overflow-hidden border border-[#D1D9DF] flex-shrink-0">
                        <img src={getField("agentPhotoUrl")} alt="Agent" className="w-full h-full object-cover" />
                        <button
                          onClick={() => setEditForm(f => ({ ...f, agentPhotoUrl: "" }))}
                          className="absolute top-0 right-0 bg-[#2A384C]/70 text-white rounded-full p-0.5 hover:bg-[#2A384C] transition-colors"
                        >
                          <XIcon size={10} />
                        </button>
                      </div>
                    ) : (
                      <div className="w-20 h-20 rounded-full border-2 border-dashed border-[#D1D9DF] flex items-center justify-center bg-[#f5f7f9] flex-shrink-0">
                        <p className="font-body text-xs text-[#A0B2C2] text-center">No photo</p>
                      </div>
                    )}
                    <div className="flex-1 space-y-2">
                      <input ref={agentInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoFile("agent")} />
                      <Button
                        type="button" variant="outline" size="sm"
                        className="font-heading text-xs border-[#D1D9DF]"
                        onClick={() => agentInputRef.current?.click()}
                        disabled={uploadingPhoto === "agent"}
                      >
                        <Upload size={13} className="mr-1.5" />
                        {uploadingPhoto === "agent" ? "Uploading..." : "Upload Agent Photo"}
                      </Button>
                      <Input
                        value={getField("agentPhotoUrl")}
                        onChange={e => setEditForm(f => ({ ...f, agentPhotoUrl: e.target.value }))}
                        placeholder="https://..."
                        className="font-body border-[#D1D9DF] text-xs"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="bg-white rounded-xl border border-[#D1D9DF] p-6">
              <h3 className="font-heading text-sm font-semibold text-[#2A384C] uppercase tracking-wider mb-4">Weekly Agent Narrative</h3>
              <Textarea
                value={getField("weeklyNarrative")}
                onChange={e => setEditForm(f => ({ ...f, weeklyNarrative: e.target.value }))}
                placeholder="Write a personal message to the seller about this week's marketing activity..."
                rows={5}
                className="font-body border-[#D1D9DF] resize-none"
              />
              <p className="text-xs font-body text-[#A0B2C2] mt-1">Appears in the seller report and email as a personal note from you.</p>
            </section>

            <div className="flex justify-end">
              <Button
                onClick={handleSaveListing}
                disabled={updateMutation.isPending}
                className="bg-[#2A384C] hover:bg-[#1e2a38] text-white font-heading tracking-wide"
              >
                <Save size={15} className="mr-2" />
                {updateMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* ── Weekly Stats Tab ── */}
        <TabsContent value="stats">
          <div className="space-y-6">
            {/* ListTrac Sync Card with Time Period Selector */}
            <section className="bg-gradient-to-br from-[#f5f7f9] to-white rounded-xl border border-[#D1D9DF] p-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-heading text-sm font-semibold text-[#2A384C] uppercase tracking-wider">ListTrac Auto-Sync</h3>
                    <p className="text-xs text-[#A0B2C2] mt-1">Pull views, inquiries, shares, favorites, and virtual tour data</p>
                  </div>
                  <Button
                    onClick={() => {
                      console.log("[UI] Sync button clicked", { id, timePeriod, mlsNumber: data?.listing.mlsNumber });
                      if (!data?.listing.mlsNumber) {
                        toast.error("Please enter an MLS number first.");
                        return;
                      }
                      console.log("[UI] Calling ListTrac sync mutation for listing", id);
                      console.log("[UI] Mutation object:", listTracSyncMutation);
                      console.log("[UI] Mutation mutate method:", listTracSyncMutation.mutate);
                      try {
                        listTracSyncMutation.mutate({ listingId: id });
                      } catch (e) {
                        console.error("[UI] Error calling mutate:", e);
                      }
                    }}
                    disabled={!data?.listing.mlsNumber || listTracSyncMutation.isPending}
                    className="bg-[#2A384C] hover:bg-[#1e2a38] text-white font-heading tracking-wide"
                    title={!data?.listing.mlsNumber ? "Enter MLS number first" : "Sync from ListTrac"}
                  >
                    <RefreshCw size={15} className="mr-2" />
                    {listTracSyncMutation.isPending ? "Syncing..." : "Sync Now"}
                  </Button>
                </div>
                
                {/* Sync All Periods */}
                <p className="text-xs text-[#A0B2C2] mb-2">Syncs all 3 periods (7-day, 30-day, lifetime) at once</p>
              </div>
            </section>
            
            {/* Metrics Summary Cards */}
            {data?.weeklyStats && data.weeklyStats.length > 0 && (
              <>
                <div className="text-xs text-[#A0B2C2] mb-3">
                  {data.weeklyStats[0].dateRangeStart && data.weeklyStats[0].dateRangeEnd ? (
                    <span>
                      Data from {new Date(data.weeklyStats[0].dateRangeStart).toLocaleDateString()} to {new Date(data.weeklyStats[0].dateRangeEnd).toLocaleDateString()}
                    </span>
                  ) : (
                    <span>Week of {new Date(data.weeklyStats[0].weekOf).toLocaleDateString()}</span>
                  )}
                </div>
                <section className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  {[
                    { label: "Views", value: data.weeklyStats[0].listtracViews ?? 0, icon: "👁️" },
                    { label: "Inquiries", value: data.weeklyStats[0].listtracInquiries ?? 0, icon: "💬" },
                    { label: "Shares", value: data.weeklyStats[0].listtracShares ?? 0, icon: "📤" },
                    { label: "Favorites", value: data.weeklyStats[0].listtracFavorites ?? 0, icon: "⭐" },
                    { label: "VTours", value: data.weeklyStats[0].listtracVTourViews ?? 0, icon: "🎬" },
                  ].map(({ label, value, icon }) => (
                    <div key={label} className="bg-white rounded-lg border border-[#D1D9DF] p-4 text-center">
                      <div className="text-2xl mb-2">{icon}</div>
                      <div className="text-2xl font-heading font-bold text-[#2A384C]">{value.toLocaleString()}</div>
                      <div className="text-xs text-[#A0B2C2] uppercase tracking-wider mt-1">{label}</div>
                    </div>
                  ))}
                </section>
              </>
            )}
            {data?.weeklyStats && data.weeklyStats.length === 0 && (
              <div className="bg-[#f5f7f9] rounded-xl border border-[#D1D9DF] p-6 text-center">
                <p className="text-sm text-[#A0B2C2]">No ListTrac data synced yet. Click "Sync Now" above to pull metrics.</p>
              </div>
            )}



            {/* History */}
            {weeklyStats.length > 0 && (() => {
              // Get records by syncPeriod (new logic uses syncPeriod field)
              const period7day = weeklyStats.find(s => s.syncPeriod === '7day');
              const period30day = weeklyStats.find(s => s.syncPeriod === '30day');
              const periodLifetime = weeklyStats.find(s => s.syncPeriod === 'lifetime');
              
              const periods = [
                { label: 'Last 7 Days', data: period7day },
                { label: 'Last 30 Days', data: period30day },
                { label: 'Life of Listing', data: periodLifetime }
              ].filter(p => p.data);
              
              return (
                <section className="bg-white rounded-xl border border-[#D1D9DF] p-6">
                  <h3 className="font-heading text-sm font-semibold text-[#2A384C] uppercase tracking-wider mb-4">Sync History</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm font-body">
                      <thead>
                        <tr className="border-b border-[#D1D9DF]">
                          {["Period", "Zillow", "Realtor", "MLS", "OneHome", "Trulia", "Other", "Total"].map(h => (
                            <th key={h} className="text-left py-2 pr-4 text-xs font-heading text-[#A0B2C2] uppercase tracking-wider">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {periods.map(period => {
                          const s = period.data!;
                          const total = (s.zillowListtracViews ?? 0) + (s.realtorListtracViews ?? 0) + (s.mlsListtracViews ?? 0) + (s.oneHomeListtracViews ?? 0) + (s.truliaListtracViews ?? 0) + (s.otherSourcesListtracViews ?? 0);
                          return (
                            <tr key={`${period.label}-${s.id}`} className="border-b border-[#f5f7f9] hover:bg-[#f5f7f9]">
                              <td className="py-2 pr-4 text-[#2A384C] font-semibold">{period.label}</td>
                              <td className="py-2 pr-4 text-[#2A384C]">{(s.zillowListtracViews ?? 0).toLocaleString()}</td>
                              <td className="py-2 pr-4 text-[#2A384C]">{(s.realtorListtracViews ?? 0).toLocaleString()}</td>
                              <td className="py-2 pr-4 text-[#2A384C]">{(s.mlsListtracViews ?? 0).toLocaleString()}</td>
                              <td className="py-2 pr-4 text-[#2A384C]">{(s.oneHomeListtracViews ?? 0).toLocaleString()}</td>
                              <td className="py-2 pr-4 text-[#2A384C]">{(s.truliaListtracViews ?? 0).toLocaleString()}</td>
                              <td className="py-2 pr-4 text-[#2A384C]">{(s.otherSourcesListtracViews ?? 0).toLocaleString()}</td>
                              <td className="py-2 pr-4 text-[#2A384C] font-semibold">{total.toLocaleString()}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>
              );
            })()}
          </div>
        </TabsContent>

        {/* ── Showings Tab ── */}
        <TabsContent value="showings">
          <div className="space-y-6">
            {showingRequests && showingRequests.length > 0 && (
            <section className="bg-white rounded-xl border border-[#D1D9DF] p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-heading text-sm font-semibold text-[#2A384C] uppercase tracking-wider">ShowingTime Requests ({showingRequests.length})</h3>
                <Button
                  onClick={() => syncShowingTimeEmailsMutation.mutate()}
                  disabled={syncShowingTimeEmailsMutation.isPending}
                  size="sm"
                  className="bg-[#2A384C] hover:bg-[#1e2a38] text-white font-heading tracking-wide"
                >
                  <RefreshCw size={14} className="mr-2" />
                  {syncShowingTimeEmailsMutation.isPending ? "Syncing..." : "Sync Emails"}
                </Button>
              </div>
                <div className="space-y-3">
                  {showingRequests.map((req: any) => (
                    <div key={req.id} className="flex items-start justify-between p-4 bg-[#f5f7f9] rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-heading text-sm text-[#2A384C]">{req.timeSlot}</p>
                          <span className={`text-xs font-semibold px-2 py-1 rounded ${
                            req.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                            req.status === 'rescheduled' ? 'bg-blue-100 text-blue-800' :
                            req.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>
                            {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                          </span>
                        </div>
                        {req.buyerName && <p className="font-body text-xs text-[#A0B2C2]">Buyer: {req.buyerName}</p>}
                        {req.listingAgent && <p className="font-body text-xs text-[#A0B2C2]">Agent: {req.listingAgent}</p>}
                        {req.feedback && <p className="font-body text-xs text-[#2A384C] mt-1 italic">Feedback: \"{req.feedback}\"</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
            
            <section className="bg-white rounded-xl border border-[#D1D9DF] p-6">
              <h3 className="font-heading text-sm font-semibold text-[#2A384C] uppercase tracking-wider mb-4">Log a Showing</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="font-heading text-xs text-[#2A384C] uppercase tracking-wider">Showing Date</Label>
                  <Input type="date" value={showingForm.showingDate} onChange={e => setShowingForm(f => ({ ...f, showingDate: e.target.value }))} className="mt-1 font-body border-[#D1D9DF]" />
                </div>
                <div>
                  <Label className="font-heading text-xs text-[#2A384C] uppercase tracking-wider">Buyer Agent Name</Label>
                  <Input value={showingForm.buyerAgentName} onChange={e => setShowingForm(f => ({ ...f, buyerAgentName: e.target.value }))} placeholder="Agent name" className="mt-1 font-body border-[#D1D9DF]" />
                </div>
                <div>
                  <Label className="font-heading text-xs text-[#2A384C] uppercase tracking-wider">Star Rating (1–5)</Label>
                  <Input type="number" min="1" max="5" value={showingForm.starRating} onChange={e => setShowingForm(f => ({ ...f, starRating: e.target.value }))} placeholder="4" className="mt-1 font-body border-[#D1D9DF]" />
                </div>
                <div className="col-span-2">
                  <Label className="font-heading text-xs text-[#2A384C] uppercase tracking-wider">Feedback Summary</Label>
                  <Textarea value={showingForm.feedbackSummary} onChange={e => setShowingForm(f => ({ ...f, feedbackSummary: e.target.value }))} placeholder="Buyer feedback..." rows={3} className="mt-1 font-body border-[#D1D9DF] resize-none" />
                </div>
              </div>
              <div className="flex justify-end mt-4">
                <Button
                  onClick={() => {
                    createShowingMutation.mutate({
                      listingId: id,
                      showingDate: new Date(showingForm.showingDate + "T12:00:00"),
                      buyerAgentName: showingForm.buyerAgentName || undefined,
                      feedbackSummary: showingForm.feedbackSummary || undefined,
                      starRating: showingForm.starRating ? parseInt(showingForm.starRating) : undefined,
                    });
                    setShowingForm({ showingDate: format(new Date(), "yyyy-MM-dd"), buyerAgentName: "", feedbackSummary: "", starRating: "" });
                  }}
                  disabled={createShowingMutation.isPending}
                  className="bg-[#2A384C] hover:bg-[#1e2a38] text-white font-heading tracking-wide"
                >
                  <Plus size={15} className="mr-2" />
                  Log Showing
                </Button>
              </div>
            </section>

            {showings.length > 0 && (
              <section className="bg-white rounded-xl border border-[#D1D9DF] p-6">
                <h3 className="font-heading text-sm font-semibold text-[#2A384C] uppercase tracking-wider mb-4">Showing History ({showings.length})</h3>
                <div className="space-y-3">
                  {showings.map(s => (
                    <div key={s.id} className="flex items-start justify-between p-4 bg-[#f5f7f9] rounded-lg">
                      <div>
                        <p className="font-heading text-sm text-[#2A384C]">{format(new Date(s.showingDate), "MMMM d, yyyy")}</p>
                        {s.buyerAgentName && <p className="font-body text-xs text-[#A0B2C2] mt-0.5">Agent: {s.buyerAgentName}</p>}
                        {s.starRating && <p className="font-body text-xs text-[#A0B2C2]">Rating: {"★".repeat(s.starRating)}{"☆".repeat(5 - s.starRating)}</p>}
                        {s.feedbackSummary && <p className="font-body text-xs text-[#2A384C] mt-1 italic">"{s.feedbackSummary}"</p>}
                      </div>
                      <button onClick={() => deleteShowingMutation.mutate({ id: s.id })} className="text-[#A0B2C2] hover:text-red-500 transition-colors ml-4">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </TabsContent>

        {/* ── Offers Tab ── */}
        <TabsContent value="offers">
          <div className="space-y-6">
            <section className="bg-white rounded-xl border border-[#D1D9DF] p-6">
              <h3 className="font-heading text-sm font-semibold text-[#2A384C] uppercase tracking-wider mb-4">Log an Offer</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="font-heading text-xs text-[#2A384C] uppercase tracking-wider">Offer Date</Label>
                  <Input type="date" value={offerForm.offerDate} onChange={e => setOfferForm(f => ({ ...f, offerDate: e.target.value }))} className="mt-1 font-body border-[#D1D9DF]" />
                </div>
                <div>
                  <Label className="font-heading text-xs text-[#2A384C] uppercase tracking-wider">Offer Price</Label>
                  <Input value={offerForm.offerPrice} onChange={e => setOfferForm(f => ({ ...f, offerPrice: e.target.value }))} placeholder="$445,000" className="mt-1 font-body border-[#D1D9DF]" />
                </div>
                <div>
                  <Label className="font-heading text-xs text-[#2A384C] uppercase tracking-wider">Status</Label>
                  <Select value={offerForm.status} onValueChange={v => setOfferForm(f => ({ ...f, status: v }))}>
                    <SelectTrigger className="mt-1 font-body border-[#D1D9DF]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["Active", "Countered", "Declined", "Accepted", "Expired"].map(s => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <Label className="font-heading text-xs text-[#2A384C] uppercase tracking-wider">Notes</Label>
                  <Textarea value={offerForm.notes} onChange={e => setOfferForm(f => ({ ...f, notes: e.target.value }))} placeholder="Offer notes..." rows={3} className="mt-1 font-body border-[#D1D9DF] resize-none" />
                </div>
              </div>
              <div className="flex justify-end mt-4">
                <Button
                  onClick={() => {
                    createOfferMutation.mutate({
                      listingId: id,
                      offerDate: new Date(offerForm.offerDate + "T12:00:00"),
                      offerPrice: offerForm.offerPrice || undefined,
                      status: offerForm.status as any,
                      notes: offerForm.notes || undefined,
                    });
                    setOfferForm({ offerDate: format(new Date(), "yyyy-MM-dd"), offerPrice: "", status: "Active", notes: "" });
                  }}
                  disabled={createOfferMutation.isPending}
                  className="bg-[#2A384C] hover:bg-[#1e2a38] text-white font-heading tracking-wide"
                >
                  <Plus size={15} className="mr-2" />
                  Log Offer
                </Button>
              </div>
            </section>

            {offers.length > 0 && (
              <section className="bg-white rounded-xl border border-[#D1D9DF] p-6">
                <h3 className="font-heading text-sm font-semibold text-[#2A384C] uppercase tracking-wider mb-4">Offer History ({offers.length})</h3>
                <div className="space-y-3">
                  {offers.map(o => (
                    <div key={o.id} className="flex items-start justify-between p-4 bg-[#f5f7f9] rounded-lg">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-heading text-sm text-[#2A384C]">{o.offerPrice ?? "Price undisclosed"}</p>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-heading ${
                            o.status === "Accepted" ? "bg-[#D1D9DF] text-[#2A384C]" :
                            o.status === "Declined" ? "bg-[#2A384C] text-[#A0B2C2]" :
                            o.status === "Countered" ? "bg-[#4A6080] text-white" :
                            "bg-gray-100 text-gray-600"
                          }`}>{o.status}</span>
                        </div>
                        <p className="font-body text-xs text-[#A0B2C2] mt-0.5">{format(new Date(o.offerDate), "MMMM d, yyyy")}</p>
                        {o.notes && <p className="font-body text-xs text-[#2A384C] mt-1 italic">"{o.notes}"</p>}
                      </div>
                      <button onClick={() => deleteOfferMutation.mutate({ id: o.id })} className="text-[#A0B2C2] hover:text-red-500 transition-colors ml-4">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </TabsContent>

        {/* ── Social Media Tab ── */}
        <TabsContent value="social">
          <div className="space-y-6">
            <section className="bg-white rounded-xl border border-[#D1D9DF] p-6">
              <h3 className="font-heading text-sm font-semibold text-[#2A384C] uppercase tracking-wider mb-4">Add Social Post</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="font-heading text-xs text-[#2A384C] uppercase tracking-wider">Platform</Label>
                  <Select value={socialForm.platform} onValueChange={v => setSocialForm(f => ({ ...f, platform: v }))}>
                    <SelectTrigger className="mt-1 font-body border-[#D1D9DF]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["Instagram", "Facebook", "TikTok", "YouTube", "LinkedIn", "Twitter", "Other"].map(p => (
                        <SelectItem key={p} value={p}>{p}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="font-heading text-xs text-[#2A384C] uppercase tracking-wider">Posted Date</Label>
                  <Input type="date" value={socialForm.postedAt} onChange={e => setSocialForm(f => ({ ...f, postedAt: e.target.value }))} className="mt-1 font-body border-[#D1D9DF]" />
                </div>
                <div className="col-span-2">
                  <Label className="font-heading text-xs text-[#2A384C] uppercase tracking-wider">Post URL</Label>
                  <Input value={socialForm.postUrl} onChange={e => setSocialForm(f => ({ ...f, postUrl: e.target.value }))} placeholder="https://instagram.com/p/..." className="mt-1 font-body border-[#D1D9DF]" />
                </div>
                {[
                  { key: "impressions", label: "Impressions" },
                  { key: "reach", label: "Reach" },
                  { key: "linkClicks", label: "Link Clicks" },
                  { key: "videoViews", label: "Video Views" },
                ].map(({ key, label }) => (
                  <div key={key}>
                    <Label className="font-heading text-xs text-[#2A384C] uppercase tracking-wider">{label}</Label>
                    <Input
                      type="number"
                      min="0"
                      value={(socialForm as any)[key]}
                      onChange={e => setSocialForm(f => ({ ...f, [key]: e.target.value }))}
                      className="mt-1 font-body border-[#D1D9DF]"
                    />
                  </div>
                ))}
              </div>
              <div className="flex justify-end mt-4">
                <Button
                  onClick={() => {
                    createSocialMutation.mutate({
                      listingId: id,
                      platform: socialForm.platform as any,
                      postUrl: socialForm.postUrl || undefined,
                      impressions: parseInt(socialForm.impressions) || 0,
                      reach: parseInt(socialForm.reach) || 0,
                      linkClicks: parseInt(socialForm.linkClicks) || 0,
                      videoViews: parseInt(socialForm.videoViews) || 0,
                      postedAt: new Date(socialForm.postedAt + "T12:00:00"),
                    });
                    setSocialForm({ platform: "Instagram", postUrl: "", impressions: "0", reach: "0", linkClicks: "0", videoViews: "0", postedAt: format(new Date(), "yyyy-MM-dd") });
                  }}
                  disabled={createSocialMutation.isPending}
                  className="bg-[#2A384C] hover:bg-[#1e2a38] text-white font-heading tracking-wide"
                >
                  <Plus size={15} className="mr-2" />
                  Add Post
                </Button>
              </div>
            </section>

            {socialPosts.length > 0 && (
              <section className="bg-white rounded-xl border border-[#D1D9DF] p-6">
                <h3 className="font-heading text-sm font-semibold text-[#2A384C] uppercase tracking-wider mb-4">Social Posts ({socialPosts.length})</h3>
                <div className="space-y-3">
                  {socialPosts.map(p => (
                    <div key={p.id} className="flex items-center justify-between p-4 bg-[#f5f7f9] rounded-lg">
                      <div className="flex items-center gap-4">
                        <span className="font-heading text-xs bg-[#2A384C] text-white px-2 py-1 rounded">{p.platform}</span>
                        <div>
                          <p className="font-body text-xs text-[#A0B2C2]">{p.postedAt ? format(new Date(p.postedAt), "MMM d, yyyy") : "—"}</p>
                          <div className="flex gap-3 mt-0.5 text-xs font-body text-[#2A384C]">
                            <span>{(p.impressions ?? 0).toLocaleString()} impressions</span>
                            <span>{(p.reach ?? 0).toLocaleString()} reach</span>
                            {p.videoViews ? <span>{p.videoViews.toLocaleString()} views</span> : null}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {p.postUrl && (
                          <a href={p.postUrl} target="_blank" rel="noopener noreferrer" className="text-[#A0B2C2] hover:text-[#2A384C]">
                            <ExternalLink size={14} />
                          </a>
                        )}
                        <button onClick={() => deleteSocialMutation.mutate({ id: p.id })} className="text-[#A0B2C2] hover:text-red-500 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </TabsContent>

        {/* ── Email Log Tab ── */}
        <TabsContent value="email">
          <section className="bg-white rounded-xl border border-[#D1D9DF] p-6">
            <h3 className="font-heading text-sm font-semibold text-[#2A384C] uppercase tracking-wider mb-4">Email Delivery Log</h3>
            {!emailLog || emailLog.length === 0 ? (
              <p className="font-body text-[#A0B2C2] text-sm text-center py-8">No emails sent yet for this listing.</p>
            ) : (
              <div className="space-y-2">
                {emailLog.map(log => (
                  <div key={log.id} className="flex items-center justify-between p-3 bg-[#f5f7f9] rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        log.status === "sent" ? "bg-[#A0B2C2]" :
                        log.status === "failed" ? "bg-red-500" :
                        "bg-gray-400"
                      }`} />
                      <div>
                        <p className="font-heading text-xs text-[#2A384C] capitalize">{log.status}</p>
                        {log.fubEventId && <p className="font-body text-xs text-[#A0B2C2]">FUB Event: {log.fubEventId}</p>}
                        {log.errorMessage && <p className="font-body text-xs text-red-500">{log.errorMessage}</p>}
                      </div>
                    </div>
                    <p className="font-body text-xs text-[#A0B2C2]">{format(new Date(log.sentAt), "MMM d, yyyy h:mm a")}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </TabsContent>
      </Tabs>
    </div>
  );
}
