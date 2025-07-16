"use client";

import Link from "next/link";
import { Mail, ArrowLeft } from "lucide-react";
import { useState } from "react";
import AuthForm from "@/components/AuthForm";

export default function RegisterPage() {
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white shadow-lg rounded-lg p-8 w-full max-w-md">
        {!showForm && (
          <>
            <h2 className="text-2xl font-bold text-center text-gray-800 mb-8">
              Create an Account
            </h2>

            <button
              onClick={() => setShowForm(true)}
              className="w-full flex items-center justify-center border border-gray-300 rounded px-4 py-3 hover:bg-gray-100 transition-colors"
            >
              <Mail className="w-5 h-5 text-gray-600 mr-2" />
              <span className="text-gray-700 font-medium">
                Sign Up With Email
              </span>
            </button>

            <p className="mt-6 text-center text-gray-600">
              Already have an account?{" "}
              <Link
                href="/login"
                className="text-pink-600 font-semibold hover:underline"
              >
                Login
              </Link>
            </p>
          </>
        )}

        {showForm && (
          <>
            <AuthForm type="register" />

            <button
              onClick={() => setShowForm(false)}
              className="mt-4 w-full flex items-center justify-center text-gray-600 hover:text-pink-600 transition-colors"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              <span>Back</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
}
