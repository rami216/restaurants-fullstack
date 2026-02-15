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

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        // Fetch the current settings using your existing endpoint
        const res = await api.get(`/builder/websites/${websiteId}`);
        if (res.data.openai_api_key) {
          // We don't display the full key for security, just show a placeholder if it exists
          setApiKey("sk-.......................................");
          setIsConfigured(true);
        }
      } catch (err) {
        console.error("Failed to load OpenAI settings", err);
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

    // Don't save if they are just submitting the placeholder text
    if (apiKey.startsWith("sk-......")) {
      alert(
        "Please enter a new key, or click Back if you don't want to change it.",
      );
      return;
    }

    if (!apiKey.startsWith("sk-")) {
      alert("Invalid API Key format. OpenAI keys usually start with 'sk-'");
      return;
    }

    setSaving(true);
    try {
      await api.put(`/builder/websites/${websiteId}/openai-key`, {
        openai_api_key: apiKey,
      });
      alert("OpenAI API Key saved successfully!");
      setIsConfigured(true);
      setApiKey("sk-.......................................");
    } catch (err: any) {
      console.error(err);
      alert(
        `Failed to save key: ${err.response?.data?.detail || "Unknown error"}`,
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (
      !confirm(
        "Are you sure you want to remove your OpenAI API key? AI features on your site will stop working.",
      )
    )
      return;

    setSaving(true);
    try {
      await api.put(`/builder/websites/${websiteId}/openai-key`, {
        openai_api_key: null,
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
        <p className="text-gray-500 font-medium">Loading OpenAI Settings...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto">
        {/* Navigation Bar */}
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={() => router.push("/createwebsite")}
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
                Connect your OpenAI account to unlock AI generation features on
                your live site.
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
            <form onSubmit={handleSave} className="space-y-4">
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
                  required
                />
                <p className="text-xs text-gray-500 mt-2">
                  Your API key is securely encrypted and never exposed to the
                  public frontend. You can get your key from the{" "}
                  <a
                    href="https://platform.openai.com/api-keys"
                    target="_blank"
                    className="text-purple-600 hover:underline"
                  >
                    OpenAI Developer Dashboard
                  </a>
                  .
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2.5 px-6 rounded-lg disabled:bg-purple-400 transition-colors flex-1"
                >
                  {saving
                    ? "Saving..."
                    : isConfigured
                      ? "Update API Key"
                      : "Connect OpenAI"}
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
