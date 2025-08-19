// components/settings/CustomDomainCard.tsx
"use client";
import { useEffect, useState } from "react";
import api from "@/lib/axios";

export default function CustomDomainCard({ websiteId }: { websiteId: string }) {
  const [domains, setDomains] = useState<any[]>([]);
  const [newDomain, setNewDomain] = useState("");
  const [dns, setDns] = useState<{
    cname_target: string;
    records: any[];
  } | null>(null);
  const [creating, setCreating] = useState(false);

  const load = async () => {
    const [list, info] = await Promise.all([
      api.get("/custom-domains", { params: { website_id: websiteId } }),
      api.get("/custom-domains/dns-instructions"),
    ]);
    setDomains(list.data);
    setDns(info.data);
  };

  useEffect(() => {
    load();
  }, []);

  const add = async () => {
    if (!newDomain.trim()) return;
    setCreating(true);
    try {
      await api.post("/custom-domains", {
        website_id: websiteId,
        domain: newDomain.trim(),
      });
      setNewDomain("");
      await load();
    } finally {
      setCreating(false);
    }
  };

  const refresh = async (id: string) => {
    await api.post(`/custom-domains/${id}/refresh`);
    await load();
  };

  const remove = async (id: string) => {
    await api.delete(`/custom-domains/${id}`);
    await load();
  };

  return (
    <div className="border rounded p-4 space-y-4">
      <h3 className="font-semibold text-lg">Custom Domain</h3>

      <div className="space-y-2">
        <input
          className="border rounded px-3 py-2 w-full"
          placeholder="yourdomain.com"
          value={newDomain}
          onChange={(e) => setNewDomain(e.target.value)}
        />
        <button
          className="bg-blue-600 text-white px-4 py-2 rounded"
          onClick={add}
          disabled={creating}
        >
          {creating ? "Adding..." : "Add Domain"}
        </button>
      </div>

      {dns && (
        <div className="bg-gray-50 border rounded p-3">
          <div className="font-medium mb-1">
            Create this DNS record at your registrar:
          </div>
          <pre className="text-sm">
            {`Type:   CNAME
Host:   www
Target: ${dns.cname_target}`}
          </pre>
          <div className="text-xs text-gray-500 mt-1">
            For root @ if supported: ALIAS/ANAME → {dns.cname_target}. Otherwise
            point <code>www</code> and redirect root to www.
          </div>
        </div>
      )}

      <div className="space-y-2">
        {domains.map((d) => (
          <div
            key={d.id}
            className="flex items-center justify-between bg-white border rounded px-3 py-2"
          >
            <div>
              <div className="font-medium">{d.domain}</div>
              <div className="text-xs text-gray-500">
                status: {d.status}
                {d.last_error ? ` — ${d.last_error}` : ""}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                className="px-3 py-1 border rounded"
                onClick={() => refresh(d.id)}
              >
                Check
              </button>
              <button
                className="px-3 py-1 border rounded text-red-600"
                onClick={() => remove(d.id)}
              >
                Remove
              </button>
            </div>
          </div>
        ))}
        {domains.length === 0 && (
          <div className="text-sm text-gray-500">No domains yet.</div>
        )}
      </div>
    </div>
  );
}
