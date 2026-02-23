import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";
import { PlusCircle, MapPin, Calendar, Eye } from "lucide-react";
import { toast } from "sonner";

const STATUS_COLORS: Record<string, string> = {
  "Active": "bg-[#2A384C] text-white",
  "Under Contract": "bg-[#A0B2C2] text-[#2A384C]",
  "Sold": "bg-[#D1D9DF] text-[#2A384C]",
  "Back on Market": "bg-[#4A6080] text-white",
  "Withdrawn": "bg-gray-100 text-gray-600",
};

export default function AdminListings() {
  const [, navigate] = useLocation();
  const { data: listings, isLoading, error } = trpc.listings.list.useQuery();

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
          <h1 className="font-heading text-2xl font-semibold text-[#2A384C]">Active Listings</h1>
          <p className="font-body text-[#A0B2C2] text-sm mt-1">
            {listings?.length ?? 0} listing{listings?.length !== 1 ? "s" : ""} total
          </p>
        </div>
        <Button
          className="bg-[#2A384C] hover:bg-[#1e2a38] text-white font-heading tracking-wide"
          onClick={() => navigate("/admin/listings/new")}
        >
          <PlusCircle size={16} className="mr-2" />
          New Listing
        </Button>
      </div>

      {/* Empty state */}
      {(!listings || listings.length === 0) && (
        <div className="text-center py-20 bg-white rounded-xl border border-[#D1D9DF]">
          <div className="w-16 h-16 rounded-full bg-[#f5f7f9] flex items-center justify-center mx-auto mb-4">
            <MapPin size={24} className="text-[#A0B2C2]" />
          </div>
          <h2 className="font-heading text-lg font-semibold text-[#2A384C] mb-2">No listings yet</h2>
          <p className="font-body text-[#A0B2C2] text-sm mb-6">Create your first listing to start sending weekly reports.</p>
          <Button
            className="bg-[#2A384C] hover:bg-[#1e2a38] text-white font-heading tracking-wide"
            onClick={() => navigate("/admin/listings/new")}
          >
            <PlusCircle size={16} className="mr-2" />
            Create First Listing
          </Button>
        </div>
      )}

      {/* Listings grid */}
      <div className="grid gap-4">
        {listings?.map(listing => (
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

                <div>
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
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
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
