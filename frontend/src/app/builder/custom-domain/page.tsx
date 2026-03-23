// src/app/builder/custom-domain/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import api from "@/lib/axios";
import {
  Globe,
  RefreshCw,
  Trash2,
  Save,
  CheckCircle2,
  Clock,
  AlertCircle,
  Copy as CopyIcon,
  Check,
} from "lucide-react";

/** API shapes */
type Site = {
  website_id: string;
  subdomain: string;
  primary_custom_domain?: string | null;
  primary_custom_domain_status?: string | null;
  primary_custom_domain_id?: string | null;
};

type DnsInstructions = {
  record_type: string;
  record_name: string;
  record_value: string;
  message: string;
};

/** Helpers */
const normalizeDomain = (d: string) =>
  d
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "");

const toDns = (raw: any): DnsInstructions => {
  const record_type = raw?.record_type ?? raw?.type ?? "TXT";
  const record_name =
    raw?.record_name ?? raw?.name ?? raw?.host ?? raw?.record ?? "";
  const record_value =
    raw?.record_value ??
    raw?.value ??
    raw?.txt_value ??
    raw?.target ??
    raw?.content ??
    "";
  const message =
    raw?.message ?? raw?.detail ?? "Add this TXT record at your registrar.";

  return {
    record_type: String(record_type),
    record_name: String(record_name),
    record_value: String(record_value),
    message: String(message),
  };
};

