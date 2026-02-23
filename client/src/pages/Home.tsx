import { useEffect } from "react";
import { useLocation } from "wouter";

export default function Home() {
  const [, navigate] = useLocation();
  useEffect(() => { navigate("/admin"); }, []);
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f5f7f9]">
      <div className="w-8 h-8 border-2 border-[#2A384C] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
