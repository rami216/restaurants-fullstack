// src/components/builder/custom-domain/page.tsx
"use client";

import { useEffect, useState, useMemo } from "react";
import api from "@/lib/axios";

// --- Updated Site type (use string for id to avoid Node "crypto" UUID type) ---
type Site = {
  website_id: string;
  subdomain: string;
  primary_custom_domain?: string | null;
  primary_custom_domain_status?: string | null;
  primary_custom_domain_id?: string | null;
};

// --- DNS instructions from backend ---
type DnsInstructions = {
  record_type: string; // e.g. "TXT"
  record_name: string; // e.g. "_cf-custom-hostname.www.example.com"
  record_value: string; // e.g. "some-hash"
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

  // -------- Helpers --------
  const normalizeDomain = (d: string) =>
    d
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/\/+$/, "");

  const rootDomain = useMemo(() => {
    const d = normalizeDomain(domain || site?.primary_custom_domain || "");
    return d.replace(/^www\./, ""); // apex without www
  }, [domain, site?.primary_custom_domain]);

  const wwwHost = "www";
  const wwwTarget = "www.zygoflow.com";
  const apexRedirectTarget = `https://www.${rootDomain || "yourdomain.com"}`;

  // Given a full record_name like "_cf-custom-hostname.www.example.com",
  // show only the label the user must put in the "Host/Name" field:
  // -> "_cf-custom-hostname.www"
  const hostLabelToCopy = useMemo(() => {
    if (!dnsInstructions?.record_name) return "";
    const dn = normalizeDomain(dnsInstructions.record_name);
    const rd = normalizeDomain(rootDomain);
    const suffix = rd ? `.${rd}` : "";
    return dn.endsWith(suffix) ? dn.slice(0, -suffix.length) : dn;
  }, [dnsInstructions?.record_name, rootDomain]);

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // no-op
    }
  };

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
        domain: normalizeDomain(domain),
      });
      setDnsInstructions(data);
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
      await fetchSite();
    } catch (error) {
      console.error("Failed to refresh status:", error);
    } finally {
      setVerifying(false);
    }
  };

  const renderStatus = () => {
    if (!site?.primary_custom_domain) return null;
    const status = site.primary_custom_domain_status;
    let cls = "bg-gray-200 text-gray-800";
    let text = status || "Unknown";

    if (status === "active") {
      cls = "bg-green-100 text-green-800";
      text = "Active";
    } else if (status === "pending_validation" || status === "initializing") {
      cls = "bg-orange-100 text-orange-800";
      text = "Pending Verification";
    } else if (status?.includes("fail")) {
      cls = "bg-red-100 text-red-800";
      text = "Failed";
    }

    return (
      <div className="text-sm mt-2">
        Current: <b>{site.primary_custom_domain}</b>{" "}
        <span
          className={`inline-block px-2 py-0.5 rounded text-xs align-middle ${cls}`}
        >
          {text}
        </span>
      </div>
    );
  };

  if (loading) return <div className="p-6">Loading…</div>;

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Custom Domain</h1>

      {/* Domain input card */}
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

      {/* STEP 1: DNS Verification */}
      {dnsInstructions && (
        <div className="rounded-lg border p-4 space-y-4 bg-blue-50">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-blue-900">
              Step 1 — Verify Domain Ownership (TXT)
            </h2>
            <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-800">
              Action Required
            </span>
          </div>

          <p className="text-sm text-blue-800">{dnsInstructions.message}</p>

          <div className="grid grid-cols-1 gap-3">
            <div className="bg-white rounded border p-3">
              <div className="text-xs text-gray-500 mb-1">Type</div>
              <div className="font-mono text-sm">
                {dnsInstructions.record_type}
              </div>
            </div>

            <div className="bg-white rounded border p-3">
              <div className="text-xs text-gray-500 mb-1">
                Name / Host (copy only this part)
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="font-mono text-sm break-all">
                  {hostLabelToCopy || "_cf-custom-hostname.www"}
                </div>
                <button
                  onClick={() =>
                    copy(hostLabelToCopy || "_cf-custom-hostname.www")
                  }
                  className="text-xs px-2 py-1 rounded bg-gray-900 text-white"
                >
                  Copy
                </button>
              </div>
              {/* Clarify what NOT to copy */}
              <p className="mt-2 text-xs text-gray-600">
                Paste exactly the label above (e.g.{" "}
                <b>_cf-custom-hostname.www</b>) into the <i>Host/Name</i> field.{" "}
                <b>Do not include</b> your domain (e.g.{" "}
                <span className="font-mono text-[11px]">.yourdomain.com</span>).
              </p>
            </div>

            <div className="bg-white rounded border p-3">
              <div className="text-xs text-gray-500 mb-1">Value / Target</div>
              <div className="flex items-center justify-between gap-3">
                <div className="font-mono text-sm break-all">
                  {dnsInstructions.record_value}
                </div>
                <button
                  onClick={() => copy(dnsInstructions.record_value)}
                  className="text-xs px-2 py-1 rounded bg-gray-900 text-white"
                >
                  Copy
                </button>
              </div>
            </div>
          </div>

          <p className="text-xs text-gray-700">
            After adding this TXT record at your domain registrar, wait a few
            minutes, then click <b>Refresh Status</b>. Once the status is{" "}
            <b>Active</b>, proceed to Step 2.
          </p>
        </div>
      )}

      {/* STEP 2: Go Live records */}
      <div className="rounded-lg border p-4 space-y-4 bg-white">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">
            Step 2 — Go Live (after TXT is verified)
          </h2>
          <span
            className={`text-xs px-2 py-0.5 rounded ${
              site?.primary_custom_domain_status === "active"
                ? "bg-green-100 text-green-800"
                : "bg-gray-100 text-gray-700"
            }`}
          >
            {site?.primary_custom_domain_status === "active"
              ? "Ready"
              : "Pending"}
          </span>
        </div>

        <ol className="list-decimal pl-5 space-y-3 text-sm">
          <li>
            <b>Delete</b> the TXT record{" "}
            <span className="font-mono text-[12px]">
              _cf-custom-hostname.www
            </span>{" "}
            you added in Step 1.
          </li>

          <li>
            Add a <b>CNAME</b> record to point your subdomain to our platform:
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <div className="rounded border p-3">
                <div className="text-xs text-gray-500 mb-1">Name / Host</div>
                <div className="flex items-center justify-between gap-3">
                  <div className="font-mono text-sm">{wwwHost}</div>
                  <button
                    onClick={() => copy(wwwHost)}
                    className="text-xs px-2 py-1 rounded bg-gray-900 text-white"
                  >
                    Copy
                  </button>
                </div>
              </div>
              <div className="rounded border p-3">
                <div className="text-xs text-gray-500 mb-1">Value / Target</div>
                <div className="flex items-center justify-between gap-3">
                  <div className="font-mono text-sm">{wwwTarget}</div>
                  <button
                    onClick={() => copy(wwwTarget)}
                    className="text-xs px-2 py-1 rounded bg-gray-900 text-white"
                  >
                    Copy
                  </button>
                </div>
              </div>
            </div>
          </li>

          <li>
            Add a <b>URL Redirect / Forward</b> so the root domain redirects to
            the www version:
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <div className="rounded border p-3">
                <div className="text-xs text-gray-500 mb-1">From (Host)</div>
                <div className="flex items-center justify-between gap-3">
                  <div className="font-mono text-sm">@</div>
                  <button
                    onClick={() => copy("@")}
                    className="text-xs px-2 py-1 rounded bg-gray-900 text-white"
                  >
                    Copy
                  </button>
                </div>
              </div>
              <div className="rounded border p-3">
                <div className="text-xs text-gray-500 mb-1">
                  To (Destination URL)
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div className="font-mono text-sm break-all">
                    {apexRedirectTarget}
                  </div>
                  <button
                    onClick={() => copy(apexRedirectTarget)}
                    className="text-xs px-2 py-1 rounded bg-gray-900 text-white"
                  >
                    Copy
                  </button>
                </div>
              </div>
            </div>
            <p className="mt-2 text-xs text-gray-600">
              Some registrars call this “URL redirect” or “Forwarding.” Choose a
              permanent (301) redirect if offered.
            </p>
          </li>
        </ol>
      </div>
    </div>
  );
}
