"use client";

import Link from "next/link";
import { Mail, ArrowLeft } from "lucide-react";
import { useState } from "react";
import AuthForm from "@/components/AuthForm";
import {
  GoogleOAuthProvider,
  GoogleLogin,
  CredentialResponse,
} from "@react-oauth/google";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
// The main component that will be rendered
export default function LoginPageWrapper() {
  // Get your Google Client ID from environment variables
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";

  if (!googleClientId) {
    console.error("Google Client ID is not configured.");
    // You can render a disabled state or an error message
    return <p>Google Login is not configured.</p>;
  }

  return (
    <GoogleOAuthProvider clientId={googleClientId}>
      <LoginPage />
    </GoogleOAuthProvider>
  );
}

// The actual login page logic
function LoginPage() {
  const [showForm, setShowForm] = useState(false);
  const { googleLogin } = useAuth();
  const router = useRouter();

  const handleGoogleSuccess = async (
    credentialResponse: CredentialResponse
  ) => {
    if (credentialResponse.credential) {
      try {
        await googleLogin(credentialResponse.credential);
        router.push("/main"); // Redirect to dashboard on successful login
      } catch (error) {
        console.error(error);
        alert("Google Sign-In failed. Please try again.");
      }
    }
  };

  const handleGoogleError = () => {
    console.error("Google Sign-In was unsuccessful.");
    alert("An error occurred during Google Sign-In.");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white shadow-lg rounded-lg p-8 w-full max-w-md">
        {!showForm ? (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-center text-gray-800 mb-4">
              Welcome
            </h2>

            {/* Google Sign-In Button */}
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={handleGoogleError}
              useOneTap
            />

            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-gray-300"></div>
              <span className="flex-shrink mx-4 text-gray-400">Or</span>
              <div className="flex-grow border-t border-gray-300"></div>
            </div>

            <button
              onClick={() => setShowForm(true)}
              className="w-full flex items-center justify-center border border-gray-300 rounded px-4 py-3 hover:bg-gray-100 transition-colors"
            >
              <Mail className="w-5 h-5 text-gray-600 mr-2" />
              <span className="text-gray-700 font-medium">
                Continue with Email
              </span>
            </button>

            <p className="mt-6 text-center text-gray-600">
              Don&apos;t have an account?{" "}
              <Link
                href="/register"
                className="text-pink-600 font-semibold hover:underline"
              >
                Sign Up
              </Link>
            </p>
          </div>
        ) : (
          <>
            <AuthForm type="login" />
            <button
              onClick={() => setShowForm(false)}
              className="mt-4 w-full flex items-center justify-center text-gray-600 hover:text-pink-600 transition-colors"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              <span>Back to login options</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
}
