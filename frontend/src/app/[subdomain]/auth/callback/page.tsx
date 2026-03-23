// src/app/[subdomain]/auth/callback/page.tsx
"use client";
import { useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense } from "react";

function CallbackInner() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const token = searchParams.get("token");
    const memberId = searchParams.get("member_id");
    const email = searchParams.get("email");

    // ✅ Extract the exact subdomain we passed from the backend URL
    const exactSubdomain = searchParams.get("subdomain");

    // Only save if we have everything, including the explicit subdomain
    if (token && memberId && email && exactSubdomain) {
      localStorage.setItem(`siteToken:${exactSubdomain}`, token);
      localStorage.setItem(`siteMemberId:${exactSubdomain}`, memberId);
      localStorage.setItem(
        `siteMemberEmail:${exactSubdomain}`,
        decodeURIComponent(email),
      );
    }

    // ✅ Smart Redirect: Handle both custom domains and main Zygoflow preview links
    const isMainHost =
      window.location.hostname === "zygoflow.com" ||
      window.location.hostname === "www.zygoflow.com";

    if (isMainHost && exactSubdomain) {
      // Send back to the preview subdomain path
      router.push(`/${exactSubdomain}`);
    } else {
      // Custom domain, send straight to root homepage
      router.push(`/`);
    }
  }, [router, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-500">Signing you in...</p>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<div />}>
      <CallbackInner />
    </Suspense>
  );
}
