// src/components/builder/custom-domain/page.tsx
"use client";
import { useEffect, useState } from "react";
import api from "@/lib/axios";
import { UUID } from "crypto";
// THIS IS A TEST TO BREAK THE BUILD

// --- NEW: Updated Site type to match the new API response ---
type Site = {
  website_id: string;
  subdomain: string;
  primary_custom_domain?: string | null;
  primary_custom_domain_status?: string | null; // <-- Changed from verified boolean
  primary_custom_domain_id?: UUID | null;
};

// --- NEW: Type for the DNS instructions we get from the backend ---
type DnsInstructions = {
  record_type: string;
  record_name: string;
  record_value: string;
  message: string;
};

export default function CustomDomainPage() {
  const [site, setSite] = useState<Site | null>(null);
  const [domain, setDomain] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);

  // --- NEW: State to hold the DNS instructions from the API ---
  const [dnsInstructions, setDnsInstructions] =
    useState<DnsInstructions | null>(null);

  const fetchSite = async () => {
    try {
      const { data } = await api.get<Site>("/builder/website");
      setSite(data);
      setDomain(data.primary_custom_domain || "");
      // Clear old instructions when we fetch new site data
      setDnsInstructions(null);
    } catch (error) {
      console.error("Failed to fetch site data:", error);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchSite().finally(() => setLoading(false));
  }, []);

  const saveDomain = async () => {
    if (!domain.trim() || !site?.website_id) return;
    setSaving(true);
    setDnsInstructions(null); // Clear previous instructions
    try {
      // --- NEW: Capture the response from the API ---
      const { data } = await api.post<DnsInstructions>("/custom-domains", {
        website_id: site.website_id,
        domain: domain.trim(),
      });
      // --- NEW: Store the instructions in state to display them ---
      setDnsInstructions(data);
      // We don't need to re-fetch the site here, we show instructions instead
    } catch (error: any) {
      alert(
        `Error: ${error.response?.data?.detail || "Could not add domain."}`
      );
    } finally {
      setSaving(false);
    }
  };

  const refreshStatus = async () => {
    if (!site?.primary_custom_domain_id) return;
    setVerifying(true);
    try {
      await api.post(
        `/custom-domains/${site.primary_custom_domain_id}/refresh`
      );
      // After refreshing, fetch the latest site data to see the new status
      await fetchSite();
    } catch (error) {
      console.error("Failed to refresh status:", error);
    } finally {
      setVerifying(false);
    }
  };

  // --- NEW: Helper function to display the domain status nicely ---
  const renderStatus = () => {
    if (!site?.primary_custom_domain) return null;

    const status = site.primary_custom_domain_status;
    let color = "text-gray-600";
    let text = status || "Unknown";

    if (status === "active") {
      color = "text-green-600";
      text = "Active";
    } else if (status === "pending_validation" || status === "initializing") {
      color = "text-orange-600";
      text = "Pending Verification";
    } else if (status?.includes("fail")) {
      color = "text-red-600";
      text = "Failed";
    }

    return (
      <div className="text-sm mt-2">
        Current: <b>{site.primary_custom_domain}</b>{" "}
        <span className={color}>({text})</span>
      </div>
    );
  };

  if (loading) return <div className="p-6">Loading…</div>;

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <h1 className="text-xl font-bold">Custom Domain</h1>

      <div className="rounded-lg border p-4 space-y-3 bg-white">
        <label className="block text-sm font-medium">Your domain</label>
        <input
          className="w-full border rounded px-3 py-2"
          placeholder="www.yourdomain.com"
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
        />
        <div className="flex gap-2">
          <button
            onClick={saveDomain}
            disabled={saving || !domain.trim()}
            className="px-3 py-1.5 rounded bg-black text-white text-sm disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save Domain"}
          </button>
          <button
            onClick={refreshStatus}
            disabled={verifying || !site?.primary_custom_domain_id}
            className="px-3 py-1.5 rounded bg-indigo-600 text-white text-sm disabled:opacity-60"
          >
            {verifying ? "Checking…" : "Refresh Status"}
          </button>
        </div>
        {renderStatus()}
      </div>

      {/* --- NEW: Dynamically display instructions from the API --- */}
      {dnsInstructions && (
        <div className="rounded-lg border p-4 space-y-3 bg-blue-50">
          <h2 className="font-semibold text-blue-800">Action Required</h2>
          <p className="text-sm text-blue-700">{dnsInstructions.message}</p>
          <div className="text-sm bg-gray-100 p-3 rounded font-mono">
            <div>
              <strong>Type:</strong> {dnsInstructions.record_type}
            </div>
            <div>
              <strong>Name/Host:</strong> {dnsInstructions.record_name}
            </div>
            <div>
              <strong>Value/Target:</strong> {dnsInstructions.record_value}
            </div>
          </div>
          <p className="text-xs text-gray-600">
            After adding this record at your registrar, wait a few minutes and
            then click "Refresh Status".
          </p>
        </div>
      )}
    </div>
  );
}
