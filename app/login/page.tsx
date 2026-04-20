import { AccessCodeForm } from "@/components/forms/AccessCodeForm";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Login · Vestaboard",
};

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-neutral-950">
      {/* Background glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(99,102,241,0.12) 0%, transparent 70%)",
        }}
      />
      {/* Grid texture */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />
      <div className="relative z-10 w-full">
        <AccessCodeForm />
      </div>
    </main>
  );
}
