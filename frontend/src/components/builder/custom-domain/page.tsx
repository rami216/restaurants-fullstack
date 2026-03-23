// src/app/builder/custom-domain/page.tsx
"use client";
import { useEffect, useState } from "react";
import api from "@/lib/axios";
import {
  Globe,
  RefreshCw,
  Trash2,
  Save,
  Info,
  CheckCircle2,
  AlertCircle,
  Clock,
} from "lucide-react";

// --- Updated Site type ---
type Site = {
  website_id: string;
  subdomain: string;
  primary_custom_domain?: string | null;
  primary_custom_domain_status?: string | null;
  primary_custom_domain_id?: string | null; // Replaced backend UUID with frontend string
};

// --- Type for the DNS instructions ---
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

  const [dnsInstructions, setDnsInstructions] =
    useState<DnsInstructions | null>(null);

  const fetchSite = async () => {
    try {
      const { data } = await api.get<Site>("/builder/website");
      setSite(data);
      setDomain(data.primary_custom_domain || "");
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
    setDnsInstructions(null);
    try {
      const { data } = await api.post<DnsInstructions>("/custom-domains", {
        website_id: site.website_id,
        domain: domain.trim(),
      });
      setDnsInstructions(data);
    } catch (error: any) {
      alert(
        `Error: ${error.response?.data?.detail || "Could not add domain."}`,
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
        `/custom-domains/${site.primary_custom_domain_id}/refresh`,
      );
      await fetchSite();
    } catch (error) {
      console.error("Failed to refresh status:", error);
    } finally {
      setVerifying(false);
    }
  };

  const handleRemoveDomain = async () => {
    if (!site?.primary_custom_domain_id) return;
    if (
      !confirm(
        `Are you sure you want to remove ${site.primary_custom_domain}? You will need to re-verify if you add it back later.`,
      )
    )
      return;

    setSaving(true);
    try {
      await api.delete(`/custom-domains/${site.primary_custom_domain_id}`);
      setDomain("");
      setDnsInstructions(null);
      await fetchSite();
      alert("Domain removed successfully.");
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.detail || "Failed to remove domain.");
    } finally {
      setSaving(false);
    }
  };

  const renderStatusBadge = () => {
    if (!site?.primary_custom_domain) return null;

    const status = site.primary_custom_domain_status;

    if (status === "active") {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800 border border-green-200">
          <CheckCircle2 size={14} /> Active & Connected
        </span>
      );
    } else if (status === "pending_validation" || status === "initializing") {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
          <Clock size={14} /> Pending Verification
        </span>
      );
    } else if (status?.includes("fail") || status?.includes("error")) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800 border border-red-200">
          <AlertCircle size={14} /> Verification Failed
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-800 border border-gray-200">
        <Clock size={14} /> Status Unknown
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-100px)] items-center justify-center">
        <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6 sm:p-10 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4 border-b pb-6">
        <div className="p-3 bg-indigo-50 rounded-xl">
          <Globe className="text-indigo-600 w-8 h-8" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">
            Custom Domain
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Connect your own domain to your Zygoflow website.
          </p>
        </div>
      </div>

      {/* Main Settings Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 sm:p-8">
          {/* Current Domain Status */}
          {site?.primary_custom_domain && (
            <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-gray-50 rounded-lg border border-gray-100">
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                  Current Domain
                </p>
                <p className="text-lg font-semibold text-gray-900">
                  {site.primary_custom_domain}
                </p>
              </div>
              <div>{renderStatusBadge()}</div>
            </div>
          )}

          {/* Form */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Domain Name
              </label>
              <input
                className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow"
                placeholder="e.g. www.yourdomain.com"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                disabled={!!site?.primary_custom_domain_id && !dnsInstructions}
              />
              <p className="text-xs text-gray-500 mt-2">
                Enter the exact domain you want users to visit. We recommend
                using <b>www</b> (e.g., www.mywebsite.com).
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-3 pt-2">
              {!site?.primary_custom_domain_id || dnsInstructions ? (
                <button
                  onClick={saveDomain}
                  disabled={saving || !domain.trim()}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors disabled:opacity-50"
                >
                  <Save size={16} />
                  {saving ? "Saving…" : "Save & Continue"}
                </button>
              ) : null}

              {site?.primary_custom_domain_id && (
                <button
                  onClick={refreshStatus}
                  disabled={verifying}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gray-900 hover:bg-gray-800 text-white text-sm font-semibold transition-colors disabled:opacity-50"
                >
                  <RefreshCw
                    size={16}
                    className={verifying ? "animate-spin" : ""}
                  />
                  {verifying ? "Checking…" : "Refresh Status"}
                </button>
              )}

              {site?.primary_custom_domain_id && (
                <button
                  onClick={handleRemoveDomain}
                  disabled={saving || verifying}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 hover:text-red-800 text-sm font-semibold transition-colors ml-auto disabled:opacity-50"
                >
                  <Trash2 size={16} />
                  Remove Domain
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* DNS Instructions Block */}
      {dnsInstructions && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl overflow-hidden shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="p-6">
            <div className="flex items-start gap-3">
              <div className="mt-0.5">
                <Info className="text-blue-600 w-6 h-6" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-bold text-blue-900 mb-1">
                  Action Required: Update your DNS
                </h2>
                <p className="text-sm text-blue-700 mb-4 leading-relaxed">
                  {dnsInstructions.message} Head over to your domain registrar
                  (like Namecheap, GoDaddy, or Cloudflare) and add the following
                  record:
                </p>

                <div className="bg-white border border-blue-100 rounded-lg p-4 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
                        Type
                      </p>
                      <p className="font-mono text-sm bg-gray-50 px-2 py-1 rounded border border-gray-200 inline-block text-gray-800">
                        {dnsInstructions.record_type}
                      </p>
                    </div>
                    <div className="sm:col-span-2">
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
                        Name / Host
                      </p>
                      <p className="font-mono text-sm bg-gray-50 px-3 py-1.5 rounded border border-gray-200 text-gray-800 break-all">
                        {dnsInstructions.record_name}
                      </p>
                    </div>
                    <div className="sm:col-span-3">
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
                        Value / Target
                      </p>
                      <p className="font-mono text-sm bg-gray-50 px-3 py-1.5 rounded border border-gray-200 text-gray-800 break-all">
                        {dnsInstructions.record_value}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 bg-blue-100/50 p-4 rounded-lg border border-blue-200/50">
                  <p className="text-xs text-blue-800 flex items-center gap-2">
                    <Clock size={14} className="shrink-0" />
                    <strong>Note:</strong> DNS changes can take a few minutes
                    (sometimes up to an hour) to propagate globally. Once added,
                    click the "Refresh Status" button above.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
