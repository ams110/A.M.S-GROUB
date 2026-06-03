"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

function LoginRedirect() {
  const router = useRouter();
  const params = useSearchParams();
  const redirect = params.get("redirect");

  useEffect(() => {
    router.replace(redirect ? `/?redirect=${encodeURIComponent(redirect)}` : "/");
  }, [router, redirect]);

  return null;
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginRedirect />
    </Suspense>
  );
}
