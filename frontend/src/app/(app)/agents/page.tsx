"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

const API = "https://api.zygoflow.com/zygo";

// ── Types ───────────────────────────────────────────────────
interface Pipeline {
  id: string;
  name: string;
  agent_names: string[];
  max_rounds: number;
  auto_mode: boolean;
  created_at: string;
}

interface Trigger {
  id: string;
  name: string;
  trigger_type: string;
  webhook_public_url?: string;
  is_enabled: boolean;
  pipeline_id: string;
  interval_value?: number;
  interval_unit?: string;
  daily_time?: string;
  last_fired_at?: string;
}

interface Run {
  id: string;
  pipeline_id: string;
  status: "pending" | "running" | "success" | "failed";
  trigger_source: string;
  started_at: string;
  logs?: string;
}

interface Subscription {
  status: string;
  plan: string;
  runs_used: number;
  runs_limit: number;
  stripe_customer_id?: string;
}

// ── API helpers ─────────────────────────────────────────────
function useApi(token: string | null) {
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
  const get = (path: string) =>
    fetch(`${API}${path}`, { headers }).then((r) => r.json());
  const post = (path: string, body?: object) =>
    fetch(`${API}${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    }).then((r) => r.json());
  const del = (path: string) =>
    fetch(`${API}${path}`, { method: "DELETE", headers }).then((r) => r.json());
  const patch = (path: string, body: object) =>
    fetch(`${API}${path}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify(body),
    }).then((r) => r.json());
  return { get, post, del, patch };
}

// ── Status badge ────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { color: string; dot: string; label: string }> = {
    success: {
      color: "text-[#00ff88] bg-[#00ff88]/10 border-[#00ff88]/20",
      dot: "bg-[#00ff88]",
      label: "Success",
    },
    running: {
      color: "text-blue-400 bg-blue-400/10 border-blue-400/20",
      dot: "bg-blue-400 animate-pulse",
      label: "Running",
    },
    failed: {
      color: "text-red-400 bg-red-400/10 border-red-400/20",
      dot: "bg-red-400",
      label: "Failed",
    },
    pending: {
      color: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
      dot: "bg-yellow-400 animate-pulse",
      label: "Pending",
    },
  };
  const s = map[status] || map.pending;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-mono ${s.color}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

// ── Copy button ─────────────────────────────────────────────
function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button
      onClick={copy}
      className="text-xs text-gray-500 hover:text-[#00ff88] transition-colors font-mono px-2 py-1 rounded hover:bg-[#00ff88]/10 shrink-0"
    >
      {copied ? "✓ copied" : "📋 copy"}
    </button>
  );
}

// ── Empty state ─────────────────────────────────────────────
function Empty({
  emoji,
  title,
  desc,
}: {
  emoji: string;
  title: string;
  desc: string;
}) {
  return (
    <div className="border border-dashed border-white/10 rounded-2xl p-16 text-center">
      <div className="text-5xl mb-4">{emoji}</div>
      <p className="text-white font-medium mb-2">{title}</p>
      <p className="text-gray-500 text-sm max-w-xs mx-auto">{desc}</p>
    </div>
  );
}

// ── Spinner ─────────────────────────────────────────────────
function Spinner() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-[#00ff88] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

// ── Time ago ─────────────────────────────────────────────────
function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (mins > 0) return `${mins}m ago`;
  return "just now";
}

// ── Schedule label ───────────────────────────────────────────
function scheduleLabel(trigger: Trigger) {
  if (trigger.daily_time) return `daily at ${trigger.daily_time}`;
  if (trigger.interval_value && trigger.interval_unit)
    return `every ${trigger.interval_value} ${trigger.interval_unit}`;
  return "scheduled";
}

