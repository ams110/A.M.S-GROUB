"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useProfile } from "@/lib/auth";
import Header from "@/components/Header";

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
      <div className="flex min-h-screen items-center justify-center bg-navy-dark">
        <div className="text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`${basePath}/logo.svg`}
            alt="Â.M.Ŝ GROUP"
            className="mx-auto mb-4 h-16 w-16 rounded-2xl animate-pulse"
          />
          <p className="text-white/50 text-sm">טוען…</p>
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
      <main className="min-h-[calc(100vh-4rem)] pb-16 md:pb-0">{children}</main>
      <footer className="border-t border-navy/10 bg-navy-dark py-6 text-center text-sm text-white/40 print:hidden">
        <div className="container-app">
          Â.M.Ŝ GROUP — פורטל סיטונאי ליבואן הרשמי · © {new Date().getFullYear()}
        </div>
      </footer>
    </>
  );
}
