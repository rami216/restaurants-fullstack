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

    // Get subdomain from the URL path
    const pathParts = window.location.pathname.split("/").filter(Boolean);
    const subdomain = pathParts[0];

    if (token && memberId && email) {
      localStorage.setItem(`siteToken:${subdomain}`, token);
      localStorage.setItem(`siteMemberId:${subdomain}`, memberId);
      localStorage.setItem(
        `siteMemberEmail:${subdomain}`,
        decodeURIComponent(email),
      );
    }

    // Redirect to home
    router.push(`/${subdomain}`);
  }, []);

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
