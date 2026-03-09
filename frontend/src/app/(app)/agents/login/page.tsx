"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  GoogleOAuthProvider,
  GoogleLogin,
  CredentialResponse,
} from "@react-oauth/google";

export default function AgentsLoginWrapper() {
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";
  return (
    <GoogleOAuthProvider clientId={googleClientId}>
      <AgentsLoginPage />
    </GoogleOAuthProvider>
  );
}

function AgentsLoginPage() {
  const { googleLogin } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleGoogleSuccess = async (cr: CredentialResponse) => {
    if (!cr.credential) return;
    setLoading(true);
    try {
      await googleLogin(cr.credential);
      router.push("/agents");
    } catch {
      alert("Sign-in failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-4">
      {/* Background grid */}
      <div
        className="fixed inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(#00ff88 1px, transparent 1px), linear-gradient(90deg, #00ff88 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      {/* Glow */}
      <div className="fixed top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#00ff88] opacity-[0.04] rounded-full blur-[120px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-[#00ff88] flex items-center justify-center">
              <span className="text-black font-black text-sm">Z</span>
            </div>
            <span className="text-white font-bold text-xl tracking-tight">
              zygoflow
            </span>
            <span className="text-[#00ff88] text-xs font-mono border border-[#00ff88]/30 px-2 py-0.5 rounded-full">
              agents
            </span>
          </div>
          <p className="text-gray-500 text-sm font-mono">
            AI automation platform
          </p>
        </div>

        {/* Card */}
        <div className="bg-[#111118] border border-white/[0.06] rounded-2xl p-8">
          <h1 className="text-white font-semibold text-lg mb-1">
            Sign in to Agents
          </h1>
          <p className="text-gray-500 text-sm mb-8">
            Build and run AI pipelines in the cloud
          </p>

          {loading ? (
            <div className="flex items-center justify-center py-4 gap-3">
              <div className="w-4 h-4 border-2 border-[#00ff88] border-t-transparent rounded-full animate-spin" />
              <span className="text-gray-400 text-sm font-mono">
                Signing in...
              </span>
            </div>
          ) : (
            <div className="flex justify-center">
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={() => alert("Google Sign-In failed.")}
                useOneTap
                theme="filled_black"
                shape="pill"
                size="large"
                text="continue_with"
              />
            </div>
          )}

          <div className="mt-8 pt-6 border-t border-white/[0.06]">
            <div className="grid grid-cols-3 gap-3 text-center">
              {["Webhooks", "Pipelines", "Google"].map((f) => (
                <div key={f} className="text-center">
                  <div className="text-[#00ff88] text-xs font-mono mb-1">✓</div>
                  <div className="text-gray-600 text-xs">{f}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <p className="text-center text-gray-600 text-xs mt-6">
          Looking for the{" "}
          <a href="/login" className="text-gray-400 hover:text-white transition-colors underline underline-offset-2">
            website builder?
          </a>
        </p>
      </div>
    </div>
  );
}
