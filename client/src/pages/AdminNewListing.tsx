import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLocation } from "wouter";
import { ArrowLeft, Save } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function AdminNewListing() {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const createMutation = trpc.listings.create.useMutation({
    onSuccess: () => {
      toast.success("Listing created! Magic link generated automatically.");
      utils.listings.list.invalidate();
      navigate("/admin");
    },
    onError: (err) => toast.error(err.message),
  });

  const [form, setForm] = useState({
    address: "",
    city: "",
    state: "NC",
    zip: "",
    mlsNumber: "",
    listPrice: "",
    status: "Active" as const,
    agentName: "",
    agentEmail: "",
    agentPhone: "",
    sellerName: "",
    sellerEmail: "",
    fubContactId: "",
    heroPhotoUrl: "",
  });

  const set = (key: string, value: string) => setForm(f => ({ ...f, [key]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.address.trim()) {
      toast.error("Property address is required.");
      return;
    }
    createMutation.mutate({
      ...form,
      status: form.status as any,
      heroPhotoUrl: form.heroPhotoUrl || undefined,
      fubContactId: form.fubContactId || undefined,
    });
  };

  return (
    <div className="p-8 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <button onClick={() => navigate("/admin")} className="text-[#A0B2C2] hover:text-[#2A384C] transition-colors">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="font-heading text-2xl font-semibold text-[#2A384C]">New Listing</h1>
          <p className="font-body text-[#A0B2C2] text-sm mt-0.5">A magic link will be auto-generated for the seller.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Property Details */}
        <section className="bg-white rounded-xl border border-[#D1D9DF] p-6">
          <h2 className="font-heading text-sm font-semibold text-[#2A384C] uppercase tracking-wider mb-4">Property Details</h2>
          <div className="grid gap-4">
            <div>
              <Label className="font-heading text-xs text-[#2A384C] uppercase tracking-wider">Street Address *</Label>
              <Input
                value={form.address}
                onChange={e => set("address", e.target.value)}
                placeholder="123 Main Street"
                className="mt-1 font-body border-[#D1D9DF] focus:border-[#2A384C]"
                required
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-1">
                <Label className="font-heading text-xs text-[#2A384C] uppercase tracking-wider">City</Label>
                <Input value={form.city} onChange={e => set("city", e.target.value)} placeholder="Charlotte" className="mt-1 font-body border-[#D1D9DF]" />
              </div>
              <div>
                <Label className="font-heading text-xs text-[#2A384C] uppercase tracking-wider">State</Label>
                <Input value={form.state} onChange={e => set("state", e.target.value)} placeholder="NC" className="mt-1 font-body border-[#D1D9DF]" />
              </div>
              <div>
                <Label className="font-heading text-xs text-[#2A384C] uppercase tracking-wider">ZIP</Label>
                <Input value={form.zip} onChange={e => set("zip", e.target.value)} placeholder="28277" className="mt-1 font-body border-[#D1D9DF]" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="font-heading text-xs text-[#2A384C] uppercase tracking-wider">MLS Number</Label>
                <Input value={form.mlsNumber} onChange={e => set("mlsNumber", e.target.value)} placeholder="CAR1234567" className="mt-1 font-body border-[#D1D9DF]" />
              </div>
              <div>
                <Label className="font-heading text-xs text-[#2A384C] uppercase tracking-wider">List Price</Label>
                <Input value={form.listPrice} onChange={e => set("listPrice", e.target.value)} placeholder="$450,000" className="mt-1 font-body border-[#D1D9DF]" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="font-heading text-xs text-[#2A384C] uppercase tracking-wider">Status</Label>
                <Select value={form.status} onValueChange={v => set("status", v)}>
                  <SelectTrigger className="mt-1 font-body border-[#D1D9DF]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["Active", "Under Contract", "Sold", "Back on Market", "Withdrawn"].map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="font-heading text-xs text-[#2A384C] uppercase tracking-wider">Hero Photo URL</Label>
                <Input value={form.heroPhotoUrl} onChange={e => set("heroPhotoUrl", e.target.value)} placeholder="https://..." className="mt-1 font-body border-[#D1D9DF]" />
              </div>
            </div>
          </div>
        </section>

        {/* Agent Info */}
        <section className="bg-white rounded-xl border border-[#D1D9DF] p-6">
          <h2 className="font-heading text-sm font-semibold text-[#2A384C] uppercase tracking-wider mb-4">Agent Information</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="font-heading text-xs text-[#2A384C] uppercase tracking-wider">Agent Name</Label>
              <Input value={form.agentName} onChange={e => set("agentName", e.target.value)} placeholder="Brian McCarron" className="mt-1 font-body border-[#D1D9DF]" />
            </div>
            <div>
              <Label className="font-heading text-xs text-[#2A384C] uppercase tracking-wider">Agent Email</Label>
              <Input value={form.agentEmail} onChange={e => set("agentEmail", e.target.value)} placeholder="brian@homegrownpropertygroup.com" className="mt-1 font-body border-[#D1D9DF]" />
            </div>
            <div>
              <Label className="font-heading text-xs text-[#2A384C] uppercase tracking-wider">Agent Phone</Label>
              <Input value={form.agentPhone} onChange={e => set("agentPhone", e.target.value)} placeholder="(704) 555-0100" className="mt-1 font-body border-[#D1D9DF]" />
            </div>
          </div>
        </section>

        {/* Seller Info */}
        <section className="bg-white rounded-xl border border-[#D1D9DF] p-6">
          <h2 className="font-heading text-sm font-semibold text-[#2A384C] uppercase tracking-wider mb-4">Seller & CRM</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="font-heading text-xs text-[#2A384C] uppercase tracking-wider">Seller Name</Label>
              <Input value={form.sellerName} onChange={e => set("sellerName", e.target.value)} placeholder="John & Jane Doe" className="mt-1 font-body border-[#D1D9DF]" />
            </div>
            <div>
              <Label className="font-heading text-xs text-[#2A384C] uppercase tracking-wider">Seller Email</Label>
              <Input value={form.sellerEmail} onChange={e => set("sellerEmail", e.target.value)} placeholder="seller@email.com" className="mt-1 font-body border-[#D1D9DF]" />
            </div>
            <div className="col-span-2">
              <Label className="font-heading text-xs text-[#2A384C] uppercase tracking-wider">Follow Up Boss Contact ID</Label>
              <Input value={form.fubContactId} onChange={e => set("fubContactId", e.target.value)} placeholder="FUB person ID for weekly report events" className="mt-1 font-body border-[#D1D9DF]" />
              <p className="text-xs font-body text-[#A0B2C2] mt-1">Required for automated weekly email delivery via FUB Action Plans.</p>
            </div>
          </div>
        </section>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => navigate("/admin")} className="font-heading border-[#D1D9DF]">
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={createMutation.isPending}
            className="bg-[#2A384C] hover:bg-[#1e2a38] text-white font-heading tracking-wide"
          >
            <Save size={16} className="mr-2" />
            {createMutation.isPending ? "Creating..." : "Create Listing"}
          </Button>
        </div>
      </form>
    </div>
  );
}
