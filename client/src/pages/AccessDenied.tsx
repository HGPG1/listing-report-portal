import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ShieldX } from "lucide-react";

export default function AccessDenied() {
  const [, navigate] = useLocation();
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f5f7f9]">
      <div className="text-center max-w-sm mx-auto p-8">
        <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
          <ShieldX size={28} className="text-red-400" />
        </div>
        <h1 className="font-heading text-xl font-semibold text-[#2A384C] mb-2">Access Restricted</h1>
        <p className="font-body text-[#A0B2C2] text-sm mb-6">
          This portal is restricted to Home Grown Property Group team members.
        </p>
        <Button variant="outline" className="font-heading border-[#D1D9DF]" onClick={() => navigate("/")}>
          Return Home
        </Button>
      </div>
    </div>
  );
}
