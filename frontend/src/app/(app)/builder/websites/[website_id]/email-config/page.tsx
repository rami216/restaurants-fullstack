"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import api from "@/lib/axios";
import {
  ArrowLeft,
  Save,
  Mail,
  AlertCircle,
  CheckCircle,
  Server,
  Key,
} from "lucide-react";

interface EmailConfig {
  provider_type: "smtp" | "sendgrid";
  // SMTP Fields
  smtp_host?: string;
  smtp_port?: number;
  smtp_user?: string;
  smtp_password?: string;
  smtp_secure?: boolean; // true for 465, false for 587 usually
  // SendGrid Fields
  sendgrid_api_key?: string;
  // Common Fields
  from_email: string;
  from_name: string;
}

export default function EmailConfigPage() {
  const router = useRouter();
  const params = useParams(); // ✅ Correct way to get params in client component
  // Safely extract the ID and ensure it is treated as a string
  // Match the folder name [website_id] from your screenshot
  const websiteId = Array.isArray(params?.website_id)
    ? params?.website_id[0]
    : params?.website_id;

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [testStatus, setTestStatus] = useState<
    "idle" | "testing" | "success" | "error"
  >("idle");
  const [message, setMessage] = useState("");

  const [config, setConfig] = useState<EmailConfig>({
    provider_type: "smtp",
    smtp_host: "",
    smtp_port: 587,
    smtp_user: "",
    smtp_password: "",
    smtp_secure: false,
    sendgrid_api_key: "",
    from_email: "",
    from_name: "",
  });

  // Fetch existing config on load
  useEffect(() => {
    if (!websiteId) return; // Don't run if ID is missing

    const fetchConfig = async () => {
      try {
        const { data } = await api.get(
          `/builder/websites/${websiteId}/email-config`,
        );
        if (data) {
          // Merge defaults with saved data to prevent null errors
          setConfig((prev) => ({ ...prev, ...data }));
        }
      } catch (error) {
        // It's okay if 404 (no config yet), otherwise log error
        console.log("No existing email config found or fetch error.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchConfig();
  }, [websiteId]);

  const handleChange = (field: keyof EmailConfig, value: any) => {
    setConfig((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!websiteId) {
      setMessage("Error: Website ID is missing.");
      setTestStatus("error");
      return;
    }

    setIsSaving(true);
    setTestStatus("idle");
    setMessage("");

    try {
      await api.put(`/builder/websites/${websiteId}/email-config`, config);
      setMessage("Configuration saved successfully!");
      setTestStatus("success");
      // Optional: Add a timeout to hide the success message or redirect
      setTimeout(() => setTestStatus("idle"), 3000);
    } catch (error: any) {
      console.error(error);
      setTestStatus("error");
      setMessage(
        error.response?.data?.detail || "Failed to save configuration.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  // Optional: You can implement a backend endpoint to send a test email
  const handleTestConnection = async () => {
    if (!websiteId) {
      setMessage("Error: Website ID is missing.");
      setTestStatus("error");
      return;
    }

    setTestStatus("testing");
    try {
      await api.post(
        `/builder/websites/${websiteId}/email-config/test`,
        config,
      );
      setTestStatus("success");
      setMessage("Connection verified! A test email has been sent to you.");
    } catch (error: any) {
      setTestStatus("error");
      setMessage(
        "Connection failed: " +
          (error.response?.data?.detail || "Check your credentials."),
      );
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-500">
        Loading Email Settings...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8 font-sans">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="p-2 rounded-full hover:bg-white hover:shadow transition-all text-gray-600"
            >
              <ArrowLeft size={24} />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">
                Email Configuration
              </h1>
              <p className="text-gray-500 text-sm">
                Configure how transactional emails (contact forms, bookings) are
                sent from this website.
              </p>
            </div>
          </div>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <form onSubmit={handleSave} className="p-6 space-y-8">
            {/* 1. Provider Selection */}
            <div className="space-y-4">
              <label className="block text-sm font-semibold text-gray-700">
                Email Provider
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => handleChange("provider_type", "smtp")}
                  className={`flex items-center gap-3 p-4 border rounded-lg transition-all ${
                    config.provider_type === "smtp"
                      ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500"
                      : "border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  <div
                    className={`p-2 rounded-full ${config.provider_type === "smtp" ? "bg-blue-100 text-blue-600" : "bg-gray-100 text-gray-500"}`}
                  >
                    <Server size={20} />
                  </div>
                  <div className="text-left">
                    <div className="font-semibold text-gray-800">SMTP</div>
                    <div className="text-xs text-gray-500">
                      Gmail, Outlook, Zoho, cPanel
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleChange("provider_type", "sendgrid")}
                  className={`flex items-center gap-3 p-4 border rounded-lg transition-all ${
                    config.provider_type === "sendgrid"
                      ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500"
                      : "border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  <div
                    className={`p-2 rounded-full ${config.provider_type === "sendgrid" ? "bg-blue-100 text-blue-600" : "bg-gray-100 text-gray-500"}`}
                  >
                    <Key size={20} />
                  </div>
                  <div className="text-left">
                    <div className="font-semibold text-gray-800">SendGrid</div>
                    <div className="text-xs text-gray-500">
                      API Key integration
                    </div>
                  </div>
                </button>
              </div>
            </div>

            <hr className="border-gray-100" />

            {/* 2. Credentials Form */}
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                <Mail size={18} />
                Sender Details
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    From Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. My Website Support"
                    value={config.from_name}
                    onChange={(e) => handleChange("from_name", e.target.value)}
                    className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    The name users will see in their inbox.
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    From Email
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. support@mywebsite.com"
                    value={config.from_email}
                    onChange={(e) => handleChange("from_email", e.target.value)}
                    className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Must match the authenticated user below.
                  </p>
                </div>
              </div>

              {/* Conditional Fields based on Provider */}
              {config.provider_type === "smtp" && (
                <div className="bg-gray-50 p-6 rounded-lg border border-gray-200 space-y-6">
                  <h4 className="font-medium text-gray-700">SMTP Settings</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Host
                      </label>
                      <input
                        type="text"
                        placeholder="smtp.gmail.com"
                        value={config.smtp_host}
                        onChange={(e) =>
                          handleChange("smtp_host", e.target.value)
                        }
                        className="w-full p-2.5 border border-gray-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Port
                      </label>
                      <input
                        type="number"
                        placeholder="587"
                        value={config.smtp_port}
                        onChange={(e) =>
                          handleChange("smtp_port", parseInt(e.target.value))
                        }
                        className="w-full p-2.5 border border-gray-300 rounded-lg"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Username
                      </label>
                      <input
                        type="text"
                        placeholder="email@example.com"
                        value={config.smtp_user}
                        onChange={(e) =>
                          handleChange("smtp_user", e.target.value)
                        }
                        className="w-full p-2.5 border border-gray-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Password / App Password
                      </label>
                      <input
                        type="password"
                        placeholder="••••••••••••"
                        value={config.smtp_password}
                        onChange={(e) =>
                          handleChange("smtp_password", e.target.value)
                        }
                        className="w-full p-2.5 border border-gray-300 rounded-lg"
                      />
                      <p className="text-xs text-gray-400 mt-1">
                        For Gmail, use an{" "}
                        <a
                          href="https://myaccount.google.com/apppasswords"
                          target="_blank"
                          className="text-blue-600 hover:underline"
                        >
                          App Password
                        </a>{" "}
                        if 2FA is on.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="secure"
                      checked={config.smtp_secure}
                      onChange={(e) =>
                        handleChange("smtp_secure", e.target.checked)
                      }
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    <label htmlFor="secure" className="text-sm text-gray-700">
                      Use Secure Connection (SSL/TLS)
                    </label>
                  </div>
                </div>
              )}

              {config.provider_type === "sendgrid" && (
                <div className="bg-gray-50 p-6 rounded-lg border border-gray-200 space-y-6">
                  <h4 className="font-medium text-gray-700">
                    SendGrid Settings
                  </h4>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      API Key
                    </label>
                    <input
                      type="password"
                      placeholder="SG.xxxxxxxx...."
                      value={config.sendgrid_api_key}
                      onChange={(e) =>
                        handleChange("sendgrid_api_key", e.target.value)
                      }
                      className="w-full p-2.5 border border-gray-300 rounded-lg font-mono text-sm"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* 3. Actions & Status */}
            <div className="pt-4 flex items-center justify-between border-t border-gray-100">
              {/* Optional Test Button - Logic would need backend support */}
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testStatus === "testing" || isSaving}
                className="text-gray-600 hover:text-gray-900 font-medium text-sm px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                {testStatus === "testing" ? "Verifying..." : "Test Connection"}
              </button>

              <button
                type="submit"
                disabled={isSaving}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-6 rounded-lg transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100"
              >
                <Save size={18} />
                {isSaving ? "Saving..." : "Save Settings"}
              </button>
            </div>

            {/* Status Messages */}
            {testStatus === "success" && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-700 text-sm">
                <CheckCircle size={16} />
                {message || "Settings saved and verified!"}
              </div>
            )}
            {testStatus === "error" && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-sm">
                <AlertCircle size={16} />
                {message || "Something went wrong."}
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