export default function CustomDomainPage() {
  const [site, setSite] = useState<Site | null>(null);
  const [domain, setDomain] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [dnsInstructions, setDnsInstructions] =
    useState<DnsInstructions | null>(null);
  const [copiedMap, setCopiedMap] = useState<Record<string, boolean>>({});

  const fetchSite = async () => {
    try {
      const { data } = await api.get<Site>("/builder/website");
      setSite(data);
      setDomain(data.primary_custom_domain || "");
    } catch (error) {
      console.error("Failed to fetch site data:", error);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchSite().finally(() => setLoading(false));
  }, []);

  const rootDomain = useMemo(() => {
    const d = normalizeDomain(domain || site?.primary_custom_domain || "");
    return d.replace(/^www\./, "");
  }, [domain, site?.primary_custom_domain]);

  const isActive = site?.primary_custom_domain_status === "active";
  const apexRedirectTarget = `https://www.${rootDomain || "yourdomain.com"}`;

  const hostLabelToCopy = useMemo(() => {
    const name = dnsInstructions?.record_name;
    if (!name) return "_cf-custom-hostname.www";
    const dn = normalizeDomain(name);
    const rd = normalizeDomain(rootDomain);
    const suffix = rd ? `.${rd}` : "";
    return dn.endsWith(suffix) ? dn.slice(0, -suffix.length) : dn;
  }, [dnsInstructions?.record_name, rootDomain]);

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMap({ ...copiedMap, [id]: true });
      setTimeout(
        () => setCopiedMap((prev) => ({ ...prev, [id]: false })),
        2000,
      );
    } catch {}
  };

  const saveDomain = async () => {
    if (!domain.trim() || !site?.website_id) return;
    setSaving(true);
    try {
      const { data } = await api.post("/custom-domains", {
        website_id: site.website_id,
        domain: normalizeDomain(domain),
      });
      setDnsInstructions(toDns((data as any)?.result ?? data));
    } catch (error: any) {
      alert(
        `Error: ${error?.response?.data?.detail || "Could not add domain."}`,
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

  // ✅ THE REMOVE FUNCTION IS HERE!
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
    } else if (status?.includes("fail")) {
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

  const recordType = dnsInstructions?.record_type || "TXT";
  const txtValue = dnsInstructions?.record_value;

  return (
    <div className="max-w-3xl mx-auto p-6 sm:p-10 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4 border-b pb-6">
        <div className="p-3 bg-indigo-50 rounded-xl">
          <Globe className="text-indigo-600 w-8 h-8" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">
            Custom Domain Setup
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Connect your own domain to your website in two easy steps.
          </p>
        </div>
      </div>

      {/* Main Settings Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 sm:p-8">
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

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Domain Name
              </label>
              <input
                className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow"
                placeholder="e.g. www.yourdomain.com"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                disabled={!!site?.primary_custom_domain_id && !dnsInstructions}
              />
              <p className="text-xs text-gray-500 mt-2">
                Enter the exact domain you want users to visit. We recommend
                using <b>www</b>.
              </p>
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              {(!site?.primary_custom_domain_id || dnsInstructions) && (
                <button
                  onClick={saveDomain}
                  disabled={saving || !domain.trim()}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors disabled:opacity-50"
                >
                  <Save size={16} /> {saving ? "Saving…" : "Save Domain"}
                </button>
              )}

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

              {/* ✅ THE REMOVE BUTTON */}
              {site?.primary_custom_domain_id && (
                <button
                  onClick={handleRemoveDomain}
                  disabled={saving || verifying}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 hover:text-red-800 text-sm font-semibold transition-colors ml-auto disabled:opacity-50"
                >
                  <Trash2 size={16} /> Remove Domain
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* STEP 1 */}
      <div className="bg-white rounded-xl shadow-sm border border-blue-200 overflow-hidden">
        <div className="bg-blue-50 p-4 border-b border-blue-100 flex justify-between items-center">
          <h2 className="font-bold text-blue-900 flex items-center gap-2">
            <span className="bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs">
              1
            </span>
            Verify Domain Ownership (TXT)
          </h2>
          <span
            className={`text-xs px-3 py-1 rounded-full font-semibold ${isActive ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}
          >
            {isActive ? "Completed" : "Action Required"}
          </span>
        </div>

        <div className="p-6 space-y-4">
          {dnsInstructions ? (
            <p className="text-sm text-gray-700">{dnsInstructions.message}</p>
          ) : (
            <p className="text-sm text-gray-700">
              Enter your domain above and click <b>Save Domain</b> to generate
              your TXT record.
            </p>
          )}

          <div className="grid grid-cols-1 gap-4">
            <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
              <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
                Type
              </div>
              <div className="font-mono text-sm text-gray-800">
                {recordType}
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
              <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
                Name / Host (copy only this part)
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="font-mono text-sm text-gray-800 break-all">
                  {hostLabelToCopy}
                </div>
                <button
                  onClick={() => copyToClipboard(hostLabelToCopy, "host")}
                  className="text-xs px-3 py-1.5 rounded-md bg-white border border-gray-300 hover:bg-gray-100 text-gray-700 font-semibold flex items-center gap-1 transition-colors"
                >
                  {copiedMap["host"] ? (
                    <Check size={14} className="text-green-600" />
                  ) : (
                    <CopyIcon size={14} />
                  )}{" "}
                  {copiedMap["host"] ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
              <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
                Value / Target
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="font-mono text-sm text-gray-800 break-all">
                  {txtValue || "—"}
                </div>
                <button
                  onClick={() => txtValue && copyToClipboard(txtValue, "value")}
                  disabled={!txtValue}
                  className="text-xs px-3 py-1.5 rounded-md bg-white border border-gray-300 hover:bg-gray-100 text-gray-700 font-semibold flex items-center gap-1 transition-colors disabled:opacity-50"
                >
                  {copiedMap["value"] ? (
                    <Check size={14} className="text-green-600" />
                  ) : (
                    <CopyIcon size={14} />
                  )}{" "}
                  {copiedMap["value"] ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>
          </div>
          <p className="text-xs text-gray-500 flex items-center gap-1.5 mt-2">
            <Clock size={14} /> After adding this, wait a few minutes, then
            click <b>Refresh Status</b>.
          </p>
        </div>
      </div>

      {/* STEP 2 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="bg-gray-50 p-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="font-bold text-gray-900 flex items-center gap-2">
            <span className="bg-gray-800 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs">
              2
            </span>
            Go Live (CNAME & Redirect)
          </h2>
          <span
            className={`text-xs px-3 py-1 rounded-full font-semibold ${isActive ? "bg-green-100 text-green-800" : "bg-gray-200 text-gray-600"}`}
          >
            {isActive ? "Ready" : "Pending TXT"}
          </span>
        </div>

        <div className="p-6">
          <ol className="list-decimal pl-5 space-y-6 text-sm text-gray-700">
            <li>
              <b>Delete</b> the TXT record{" "}
              <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200">
                _cf-custom-hostname.www
              </span>{" "}
              you added in Step 1.
            </li>

            <li>
              Add a <b>CNAME</b> record to point your subdomain to our platform:
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
                    Name / Host
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-mono text-sm">www</div>
                    <button
                      onClick={() => copyToClipboard("www", "cname-host")}
                      className="text-xs px-2.5 py-1 rounded bg-white border border-gray-300 hover:bg-gray-100 transition-colors"
                    >
                      {copiedMap["cname-host"] ? "Copied!" : "Copy"}
                    </button>
                  </div>
                </div>
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
                    Value / Target
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-mono text-sm">www.zygoflow.com</div>
                    <button
                      onClick={() =>
                        copyToClipboard("www.zygoflow.com", "cname-val")
                      }
                      className="text-xs px-2.5 py-1 rounded bg-white border border-gray-300 hover:bg-gray-100 transition-colors"
                    >
                      {copiedMap["cname-val"] ? "Copied!" : "Copy"}
                    </button>
                  </div>
                </div>
              </div>
            </li>

            <li>
              Add a <b>URL Redirect / Forward</b> so the root domain redirects
              to the www version:
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
                    From (Host)
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-mono text-sm">@</div>
                    <button
                      onClick={() => copyToClipboard("@", "redir-host")}
                      className="text-xs px-2.5 py-1 rounded bg-white border border-gray-300 hover:bg-gray-100 transition-colors"
                    >
                      {copiedMap["redir-host"] ? "Copied!" : "Copy"}
                    </button>
                  </div>
                </div>
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
                    To (Destination URL)
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-mono text-sm break-all">
                      {apexRedirectTarget}
                    </div>
                    <button
                      onClick={() =>
                        copyToClipboard(apexRedirectTarget, "redir-val")
                      }
                      className="text-xs px-2.5 py-1 rounded bg-white border border-gray-300 hover:bg-gray-100 transition-colors"
                    >
                      {copiedMap["redir-val"] ? "Copied!" : "Copy"}
                    </button>
                  </div>
                </div>
              </div>
              <p className="mt-2 text-xs text-gray-500">
                Choose a permanent (301) redirect if your registrar asks.
              </p>
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
}
