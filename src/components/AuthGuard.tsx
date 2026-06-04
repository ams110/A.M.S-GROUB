"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useProfile } from "@/lib/auth";
import Header from "@/components/Header";
import CommandPalette from "@/components/CommandPalette";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

// Routes that don't require authentication
const PUBLIC_PATHS = ["/", "/login"];

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { ready, userId } = useProfile();

  const isPublic = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname === p + "/" || pathname.startsWith(p + "?")
  );
  const isAuthenticated = !!userId;

  useEffect(() => {
    if (!ready) return;
    if (!isAuthenticated && !isPublic) {
      router.replace(`/?redirect=${encodeURIComponent(pathname)}`);
    }
    if (isAuthenticated && isPublic) {
      router.replace("/welcome");
    }
  }, [ready, isAuthenticated, isPublic, pathname, router]);

  // Login page: full-screen, no chrome.
  // If auth just completed (redirect in-flight), show a dark overlay so there's
  // no white flash between the form disappearing and the next page mounting.
  if (isPublic) {
    if (ready && isAuthenticated) {
      return <div className="fixed inset-0 bg-navy-dark" style={{ zIndex: 9999 }} />;
    }
    return <>{children}</>;
  }

  // Still checking auth state
  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-onyx-gradient">
        <div className="text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`${basePath}/logo.svg?v=2`}
            alt="Â.M.Ŝ GROUP"
            className="mx-auto mb-4 h-16 w-16 rounded-2xl ring-2 ring-gold/50 shadow-gold animate-pulse"
          />
          <p className="text-sm text-gold/70">טוען…</p>
        </div>
      </div>
    );
  }

  // Not authenticated — redirect in progress, render nothing
  if (!isAuthenticated) {
    return null;
  }

  // Authenticated: render full app shell
  return (
    <>
      <Header />
      <CommandPalette />
      <main className="min-h-[calc(100vh-4rem)] pb-28 md:pb-0">{children}</main>
      <footer className="bg-onyx-gradient pb-6 text-center text-sm text-white/40 print:hidden">
        <div className="h-px w-full hairline-gold" />
        <div className="container-app pt-6">
          <span className="text-gradient-gold font-semibold">Â.M.Ŝ GROUP</span> — פורטל סיטונאי ליבואן הרשמי · © {new Date().getFullYear()}
        </div>
      </footer>
    </>
  );
}
