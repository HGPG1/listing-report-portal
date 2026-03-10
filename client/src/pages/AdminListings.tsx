import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";
import { PlusCircle, MapPin, Calendar, Eye, MessageCircle, Share2, Star, Film, Archive } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { trpc } from "@/lib/trpc";

const STATUS_COLORS: Record<string, string> = {
  "Active": "bg-[#2A384C] text-white",
  "Under Contract": "bg-[#A0B2C2] text-[#2A384C]",
  "Sold": "bg-[#D1D9DF] text-[#2A384C]",
  "Back on Market": "bg-[#4A6080] text-white",
  "Withdrawn": "bg-gray-100 text-gray-600",
};

export default function AdminListings() {
  const [, navigate] = useLocation();
  const [showArchived, setShowArchived] = useState(false);
  const { data: listings, isLoading, error } = trpc.listings.list.useQuery();
  const { data: allStats } = trpc.listings.getAllWithStats.useQuery();
  const syncAllMutation = trpc.listtrac.syncAll.useMutation();
  const autoSyncMutation = trpc.listtrac.autoSync.useMutation();
  const utils = trpc.useUtils();

  const handleSyncAll = async (daysBack: number = 7) => {
    try {
      console.log("[AdminListings] Sync button clicked, calling mutation...");
      await syncAllMutation.mutateAsync({ daysBack });
      console.log("[AdminListings] Mutation completed successfully");
      const label = daysBack === -1 ? "all-time" : `${daysBack}-day`;
      toast.success(`All listings synced (${label}) from ListTrac`);
      // Refetch all stats after sync
      await utils.listings.getAllWithStats.refetch();
    } catch (error) {
      console.error("[AdminListings] Sync failed:", error);
      toast.error("Sync failed: " + (error instanceof Error ? error.message : "Unknown error"));
    }
  };

  const handleAutoSync = async () => {
    try {
      console.log("[AdminListings] Auto-sync button clicked...");
      const result = await autoSyncMutation.mutateAsync();
      toast.success(`Auto-sync complete: +${result.added} added, ~${result.updated} updated, ~${result.archived} archived`);
      // Refetch listings to show new ones
      await utils.listings.list.refetch();
      await utils.listings.getAllWithStats.refetch();
    } catch (error) {
      console.error("[AdminListings] Auto-sync failed:", error);
      toast.error("Auto-sync failed: " + (error instanceof Error ? error.message : "Unknown error"));
    }
  };

  // Filter listings based on archive view
  const activeListings = listings?.filter((l: any) => !l.isArchived) ?? [];
  const archivedListings = listings?.filter((l: any) => l.isArchived) ?? [];
  const displayListings = showArchived ? archivedListings : activeListings;

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 bg-white rounded-xl border border-[#D1D9DF]" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <p className="text-red-700 font-body">Failed to load listings. Please refresh.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-[#2A384C]">
            {showArchived ? "Archived Listings" : "Active Listings"}
          </h1>
          <p className="font-body text-[#A0B2C2] text-sm mt-1">
            {displayListings.length} listing{displayListings.length !== 1 ? "s" : ""} {showArchived ? "archived" : "active"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            className="bg-[#4A6080] hover:bg-[#3A5070] text-white font-heading tracking-wide"
            onClick={handleAutoSync}
            disabled={autoSyncMutation.isPending}
            title="Discover new listings from ListTrac and archive off-market ones"
          >
            {autoSyncMutation.isPending ? "Discovering..." : "Auto-Sync from ListTrac"}
          </Button>
          <Button
            className="bg-[#4A6080] hover:bg-[#3A5070] text-white font-heading tracking-wide"
            onClick={() => handleSyncAll(7)}
            disabled={syncAllMutation.isPending}
          >
            {syncAllMutation.isPending ? "Syncing..." : "Sync Metrics"}
          </Button>
          <Button
            className="bg-[#4A6080] hover:bg-[#3A5070] text-white font-heading tracking-wide"
            onClick={() => handleSyncAll(-1)}
            disabled={syncAllMutation.isPending}
            title="Sync all-time data for all listings"
          >
            {syncAllMutation.isPending ? "Syncing..." : "Sync All Time"}
          </Button>
          {archivedListings.length > 0 && (
            <Button
              variant="outline"
              className="border-[#D1D9DF] text-[#2A384C] font-heading tracking-wide"
              onClick={() => setShowArchived(!showArchived)}
            >
              <Archive size={16} className="mr-2" />
              {showArchived ? "Active" : "Archived"} ({showArchived ? archivedListings.length : activeListings.length})
            </Button>
          )}
          <Button
            className="bg-[#2A384C] hover:bg-[#1e2a38] text-white font-heading tracking-wide"
            onClick={() => navigate("/admin/listings/new")}
          >
            <PlusCircle size={16} className="mr-2" />
            New Listing
          </Button>
        </div>
      </div>

      {/* Empty state */}
      {(!displayListings || displayListings.length === 0) && (
        <div className="text-center py-20 bg-white rounded-xl border border-[#D1D9DF]">
          <div className="w-16 h-16 rounded-full bg-[#f5f7f9] flex items-center justify-center mx-auto mb-4">
            <MapPin size={24} className="text-[#A0B2C2]" />
          </div>
          <h2 className="font-heading text-lg font-semibold text-[#2A384C] mb-2">
            {showArchived ? "No archived listings" : "No active listings yet"}
          </h2>
          <p className="font-body text-[#A0B2C2] text-sm mb-6">
            {showArchived ? "Listings you archive will appear here." : "Create your first listing or use Auto-Sync to discover listings from ListTrac."}
          </p>
          {!showArchived && (
            <Button
              className="bg-[#2A384C] hover:bg-[#1e2a38] text-white font-heading tracking-wide"
              onClick={handleAutoSync}
              disabled={autoSyncMutation.isPending}
            >
              <Archive size={16} className="mr-2" />
              {autoSyncMutation.isPending ? "Discovering..." : "Discover from ListTrac"}
            </Button>
          )}
        </div>
      )}

      {/* Listings grid */}
      <div className="grid gap-4">
        {displayListings.map((listing: any) => (
          <div
            key={listing.id}
            className="bg-white rounded-xl border border-[#D1D9DF] p-6 hover:border-[#A0B2C2] hover:shadow-sm transition-all cursor-pointer"
            onClick={() => navigate(`/admin/listings/${listing.id}`)}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex gap-4 items-start">
                {/* Hero photo or placeholder */}
                <div className="w-20 h-16 rounded-lg bg-[#f5f7f9] border border-[#D1D9DF] flex-shrink-0 overflow-hidden">
                  {listing.heroPhotoUrl ? (
                    <img src={listing.heroPhotoUrl} alt={listing.address} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <MapPin size={20} className="text-[#A0B2C2]" />
                    </div>
                  )}
                </div>

                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="font-heading text-base font-semibold text-[#2A384C]">{listing.address}</h2>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-heading ${STATUS_COLORS[listing.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {listing.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm font-body text-[#A0B2C2]">
                    {listing.mlsNumber && <span>MLS# {listing.mlsNumber}</span>}
                    {listing.listPrice && <span className="text-[#2A384C] font-semibold">{listing.listPrice}</span>}
                    {listing.sellerName && <span>Seller: {listing.sellerName}</span>}
                  </div>
                  {listing.listDate && (
                    <div className="flex items-center gap-1 mt-1 text-xs font-body text-[#A0B2C2]">
                      <Calendar size={12} />
                      Listed {new Date(listing.listDate).toLocaleDateString()}
                    </div>
                  )}
                  
                  {/* ListTrac Metrics */}
                  {allStats && allStats.find((s: any) => s.id === listing.id)?.weeklyStats?.[0] && (
                    <div className="flex items-center gap-4 mt-3 pt-3 border-t border-[#D1D9DF]">
                      <div className="flex items-center gap-1 text-xs font-body">
                        <Eye size={14} className="text-[#2A384C]" />
                        <span className="text-[#2A384C] font-semibold">{allStats.find((s: any) => s.id === listing.id)?.weeklyStats?.[0]?.listtracViews ?? 0}</span>
                        <span className="text-[#A0B2C2]">views</span>
                      </div>
                      <div className="flex items-center gap-1 text-xs font-body">
                        <MessageCircle size={14} className="text-[#2A384C]" />
                        <span className="text-[#2A384C] font-semibold">{allStats.find((s: any) => s.id === listing.id)?.weeklyStats?.[0]?.listtracInquiries ?? 0}</span>
                        <span className="text-[#A0B2C2]">inquiries</span>
                      </div>
                      <div className="flex items-center gap-1 text-xs font-body">
                        <Share2 size={14} className="text-[#2A384C]" />
                        <span className="text-[#2A384C] font-semibold">{allStats.find((s: any) => s.id === listing.id)?.weeklyStats?.[0]?.listtracShares ?? 0}</span>
                        <span className="text-[#A0B2C2]">shares</span>
                      </div>
                      <div className="flex items-center gap-1 text-xs font-body">
                        <Star size={14} className="text-[#2A384C]" />
                        <span className="text-[#2A384C] font-semibold">{allStats.find((s: any) => s.id === listing.id)?.weeklyStats?.[0]?.listtracFavorites ?? 0}</span>
                        <span className="text-[#A0B2C2]">favorites</span>
                      </div>
                      <div className="flex items-center gap-1 text-xs font-body">
                        <Film size={14} className="text-[#2A384C]" />
                        <span className="text-[#2A384C] font-semibold">{allStats.find((s: any) => s.id === listing.id)?.weeklyStats?.[0]?.listtracVTourViews ?? 0}</span>
                        <span className="text-[#A0B2C2]">vtours</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                {listing.isArchived && (
                  <Badge className="bg-gray-200 text-gray-700 font-heading text-xs">
                    <Archive size={12} className="mr-1" />
                    Archived
                  </Badge>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="text-[#2A384C] border-[#D1D9DF] font-heading text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/admin/listings/${listing.id}`);
                  }}
                >
                  <Eye size={14} className="mr-1" />
                  Manage
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
