"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import api from "@/lib/axios";

export default function ConfirmEmailPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const email = searchParams.get("email") || "";
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await api.post("/auth/confirm", {
        email,
        code,
      });

      setSuccess(true);
      router.push("/login");
    } catch (err: any) {
      let message = "Failed to confirm email";

      if (err.response?.data?.detail) {
        message = err.response.data.detail;
      } else if (Array.isArray(err.response?.data)) {
        // FastAPI validation error response
        message = err.response.data.map((e: any) => e.msg).join(", ");
      }

      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white shadow-lg rounded-lg p-8 w-full max-w-md">
        <h2 className="text-2xl font-bold text-center text-gray-800 mb-6">
          Confirm Your Email
        </h2>

        {!success ? (
          <>
            <p className="text-gray-600 text-center mb-4">
              We’ve sent a code to{" "}
              <span className="font-semibold">{email}</span>. Please enter it
              below to confirm your account.
            </p>

            {error && <p className="text-red-600 text-center mb-4">{error}</p>}

            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-pink-500"
              placeholder="Enter your code"
            />

            <button
              onClick={handleConfirm}
              className="w-full bg-pink-500 text-white font-bold py-2 rounded hover:bg-pink-600 transition-colors"
              disabled={loading}
            >
              {loading ? "Confirming..." : "Confirm Email"}
            </button>
          </>
        ) : (
          <p className="text-green-600 text-center font-medium">
            Your email has been confirmed!
          </p>
        )}
      </div>
    </div>
  );
}
