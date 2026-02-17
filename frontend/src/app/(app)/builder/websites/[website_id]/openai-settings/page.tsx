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
  const [spendLimit, setSpendLimit] = useState<string>("0.10");

  // State to hold our analytics data
  const [analytics, setAnalytics] = useState<any>(null);

  useEffect(() => {
    const fetchSettingsAndAnalytics = async () => {
      try {
        // 1. Fetch Settings
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

        // 2. Fetch Analytics
        const analyticsRes = await api.get(
          `/builder/websites/${websiteId}/ai-analytics`,
        );
        setAnalytics(analyticsRes.data);
      } catch (err) {
        console.error("Failed to load AI settings or analytics", err);
      } finally {
        setLoading(false);
      }
    };

    if (websiteId) {
      fetchSettingsAndAnalytics();
    }
  }, [websiteId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: any = {
      member_ai_spend_limit_usd: parseFloat(spendLimit) || 0.1,
    };

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
        openai_api_key: "",
        member_ai_spend_limit_usd: parseFloat(spendLimit),
      });
      alert("OpenAI API Key removed.");
      setIsConfigured(false);
      setApiKey("");
    } catch (err: any) {
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
      <div className="max-w-5xl mx-auto">
        {/* Navigation Bar */}
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={() => router.push(`/builder/${websiteId}`)}
            className="text-gray-600 hover:text-gray-900 flex items-center gap-2 font-medium transition-colors"
          >
            ← Back to Builder
          </button>
          <h1 className="text-2xl font-bold text-gray-900">
            AI Integration & Analytics
          </h1>
        </div>

        {/* --- GRID SPLIT --- */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* LEFT COLUMN: Settings Form */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-6">
              <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                <h2 className="text-lg font-semibold text-gray-900">
                  Configuration
                </h2>
                {isConfigured ? (
                  <span className="px-2 py-1 rounded-full bg-green-100 text-green-700 text-xs font-semibold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>{" "}
                    Active
                  </span>
                ) : (
                  <span className="px-2 py-1 rounded-full bg-yellow-100 text-yellow-700 text-xs font-semibold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-yellow-500"></span>{" "}
                    Setup Required
                  </span>
                )}
              </div>

              <div className="p-5">
                <form onSubmit={handleSave} className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Secret API Key
                    </label>
                    <input
                      type="text"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="sk-proj-..."
                      className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none font-mono text-sm"
                      required={!isConfigured}
                    />
                  </div>
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
                        className="w-full pl-7 p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                        required
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button
                      type="submit"
                      disabled={saving}
                      className="bg-gray-900 hover:bg-black text-white font-medium py-2 px-4 rounded-lg flex-1 text-sm"
                    >
                      {saving ? "Saving..." : "Save"}
                    </button>
                    {isConfigured && (
                      <button
                        type="button"
                        onClick={handleDelete}
                        disabled={saving}
                        className="bg-red-50 hover:bg-red-100 text-red-600 font-medium py-2 px-4 rounded-lg text-sm border border-red-200"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </form>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Analytics Dashboard */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-5 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                <h2 className="text-lg font-semibold text-gray-900">
                  Member Usage Analytics
                </h2>
              </div>

              <div className="p-5">
                {/* Total Stats Row */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="p-4 bg-purple-50 rounded-lg border border-purple-100">
                    <p className="text-purple-600 text-xs font-bold uppercase tracking-wider mb-1">
                      Total API Spend
                    </p>
                    <h3 className="text-2xl font-black text-purple-900">
                      ${analytics?.total_spend_usd?.toFixed(3) || "0.000"}
                    </h3>
                  </div>
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                    <p className="text-blue-600 text-xs font-bold uppercase tracking-wider mb-1">
                      Total AI Calls
                    </p>
                    <h3 className="text-2xl font-black text-blue-900">
                      {analytics?.total_calls || 0}
                    </h3>
                  </div>
                </div>

                {/* User Table */}
                <h3 className="text-sm font-bold text-gray-900 mb-3 uppercase tracking-wider">
                  Top Users
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 text-gray-600">
                      <tr>
                        <th className="p-3 font-semibold rounded-tl-lg">
                          Member
                        </th>
                        <th className="p-3 font-semibold">AI Calls</th>
                        <th className="p-3 font-semibold text-right rounded-tr-lg">
                          Spend (USD)
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {analytics?.users?.length > 0 ? (
                        analytics.users.map((u: any) => (
                          <tr
                            key={u.member_id}
                            className="hover:bg-gray-50 transition-colors"
                          >
                            <td className="p-3">
                              {/* Show Name/Email prominently */}
                              <div
                                className="font-semibold text-gray-900 truncate max-w-[200px]"
                                title={u.email}
                              >
                                {u.name || u.email || "Unknown User"}
                              </div>
                              <div className="font-mono text-[10px] text-gray-400 mt-0.5">
                                {u.member_id.split("-")[0]}...
                              </div>
                            </td>
                            <td className="p-3 text-gray-700 font-medium">
                              {u.ai_calls_count}
                            </td>
                            <td className="p-3 text-right font-bold text-gray-900">
                              ${u.ai_spend_usd.toFixed(4)}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td
                            colSpan={3}
                            className="p-6 text-center text-gray-400"
                          >
                            No users have generated AI content yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
