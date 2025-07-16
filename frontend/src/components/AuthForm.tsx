"use client";

import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

type AuthFormProps = {
  type: "login" | "register";
};

export default function AuthForm({ type }: AuthFormProps) {
  const { login, register } = useAuth();
  const router = useRouter();

  const [userName, setUserName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (type === "login") {
        await login(email, password);
        console.log("Login successful!");
        router.push("/main");
        // optionally redirect to dashboard
      } else {
        await register(userName, email, password);

        console.log("Register successful!");
        router.push(`/confirm-email?email=${encodeURIComponent(email)}`);
      }
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white p-8 rounded shadow max-w-md w-full mx-auto space-y-4"
    >
      <h2 className="text-2xl font-bold text-center text-gray-800">
        {type === "login" ? "Login" : "Register"}
      </h2>

      {error && <p className="text-red-600 text-center text-sm">{error}</p>}

      {type === "register" && (
        <div>
          <label className="block mb-1 text-gray-700">Name</label>
          <input
            type="text"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pink-500"
            placeholder="Your name"
            required
          />
        </div>
      )}

      <div>
        <label className="block mb-1 text-gray-700">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pink-500"
          placeholder="you@example.com"
          required
        />
      </div>

      <div>
        <label className="block mb-1 text-gray-700">Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pink-500"
          placeholder="••••••••"
          required
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-pink-500 text-white font-bold py-2 rounded hover:bg-pink-600 transition-colors disabled:opacity-50"
      >
        {loading
          ? type === "login"
            ? "Logging in..."
            : "Registering..."
          : type === "login"
          ? "Login"
          : "Register"}
      </button>
    </form>
  );
}