// ══════════════════════════════════════════════════════════════
// ☁️ PIPELINES VIEW
// ══════════════════════════════════════════════════════════════
function PipelinesView({
  api,
  runs,
}: {
  api: ReturnType<typeof useApi>;
  runs: Run[];
}) {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [triggers, setTriggers] = useState<Trigger[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [p, t] = await Promise.all([
      api.get("/pipelines"),
      api.get("/triggers"),
    ]);
    setPipelines(Array.isArray(p) ? p : []);
    setTriggers(Array.isArray(t) ? t : []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const deletePipeline = async (id: string) => {
    if (!confirm("Delete this pipeline and its webhook?")) return;
    setDeleting(id);
    await api.del(`/pipelines/${id}`);
    await load();
    setDeleting(null);
  };

  const toggleTrigger = async (trigger: Trigger) => {
    await api.patch(`/triggers/${trigger.id}`, {
      is_enabled: !trigger.is_enabled,
    });
    await load();
  };

  if (loading) return <Spinner />;

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-white font-semibold text-xl mb-1">
            ☁️ Deployed Pipelines
          </h2>
          <p className="text-gray-500 text-sm">
            {pipelines.length > 0
              ? `${pipelines.length} pipeline${pipelines.length !== 1 ? "s" : ""} running in the cloud`
              : "No pipelines deployed yet"}
          </p>
        </div>
        {pipelines.length > 0 && (
          <div className="text-xs text-gray-600 font-mono bg-white/[0.03] border border-white/[0.06] px-3 py-2 rounded-lg">
            Desktop app → ☁️ Deploy to Cloud
          </div>
        )}
      </div>

      {pipelines.length === 0 ? (
        <Empty
          emoji="🖥️"
          title="No pipelines deployed yet"
          desc="Open the Zygoflow desktop app, build your pipeline, then click ☁️ Deploy to Cloud"
        />
      ) : (
        <div className="space-y-4">
          {pipelines.map((p) => {
            const pTriggers = triggers.filter((t) => t.pipeline_id === p.id);
            const webhookTrigger = pTriggers.find(
              (t) => t.trigger_type === "webhook",
            );
            const scheduledTrigger = pTriggers.find(
              (t) =>
                t.trigger_type === "interval" || t.trigger_type === "daily",
            );
            const pRuns = runs.filter((r) => r.pipeline_id === p.id);
            const lastRun = pRuns.sort(
              (a, b) =>
                new Date(b.started_at).getTime() -
                new Date(a.started_at).getTime(),
            )[0];

            return (
              <div
                key={p.id}
                className="bg-[#111118] border border-white/[0.06] rounded-xl overflow-hidden"
              >
                {/* Header */}
                <div className="px-6 py-4 flex items-center justify-between border-b border-white/[0.04]">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-[#00ff88]" />
                    <h3 className="text-white font-medium">{p.name}</h3>
                    <span className="text-gray-600 text-xs font-mono">
                      {p.auto_mode
                        ? "∞ auto"
                        : `${p.max_rounds} round${p.max_rounds !== 1 ? "s" : ""}`}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    {lastRun && <StatusBadge status={lastRun.status} />}
                    <button
                      onClick={() => deletePipeline(p.id)}
                      disabled={deleting === p.id}
                      className="text-gray-600 hover:text-red-400 transition-colors text-xs font-mono px-2 py-1 hover:bg-red-400/10 rounded"
                    >
                      {deleting === p.id ? "..." : "🗑 delete"}
                    </button>
                  </div>
                </div>

                {/* Agent sequence */}
                <div className="px-6 py-3 flex items-center gap-2 flex-wrap border-b border-white/[0.04]">
                  <span className="text-gray-600 text-xs font-mono">
                    agents:
                  </span>
                  {(p.agent_names || []).map((name, i) => (
                    <span key={i} className="flex items-center gap-1.5">
                      <span className="bg-[#0a0a0f] border border-white/[0.06] text-gray-400 text-xs font-mono px-2 py-0.5 rounded">
                        {i + 1}. {name}
                      </span>
                      {i < p.agent_names.length - 1 && (
                        <span className="text-gray-700 text-xs">→</span>
                      )}
                    </span>
                  ))}
                </div>

                {/* Webhook trigger row */}
                {webhookTrigger?.webhook_public_url && (
                  <div className="px-6 py-3 flex items-center justify-between gap-4 border-b border-white/[0.04]">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="text-gray-600 text-xs font-mono shrink-0">
                        🔗 POST
                      </span>
                      <span className="text-[#00ff88] text-xs font-mono truncate">
                        {webhookTrigger.webhook_public_url}
                      </span>
                      <CopyBtn text={webhookTrigger.webhook_public_url} />
                    </div>
                    <button
                      onClick={() => toggleTrigger(webhookTrigger)}
                      className={`text-xs font-mono px-3 py-1 rounded-full border transition-colors shrink-0 ${
                        webhookTrigger.is_enabled
                          ? "border-[#00ff88]/30 text-[#00ff88] bg-[#00ff88]/10 hover:bg-[#00ff88]/20"
                          : "border-gray-700 text-gray-500 hover:text-gray-300"
                      }`}
                    >
                      {webhookTrigger.is_enabled ? "● active" : "○ paused"}
                    </button>
                  </div>
                )}

                {/* Scheduled trigger row */}
                {scheduledTrigger && (
                  <div className="px-6 py-3 flex items-center justify-between gap-4 border-b border-white/[0.04]">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-600 text-xs font-mono shrink-0">
                        ⏰
                      </span>
                      <span className="text-purple-400 text-xs font-mono">
                        {scheduleLabel(scheduledTrigger)}
                      </span>
                      {scheduledTrigger.last_fired_at && (
                        <span className="text-gray-600 text-xs font-mono">
                          · last: {timeAgo(scheduledTrigger.last_fired_at)}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => toggleTrigger(scheduledTrigger)}
                      className={`text-xs font-mono px-3 py-1 rounded-full border transition-colors shrink-0 ${
                        scheduledTrigger.is_enabled
                          ? "border-purple-400/30 text-purple-400 bg-purple-400/10 hover:bg-purple-400/20"
                          : "border-gray-700 text-gray-500 hover:text-gray-300"
                      }`}
                    >
                      {scheduledTrigger.is_enabled ? "● active" : "○ paused"}
                    </button>
                  </div>
                )}

                {/* Footer stats */}
                <div className="px-6 py-3 flex items-center gap-6 text-gray-600 text-xs font-mono">
                  <span>
                    {pRuns.length} run{pRuns.length !== 1 ? "s" : ""}
                  </span>
                  {lastRun && (
                    <span>
                      last: {new Date(lastRun.started_at).toLocaleDateString()}{" "}
                      {new Date(lastRun.started_at).toLocaleTimeString()}
                    </span>
                  )}
                  <span>
                    deployed: {new Date(p.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// 🔗 WEBHOOKS VIEW
// ══════════════════════════════════════════════════════════════
function WebhooksView({ api }: { api: ReturnType<typeof useApi> }) {
  const [triggers, setTriggers] = useState<Trigger[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const t = await api.get("/triggers");
    setTriggers(
      (Array.isArray(t) ? t : []).filter(
        (t: Trigger) => t.trigger_type === "webhook",
      ),
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = async (t: Trigger) => {
    await api.patch(`/triggers/${t.id}`, { is_enabled: !t.is_enabled });
    await load();
  };

  const del = async (id: string) => {
    await api.del(`/triggers/${id}`);
    await load();
  };

  if (loading) return <Spinner />;

  return (
    <div className="p-8">
      <h2 className="text-white font-semibold text-xl mb-1">🔗 Webhook URLs</h2>
      <p className="text-gray-500 text-sm mb-8">
        Permanent URLs — paste into Stripe, Typeform, GitHub, Telegram, or any
        service
      </p>

      {triggers.length === 0 ? (
        <Empty
          emoji="🔗"
          title="No webhooks yet"
          desc="Webhooks are auto-created when you deploy a pipeline from the desktop app"
        />
      ) : (
        <div className="space-y-3">
          {triggers.map((t) => (
            <div
              key={t.id}
              className="bg-[#111118] border border-white/[0.06] rounded-xl p-5"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-white font-medium text-sm">
                    {t.name}
                  </span>
                  <span className="text-gray-600 text-xs font-mono border border-white/[0.06] px-2 py-0.5 rounded">
                    webhook
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggle(t)}
                    className={`text-xs font-mono px-3 py-1 rounded-full border transition-colors ${
                      t.is_enabled
                        ? "border-[#00ff88]/30 text-[#00ff88] bg-[#00ff88]/10 hover:bg-[#00ff88]/20"
                        : "border-gray-700 text-gray-500 hover:text-gray-300"
                    }`}
                  >
                    {t.is_enabled ? "● active" : "○ paused"}
                  </button>
                  <button
                    onClick={() => del(t.id)}
                    className="text-gray-600 hover:text-red-400 transition-colors text-xs font-mono px-2 py-1 hover:bg-red-400/10 rounded"
                  >
                    🗑
                  </button>
                </div>
              </div>

              {t.webhook_public_url && (
                <div className="flex items-center gap-2 bg-[#0a0a0f] border border-white/[0.04] rounded-lg px-3 py-2.5">
                  <span className="text-gray-500 text-xs font-mono shrink-0">
                    POST
                  </span>
                  <span className="text-[#00ff88] text-xs font-mono flex-1 truncate">
                    {t.webhook_public_url}
                  </span>
                  <CopyBtn text={t.webhook_public_url} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// ⏰ SCHEDULES VIEW
// ══════════════════════════════════════════════════════════════
function SchedulesView({ api }: { api: ReturnType<typeof useApi> }) {
  const [triggers, setTriggers] = useState<Trigger[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const t = await api.get("/triggers");
    setTriggers(
      (Array.isArray(t) ? t : []).filter(
        (t: Trigger) =>
          t.trigger_type === "interval" || t.trigger_type === "daily",
      ),
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = async (t: Trigger) => {
    await api.patch(`/triggers/${t.id}`, { is_enabled: !t.is_enabled });
    await load();
  };

  const del = async (id: string) => {
    await api.del(`/triggers/${id}`);
    await load();
  };

  if (loading) return <Spinner />;

  return (
    <div className="p-8">
      <h2 className="text-white font-semibold text-xl mb-1">
        ⏰ Scheduled Triggers
      </h2>
      <p className="text-gray-500 text-sm mb-8">
        Pipelines that run automatically on a timer
      </p>

      {triggers.length === 0 ? (
        <Empty
          emoji="⏰"
          title="No scheduled triggers yet"
          desc="Set an interval or daily time when deploying a pipeline from the desktop app"
        />
      ) : (
        <div className="space-y-3">
          {triggers.map((t) => (
            <div
              key={t.id}
              className="bg-[#111118] border border-white/[0.06] rounded-xl p-5"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-2 h-2 rounded-full ${t.is_enabled ? "bg-purple-400" : "bg-gray-600"}`}
                  />
                  <span className="text-white font-medium text-sm">
                    {t.name}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggle(t)}
                    className={`text-xs font-mono px-3 py-1 rounded-full border transition-colors ${
                      t.is_enabled
                        ? "border-purple-400/30 text-purple-400 bg-purple-400/10 hover:bg-purple-400/20"
                        : "border-gray-700 text-gray-500 hover:text-gray-300"
                    }`}
                  >
                    {t.is_enabled ? "● active" : "○ paused"}
                  </button>
                  <button
                    onClick={() => del(t.id)}
                    className="text-gray-600 hover:text-red-400 transition-colors text-xs font-mono px-2 py-1 hover:bg-red-400/10 rounded"
                  >
                    🗑
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="bg-[#0a0a0f] border border-white/[0.04] rounded-lg px-4 py-3">
                  <div className="text-gray-600 text-[10px] font-mono uppercase mb-1">
                    schedule
                  </div>
                  <div className="text-purple-400 text-xs font-mono">
                    {scheduleLabel(t)}
                  </div>
                </div>
                <div className="bg-[#0a0a0f] border border-white/[0.04] rounded-lg px-4 py-3">
                  <div className="text-gray-600 text-[10px] font-mono uppercase mb-1">
                    last fired
                  </div>
                  <div className="text-gray-400 text-xs font-mono">
                    {t.last_fired_at ? timeAgo(t.last_fired_at) : "never"}
                  </div>
                </div>
                <div className="bg-[#0a0a0f] border border-white/[0.04] rounded-lg px-4 py-3">
                  <div className="text-gray-600 text-[10px] font-mono uppercase mb-1">
                    status
                  </div>
                  <div
                    className={`text-xs font-mono ${t.is_enabled ? "text-[#00ff88]" : "text-gray-600"}`}
                  >
                    {t.is_enabled ? "● running" : "○ paused"}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// 📊 RUN LOGS VIEW
// ══════════════════════════════════════════════════════════════
function RunLogsView({ runs, loading }: { runs: Run[]; loading: boolean }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");

  if (loading) return <Spinner />;

  const filtered =
    filter === "all" ? runs : runs.filter((r) => r.status === filter);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-white font-semibold text-xl mb-1">📊 Run Logs</h2>
          <p className="text-gray-500 text-sm">
            Every pipeline execution — {runs.length} total
          </p>
        </div>
        <div className="flex items-center gap-2">
          {["all", "success", "failed", "running"].map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`text-xs font-mono px-3 py-1.5 rounded-full border transition-colors ${
                filter === s
                  ? "border-[#00ff88]/30 text-[#00ff88] bg-[#00ff88]/10"
                  : "border-white/[0.06] text-gray-600 hover:text-gray-400"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <Empty
          emoji="📋"
          title="No runs yet"
          desc="Trigger a pipeline via webhook or schedule to see execution logs here"
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((r) => (
            <div
              key={r.id}
              onClick={() => setSelected(selected === r.id ? null : r.id)}
              className="bg-[#111118] border border-white/[0.06] rounded-xl px-5 py-4 cursor-pointer hover:border-white/[0.12] transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <StatusBadge status={r.status} />
                  <span className="text-gray-500 text-xs font-mono">
                    {r.trigger_source}
                  </span>
                  <span className="text-gray-700 text-xs font-mono">
                    {r.id.slice(0, 8)}…
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-gray-600 text-xs font-mono">
                    {timeAgo(r.started_at)}
                  </span>
                  <span className="text-gray-700 text-xs font-mono">
                    {new Date(r.started_at).toLocaleDateString()}{" "}
                    {new Date(r.started_at).toLocaleTimeString()}
                  </span>
                </div>
              </div>

              {selected === r.id && (
                <div className="mt-4">
                  {r.logs ? (
                    <div className="bg-[#0a0a0f] border border-white/[0.04] rounded-lg p-4 overflow-auto max-h-72">
                      <pre className="text-[#00ff88] text-xs font-mono whitespace-pre-wrap leading-relaxed">
                        {r.logs}
                      </pre>
                    </div>
                  ) : (
                    <p className="text-gray-600 text-xs font-mono">
                      No logs available for this run
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// ⚙️ SETTINGS VIEW
// ══════════════════════════════════════════════════════════════
function SettingsView({
  api,
  subscription,
}: {
  api: ReturnType<typeof useApi>;
  subscription: Subscription | null;
}) {
  const [token, setToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [upgrading, setUpgrading] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("zygo_api_token");
    if (stored) setToken(stored);
  }, []);

  const copy = () => {
    if (!token) return;
    navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleUpgrade = async () => {
    setUpgrading(true);
    try {
      const data = await api.post("/subscribe");
      if (data.checkout_url) {
        window.location.href = data.checkout_url;
      }
    } catch (e) {
      alert("Error creating checkout session");
    }
    setUpgrading(false);
  };

  const runsUsed = subscription?.runs_used ?? 0;
  const runsLimit = subscription?.runs_limit ?? 50;
  const isPro = subscription?.plan === "pro";
  const percentUsed = isPro ? 0 : Math.min((runsUsed / runsLimit) * 100, 100);
  const isNearLimit = percentUsed >= 80;
  const isAtLimit = percentUsed >= 100;

  return (
    <div className="p-8 max-w-xl">
      <h2 className="text-white font-semibold text-xl mb-1">⚙️ Settings</h2>
      <p className="text-gray-500 text-sm mb-8">
        Connect your desktop app to the cloud
      </p>

      {/* ── Plan & Usage Card ── */}
      <div className="bg-[#111118] border border-white/[0.06] rounded-xl p-6 mb-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-medium">🚀 Your Plan</h3>
          <span
            className={`text-xs font-mono px-2 py-1 rounded-full border ${
              isPro
                ? "border-[#00ff88]/30 text-[#00ff88] bg-[#00ff88]/10"
                : "border-gray-700 text-gray-400"
            }`}
          >
            {isPro ? "● Pro" : "○ Free"}
          </span>
        </div>

        {isPro ? (
          <>
            <p className="text-gray-400 text-sm mb-4">
              You&apos;re on the Pro plan — unlimited runs, all triggers active.
            </p>

            <button
              onClick={async () => {
                if (
                  !confirm(
                    "Cancel your Pro subscription? You'll keep access until the end of your billing period.",
                  )
                )
                  return;

                const data = await api.post("/unsubscribe");

                if (data.ok)
                  alert(
                    "Subscription cancelled. You'll keep Pro until end of billing period.",
                  );
                else alert(data.detail || "Error cancelling subscription");
              }}
              className="w-full border border-red-500/30 text-red-400 hover:bg-red-400/10 text-sm font-mono py-2 px-4 rounded-lg transition-colors"
            >
              Cancel Subscription
            </button>
          </>
        ) : (
          <>
            <div className="flex justify-between text-xs font-mono text-gray-500 mb-2">
              <span>{runsUsed} runs used</span>
              <span>{runsLimit} runs limit</span>
            </div>
            <div className="w-full bg-white/[0.05] rounded-full h-2 mb-3">
              <div
                className={`h-2 rounded-full transition-all duration-500 ${
                  isAtLimit
                    ? "bg-red-500"
                    : isNearLimit
                      ? "bg-yellow-400"
                      : "bg-[#00ff88]"
                }`}
                style={{ width: `${percentUsed}%` }}
              />
            </div>
            {isAtLimit && (
              <p className="text-red-400 text-xs font-mono mb-3">
                ⚠️ Run limit reached — all triggers paused. Upgrade to resume.
              </p>
            )}
            {isNearLimit && !isAtLimit && (
              <p className="text-yellow-400 text-xs font-mono mb-3">
                ⚡ You&apos;re almost at your limit — upgrade soon.
              </p>
            )}
          </>
        )}

        {!isPro && (
          <button
            onClick={handleUpgrade}
            disabled={upgrading}
            className="mt-4 w-full bg-[#00ff88] hover:bg-[#00ff88]/90 text-black font-bold text-sm py-2.5 px-4 rounded-lg transition-colors disabled:opacity-60"
          >
            {upgrading
              ? "Redirecting..."
              : "⚡ Upgrade to Pro — Unlimited Runs"}
          </button>
        )}
      </div>

      {/* ── API Token Card ── */}
      <div className="bg-[#111118] border border-white/[0.06] rounded-xl p-6 mb-5">
        <h3 className="text-white font-medium mb-1">🔑 Your API Token</h3>
        <p className="text-gray-500 text-sm mb-4">
          Copy this into your desktop app → ⚙️ Settings → Zygoflow API Token
        </p>
        {token ? (
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-[#0a0a0f] border border-white/[0.04] rounded-lg px-4 py-2.5 font-mono text-xs text-[#00ff88] truncate">
              {token}
            </div>
            <button
              onClick={copy}
              className="bg-[#00ff88]/10 border border-[#00ff88]/20 text-[#00ff88] text-xs font-mono px-4 py-2.5 rounded-lg hover:bg-[#00ff88]/20 transition-colors shrink-0"
            >
              {copied ? "✓ copied!" : "📋 copy"}
            </button>
          </div>
        ) : (
          <p className="text-gray-500 text-sm font-mono">
            Token not found — try logging out and back in.
          </p>
        )}
      </div>

      {/* ── How to connect ── */}
      <div className="bg-[#111118] border border-white/[0.06] rounded-xl p-6 mb-5">
        <h3 className="text-white font-medium mb-4">
          🚀 How to connect desktop app
        </h3>
        <ol className="space-y-3">
          {[
            "Copy your API token above",
            "Open the Zygoflow desktop app",
            "Go to ⚙️ Settings → Zygoflow Cloud section",
            "Paste token → click 🔗 Test Connection",
            "Add your E2B API key from e2b.dev/dashboard",
            "Build your pipeline → click ☁️ Deploy to Cloud",
            "Your permanent webhook URL appears on the pipeline card",
          ].map((step, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="w-5 h-5 rounded-full bg-[#00ff88]/10 border border-[#00ff88]/20 text-[#00ff88] text-xs font-mono flex items-center justify-center shrink-0 mt-0.5">
                {i + 1}
              </span>
              <span className="text-gray-400 text-sm">{step}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="bg-[#0a0a0f] border border-white/[0.04] rounded-xl p-5">
        <p className="text-gray-600 text-xs font-mono leading-relaxed">
          💡 <strong className="text-gray-400">E2B</strong> is the cloud sandbox
          that runs your Python pipelines securely. Each user uses their own E2B
          API key and pays for their own usage (~$0.000225/sec). Get yours at{" "}
          <a
            href="https://e2b.dev/dashboard"
            target="_blank"
            className="text-[#00ff88] hover:underline"
          >
            e2b.dev/dashboard
          </a>
        </p>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// MAIN DASHBOARD
// ══════════════════════════════════════════════════════════════
const NAV = [
  { id: "pipelines", label: "☁️ Pipelines" },
  { id: "webhooks", label: "🔗 Webhooks" },
  { id: "schedules", label: "⏰ Schedules" },
  { id: "runs", label: "📊 Run Logs" },
  { id: "settings", label: "⚙️ Settings" },
];

export default function AgentsDashboard() {
  const [active, setActive] = useState("pipelines");
  const [runs, setRuns] = useState<Run[]>([]);
  const [runsLoading, setRunsLoading] = useState(true);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const { user, logout } = useAuth();
  const router = useRouter();

  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("zygo_api_token")
      : null;
  const api = useApi(token);

  const loadRuns = useCallback(async () => {
    setRunsLoading(true);
    const r = await api.get("/runs");
    setRuns(Array.isArray(r) ? r : []);
    setRunsLoading(false);
  }, [token]);

  const loadSubscription = useCallback(async () => {
    const s = await api.get("/subscription");
    if (s && s.runs_limit !== undefined) setSubscription(s);
  }, [token]);

  useEffect(() => {
    loadRuns();
    loadSubscription();
  }, [loadRuns, loadSubscription]);

  useEffect(() => {
    const interval = setInterval(() => {
      loadRuns();
      loadSubscription();
    }, 10000);
    return () => clearInterval(interval);
  }, [loadRuns, loadSubscription]);

  const handleLogout = async () => {
    await logout();
    router.push("/agents/login");
  };

  const successCount = runs.filter((r) => r.status === "success").length;
  const failedCount = runs.filter((r) => r.status === "failed").length;
  const runningCount = runs.filter((r) => r.status === "running").length;

  const isPro = subscription?.plan === "pro";
  const runsUsed = subscription?.runs_used ?? 0;
  const runsLimit = subscription?.runs_limit ?? 50;
  const usagePercent = isPro ? 0 : Math.min((runsUsed / runsLimit) * 100, 100);
  const isAtLimit = !isPro && usagePercent >= 100;
  const isNearLimit = !isPro && usagePercent >= 80;

  const renderView = () => {
    switch (active) {
      case "pipelines":
        return <PipelinesView api={api} runs={runs} />;
      case "webhooks":
        return <WebhooksView api={api} />;
      case "schedules":
        return <SchedulesView api={api} />;
      case "runs":
        return <RunLogsView runs={runs} loading={runsLoading} />;
      case "settings":
        return <SettingsView api={api} subscription={subscription} />;
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex font-sans">
      {/* Grid bg */}
      <div
        className="fixed inset-0 opacity-[0.015] pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(#00ff88 1px, transparent 1px), linear-gradient(90deg, #00ff88 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      {/* Sidebar */}
      <aside className="w-56 bg-[#0d0d14] border-r border-white/[0.05] flex flex-col z-10 fixed h-full">
        {/* Logo */}
        <div className="p-5 border-b border-white/[0.05]">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#00ff88] flex items-center justify-center">
              <span className="text-black font-black text-xs">Z</span>
            </div>
            <div>
              <div className="text-white font-bold text-sm tracking-tight">
                zygoflow
              </div>
              <div className="text-[#00ff88] text-[10px] font-mono">agents</div>
            </div>
          </div>
        </div>

        {/* Live stats */}
        <div className="px-4 py-3 border-b border-white/[0.05] grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="text-[#00ff88] font-mono text-sm font-bold">
              {successCount}
            </div>
            <div className="text-gray-600 text-[10px] font-mono">ok</div>
          </div>
          <div>
            <div className="text-red-400 font-mono text-sm font-bold">
              {failedCount}
            </div>
            <div className="text-gray-600 text-[10px] font-mono">failed</div>
          </div>
          <div>
            <div
              className={`font-mono text-sm font-bold ${runningCount > 0 ? "text-blue-400" : "text-gray-600"}`}
            >
              {runningCount}
            </div>
            <div className="text-gray-600 text-[10px] font-mono">live</div>
          </div>
        </div>

        {/* Usage bar — only shown for free users */}
        {subscription && !isPro && (
          <div className="px-4 py-3 border-b border-white/[0.05]">
            <div className="flex justify-between text-[10px] font-mono mb-1.5">
              <span
                className={
                  isAtLimit
                    ? "text-red-400"
                    : isNearLimit
                      ? "text-yellow-400"
                      : "text-gray-600"
                }
              >
                {isAtLimit ? "⚠️ limit reached" : "runs"}
              </span>
              <span className="text-gray-600">
                {runsUsed}/{runsLimit}
              </span>
            </div>
            <div className="w-full bg-white/[0.05] rounded-full h-1">
              <div
                className={`h-1 rounded-full transition-all duration-500 ${
                  isAtLimit
                    ? "bg-red-500"
                    : isNearLimit
                      ? "bg-yellow-400"
                      : "bg-[#00ff88]"
                }`}
                style={{ width: `${usagePercent}%` }}
              />
            </div>
            {isAtLimit && (
              <button
                onClick={() => setActive("settings")}
                className="mt-2 w-full text-[10px] font-mono text-black bg-[#00ff88] hover:bg-[#00ff88]/90 py-1 rounded transition-colors"
              >
                ⚡ Upgrade
              </button>
            )}
          </div>
        )}

        {/* Pro badge in sidebar */}
        {subscription && isPro && (
          <div className="px-4 py-3 border-b border-white/[0.05]">
            <div className="text-[10px] font-mono text-[#00ff88] bg-[#00ff88]/10 border border-[#00ff88]/20 rounded px-2 py-1 text-center">
              ● Pro — unlimited runs
            </div>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-0.5">
          {NAV.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setActive(id)}
              className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all ${
                active === id
                  ? "bg-[#00ff88]/10 text-[#00ff88] border border-[#00ff88]/20"
                  : "text-gray-500 hover:text-gray-300 hover:bg-white/[0.04]"
              }`}
            >
              {label}
            </button>
          ))}
        </nav>

        {/* User + logout */}
        <div className="p-3 border-t border-white/[0.05]">
          <div className="px-3 py-2 mb-1">
            <div className="text-gray-400 text-xs truncate">
              {user?.email || "—"}
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-400/5 transition-colors text-sm"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              className="w-4 h-4"
            >
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
            </svg>
            Logout
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 ml-56 min-h-screen overflow-y-auto">
        {renderView()}
      </main>
    </div>
  );
}
