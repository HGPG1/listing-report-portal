import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { BarChart3, List, LogOut, PlusCircle, Menu, X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useState, useEffect } from "react";

interface AdminLayoutProps {
  children: React.ReactNode;
}

const NAV_ITEMS = [
  { label: "Listings", href: "/admin", icon: List },
  { label: "New Listing", href: "/admin/listings/new", icon: PlusCircle },
  { label: "Analytics", href: "/admin/analytics", icon: BarChart3 },
];

// CDN logo URLs
const LOGO_DARK = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663289350630/lUoPAFTNBufcYnNy.png";
const LOGO_LIGHT = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663289350630/KxcFJasvLAobGPpE.png";

export default function AdminLayout({ children }: AdminLayoutProps) {
  const { user, loading, isAuthenticated } = useAuth();
  const [location, navigate] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => { window.location.href = "/"; },
  });

  // Close sidebar on route change
  useEffect(() => {
    setSidebarOpen(false);
  }, [location]);

  // Prevent body scroll when sidebar is open on mobile
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [sidebarOpen]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#2A384C" }}>
        <div className="text-center">
          <img src={LOGO_DARK} alt="Home Grown Property Group" className="h-16 mx-auto mb-6 opacity-80" />
          <div className="w-8 h-8 border-2 border-[#A0B2C2] border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f5f7f9] px-4">
        <div className="text-center w-full max-w-sm mx-auto p-8">
          <img src={LOGO_LIGHT} alt="Home Grown Property Group" className="h-20 mx-auto mb-6" />
          <h1 className="font-heading text-2xl font-semibold text-[#2A384C] mb-2">Admin Portal</h1>
          <p className="font-body text-[#A0B2C2] mb-6 text-sm">Sign in to access the listing marketing dashboard.</p>
          <Button
            className="w-full bg-[#2A384C] hover:bg-[#1e2a38] text-[#F0F0F0] font-heading tracking-wide"
            onClick={() => { window.location.href = getLoginUrl(); }}
          >
            Sign In
          </Button>
        </div>
      </div>
    );
  }

  // Role check
  const email = user?.email ?? "";
  const isApproved = email === "brianmccarron@gmail.com" || email.endsWith("@homegrownpropertygroup.com") || user?.role === "admin";
  if (!isApproved) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f5f7f9] px-4">
        <div className="text-center w-full max-w-sm mx-auto p-8">
          <img src={LOGO_LIGHT} alt="Home Grown Property Group" className="h-20 mx-auto mb-6" />
          <h1 className="font-heading text-xl font-semibold text-[#2A384C] mb-3">Access Restricted</h1>
          <p className="font-body text-[#A0B2C2] text-sm mb-6">
            Access is restricted to Home Grown Property Group team members.<br />
            Signed in as: <strong>{email}</strong>
          </p>
          <Button variant="outline" onClick={() => logoutMutation.mutate()}>Sign Out</Button>
        </div>
      </div>
    );
  }

  const SidebarContent = () => (
    <>
      {/* Logo */}
      <div className="p-5 border-b border-[rgba(160,178,194,0.15)] flex items-center justify-between">
        <img src={LOGO_DARK} alt="Home Grown Property Group" className="h-12 w-auto" />
        {/* Close button — mobile only */}
        <button
          onClick={() => setSidebarOpen(false)}
          className="md:hidden text-[#A0B2C2] hover:text-white p-1 rounded transition-colors"
          aria-label="Close menu"
        >
          <X size={20} />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-4 space-y-1">
        {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
          const isActive = location === href || (href !== "/admin" && location.startsWith(href));
          return (
            <button
              key={href}
              onClick={() => navigate(href)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-heading tracking-wide transition-colors ${
                isActive
                  ? "bg-[rgba(160,178,194,0.2)] text-[#F0F0F0]"
                  : "text-[#A0B2C2] hover:bg-[rgba(160,178,194,0.1)] hover:text-[#F0F0F0]"
              }`}
            >
              <Icon size={16} />
              {label}
            </button>
          );
        })}
      </nav>

      {/* User + Logout */}
      <div className="p-4 border-t border-[rgba(160,178,194,0.15)]">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-[#A0B2C2] flex items-center justify-center text-[#2A384C] text-xs font-heading font-bold flex-shrink-0">
            {user?.name?.charAt(0)?.toUpperCase() ?? "A"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[#F0F0F0] text-xs font-heading truncate">{user?.name ?? "Admin"}</p>
            <p className="text-[#A0B2C2] text-xs truncate">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={() => logoutMutation.mutate()}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[#A0B2C2] hover:text-[#F0F0F0] hover:bg-[rgba(160,178,194,0.1)] text-xs font-heading tracking-wide transition-colors"
        >
          <LogOut size={14} />
          Sign Out
        </button>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen bg-[#f5f7f9]">

      {/* ── Desktop sidebar (always visible ≥ md) ─────────────────────────── */}
      <aside
        className="hidden md:flex w-64 flex-shrink-0 flex-col"
        style={{ backgroundColor: "#2A384C" }}
      >
        <SidebarContent />
      </aside>

      {/* ── Mobile overlay backdrop ────────────────────────────────────────── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Mobile slide-out drawer ────────────────────────────────────────── */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-72 flex flex-col
          transform transition-transform duration-300 ease-in-out
          md:hidden
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
        `}
        style={{ backgroundColor: "#2A384C" }}
      >
        <SidebarContent />
      </aside>

      {/* ── Main content area ──────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Mobile top bar */}
        <header className="md:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-[#D1D9DF] sticky top-0 z-30">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg text-[#2A384C] hover:bg-[#f5f7f9] transition-colors"
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>
          <img src={LOGO_LIGHT} alt="Home Grown Property Group" className="h-8 w-auto" />
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
