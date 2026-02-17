"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import api from "@/lib/axios";

export default function OpenAISettingsPage() {
  const params = useParams();
  const router = useRouter();
  const websiteId = params.website_id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [isConfigured, setIsConfigured] = useState(false);

  // State for the Per-Member Spend Limit
  const [spendLimit, setSpendLimit] = useState<string>("0.10");

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await api.get(`/builder/websites/${websiteId}`);
        if (res.data.openai_api_key) {
          setApiKey("sk-.......................................");
          setIsConfigured(true);
        }
        if (
          res.data.member_ai_spend_limit_usd !== undefined &&
          res.data.member_ai_spend_limit_usd !== null
        ) {
          setSpendLimit(Number(res.data.member_ai_spend_limit_usd).toFixed(2));
        }
      } catch (err) {
        console.error("Failed to load AI settings", err);
      } finally {
        setLoading(false);
      }
    };

    if (websiteId) {
      fetchSettings();
    }
  }, [websiteId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    const payload: any = {
      member_ai_spend_limit_usd: parseFloat(spendLimit) || 0.1,
    };

    // Only send the API key to the backend if they actually typed a new one
    if (apiKey && !apiKey.startsWith("sk-......")) {
      if (!apiKey.startsWith("sk-")) {
        alert("Invalid API Key format. OpenAI keys usually start with 'sk-'");
        return;
      }
      payload.openai_api_key = apiKey.trim();
    }

    setSaving(true);
    try {
      await api.put(`/builder/websites/${websiteId}/openai-key`, payload);
      alert("AI Settings saved successfully!");
      if (payload.openai_api_key) {
        setIsConfigured(true);
        setApiKey("sk-.......................................");
      }
    } catch (err: any) {
      console.error(err);
      alert(
        `Failed to save settings: ${err.response?.data?.detail || "Unknown error"}`,
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (
      !confirm(
        "Are you sure you want to remove your OpenAI API key? AI features on your live site will stop working immediately.",
      )
    )
      return;

    setSaving(true);
    try {
      await api.put(`/builder/websites/${websiteId}/openai-key`, {
        openai_api_key: "", // Sending an empty string triggers deletion in our backend
        member_ai_spend_limit_usd: parseFloat(spendLimit),
      });
      alert("OpenAI API Key removed.");
      setIsConfigured(false);
      setApiKey("");
    } catch (err: any) {
      console.error(err);
      alert("Failed to remove key.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-50">
        <p className="text-gray-500 font-medium animate-pulse">
          Loading AI Settings...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto">
        {/* Navigation Bar */}
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={() => router.push(`/builder/${websiteId}`)}
            className="text-gray-600 hover:text-gray-900 flex items-center gap-2 font-medium transition-colors"
          >
            ← Back to Builder
          </button>
          <h1 className="text-2xl font-bold text-gray-900">AI Integration</h1>
        </div>

        {/* Status Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-6">
          <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                OpenAI Configuration
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Power your website's AI features using your own OpenAI API key.
              </p>
            </div>
            {isConfigured ? (
              <span className="px-3 py-1 rounded-full bg-green-100 text-green-700 text-sm font-semibold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-green-500"></span>{" "}
                Active
              </span>
            ) : (
              <span className="px-3 py-1 rounded-full bg-yellow-100 text-yellow-700 text-sm font-semibold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-yellow-500"></span>{" "}
                Setup Required
              </span>
            )}
          </div>

          <div className="p-6">
            <form onSubmit={handleSave} className="space-y-6">
              {/* API Key Input */}
              <div className="bg-blue-50 border border-blue-100 p-4 rounded-lg mb-2">
                <h4 className="font-semibold text-blue-900 text-sm mb-1">
                  Bring Your Own Key (BYOK)
                </h4>
                <p className="text-blue-800 text-xs leading-relaxed">
                  To keep your platform costs low and scalable, all AI
                  generations on your live site are billed directly to your
                  OpenAI account.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Secret API Key
                </label>
                <input
                  type="text"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-proj-..."
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all font-mono text-sm"
                  required={!isConfigured}
                />
                <p className="text-xs text-gray-500 mt-2">
                  Your API key is securely encrypted. You can generate a new key
                  from your{" "}
                  <a
                    href="https://platform.openai.com/api-keys"
                    target="_blank"
                    className="text-purple-600 hover:underline font-medium"
                  >
                    OpenAI Developer Dashboard
                  </a>
                  .
                </p>
              </div>

              <hr className="border-gray-100" />

              {/* Spend Limit Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  User Spend Limit (USD)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 sm:text-sm">$</span>
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={spendLimit}
                    onChange={(e) => setSpendLimit(e.target.value)}
                    className="w-full pl-7 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all"
                    required
                  />
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Protect your API budget. Set the maximum dollar amount of AI
                  processing a <b>single free user</b> can consume on your site
                  before they are blocked. (Note: $0.10 is roughly enough for
                  ~60 full-page generations using gpt-4o-mini).
                </p>
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-100">
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-gray-900 hover:bg-black text-white font-bold py-2.5 px-6 rounded-lg disabled:bg-gray-400 transition-colors flex-1 shadow-sm"
                >
                  {saving ? "Saving..." : "Save Configuration"}
                </button>

                {isConfigured && (
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={saving}
                    className="bg-red-50 hover:bg-red-100 text-red-600 font-bold py-2.5 px-6 rounded-lg transition-colors border border-red-200"
                  >
                    Remove Key
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
