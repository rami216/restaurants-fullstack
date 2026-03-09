"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

// ── Icons (inline SVG to avoid extra deps) ──────────────────
const icons = {
  zap: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      className="w-4 h-4"
    >
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  ),
  plug: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      className="w-4 h-4"
    >
      <path d="M18 6L6 18M7 6v5a5 5 0 005 5h5" />
      <path d="M10 2v4M14 2v4" />
    </svg>
  ),
  clock: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      className="w-4 h-4"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  google: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      className="w-4 h-4"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M9 12h6M12 9v6" />
    </svg>
  ),
  settings: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      className="w-4 h-4"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  ),
  logout: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      className="w-4 h-4"
    >
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
    </svg>
  ),
  activity: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      className="w-4 h-4"
    >
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  ),
};

const NAV = [
  { id: "pipelines", label: "⚡ God Mode", icon: icons.zap },
  { id: "apis", label: "🔌 Custom APIs", icon: icons.plug },
  { id: "triggers", label: "⏰ Triggers", icon: icons.clock },
  { id: "google", label: "🟢 Google", icon: icons.google },
  { id: "runs", label: "📊 Run Logs", icon: icons.activity },
  { id: "settings", label: "⚙️ Settings", icon: icons.settings },
];

// ── Placeholder views ────────────────────────────────────────

function ComingSoon({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center py-32">
      <div className="w-16 h-16 rounded-2xl bg-[#00ff88]/10 border border-[#00ff88]/20 flex items-center justify-center mb-6 text-2xl">
        ⚡
      </div>
      <h2 className="text-white font-semibold text-xl mb-2">{title}</h2>
      <p className="text-gray-500 text-sm max-w-xs">
        This section is being built. Check back soon!
      </p>
    </div>
  );
}

function PipelinesView() {
  const [agents, setAgents] = useState([
    {
      id: 1,
      name: "Data Fetcher",
      prompt: "Fetch data from the API and save to sheet",
      model: "openai",
    },
    {
      id: 2,
      name: "Email Sender",
      prompt: "Send summary email with the results",
      model: "openai",
    },
  ]);
  const [pipelineName, setPipelineName] = useState("My Pipeline");

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-white font-semibold text-xl">
            ⚡ God Mode Pipeline Builder
          </h2>
          <p className="text-gray-500 text-sm mt-1">
            Build multi-step AI agent pipelines
          </p>
        </div>
        <button className="bg-[#00ff88] text-black text-sm font-bold px-4 py-2 rounded-lg hover:bg-[#00ff88]/90 transition-colors">
          + New Pipeline
        </button>
      </div>

      {/* Pipeline name */}
      <div className="mb-6">
        <label className="text-gray-400 text-xs font-mono mb-2 block">
          PIPELINE NAME
        </label>
        <input
          value={pipelineName}
          onChange={(e) => setPipelineName(e.target.value)}
          className="bg-[#111118] border border-white/[0.08] rounded-lg px-4 py-2.5 text-white text-sm w-full max-w-xs focus:outline-none focus:border-[#00ff88]/40"
        />
      </div>

      {/* Agent nodes */}
      <div className="space-y-3 mb-6">
        {agents.map((agent, i) => (
          <div
            key={agent.id}
            className="bg-[#111118] border border-white/[0.06] rounded-xl p-5"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-[#00ff88]/10 border border-[#00ff88]/20 flex items-center justify-center text-[#00ff88] text-xs font-mono font-bold">
                  {i + 1}
                </div>
                <input
                  defaultValue={agent.name}
                  className="bg-transparent text-white text-sm font-medium focus:outline-none border-b border-transparent hover:border-white/20 focus:border-[#00ff88]/40 transition-colors pb-0.5"
                />
              </div>
              <div className="flex items-center gap-2">
                <select
                  defaultValue={agent.model}
                  className="bg-[#0a0a0f] border border-white/[0.08] rounded-lg px-3 py-1.5 text-xs text-gray-300 focus:outline-none"
                >
                  <option value="openai">🟢 GPT-4o</option>
                  <option value="claude">🟣 Claude</option>
                </select>
                <button
                  onClick={() =>
                    setAgents(agents.filter((a) => a.id !== agent.id))
                  }
                  className="text-gray-600 hover:text-red-400 transition-colors text-lg leading-none"
                >
                  ×
                </button>
              </div>
            </div>
            <textarea
              defaultValue={agent.prompt}
              rows={2}
              placeholder="Describe what this agent should do..."
              className="w-full bg-[#0a0a0f] border border-white/[0.06] rounded-lg px-3 py-2.5 text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:border-[#00ff88]/30 resize-none"
            />
            <div className="flex gap-2 mt-3">
              <button className="text-xs bg-[#00ff88]/10 text-[#00ff88] border border-[#00ff88]/20 px-3 py-1.5 rounded-lg hover:bg-[#00ff88]/20 transition-colors font-mono">
                🤖 Generate Code
              </button>
              <button className="text-xs bg-white/[0.04] text-gray-400 border border-white/[0.06] px-3 py-1.5 rounded-lg hover:bg-white/[0.08] transition-colors font-mono">
                ▶ Run
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add agent */}
      <button
        onClick={() =>
          setAgents([
            ...agents,
            {
              id: Date.now(),
              name: `Agent ${agents.length + 1}`,
              prompt: "",
              model: "openai",
            },
          ])
        }
        className="w-full border border-dashed border-white/10 rounded-xl py-4 text-gray-500 text-sm hover:border-[#00ff88]/30 hover:text-[#00ff88] transition-colors"
      >
        + Add Sub-Agent
      </button>

      {/* Run pipeline */}
      <div className="flex gap-3 mt-8">
        <button className="bg-[#00ff88] text-black font-bold px-6 py-2.5 rounded-lg hover:bg-[#00ff88]/90 transition-colors text-sm">
          ▶ Run Pipeline
        </button>
        <button className="bg-white/[0.04] text-gray-300 border border-white/[0.06] px-6 py-2.5 rounded-lg hover:bg-white/[0.08] transition-colors text-sm">
          💾 Save
        </button>
      </div>
    </div>
  );
}

function SettingsView() {
  return (
    <div className="p-8 max-w-lg">
      <h2 className="text-white font-semibold text-xl mb-2">⚙️ Settings</h2>
      <p className="text-gray-500 text-sm mb-8">Configure your API keys</p>

      <div className="space-y-5">
        {[
          { label: "OpenAI API Key", placeholder: "sk-...", type: "password" },
          {
            label: "Claude API Key",
            placeholder: "sk-ant-...",
            type: "password",
          },
          {
            label: "ngrok Auth Token",
            placeholder: "Your ngrok token",
            type: "password",
          },
        ].map(({ label, placeholder, type }) => (
          <div key={label}>
            <label className="text-gray-400 text-xs font-mono mb-2 block">
              {label.toUpperCase()}
            </label>
            <input
              type={type}
              placeholder={placeholder}
              className="w-full bg-[#111118] border border-white/[0.08] rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#00ff88]/40 placeholder-gray-600"
            />
          </div>
        ))}

        <div>
          <label className="text-gray-400 text-xs font-mono mb-2 block">
            ACTIVE MODEL
          </label>
          <select className="w-full bg-[#111118] border border-white/[0.08] rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none">
            <option value="openai">🟢 GPT-4o</option>
            <option value="claude">🟣 Claude</option>
          </select>
        </div>

        <button className="w-full bg-[#00ff88] text-black font-bold py-2.5 rounded-lg hover:bg-[#00ff88]/90 transition-colors text-sm mt-2">
          Save Settings
        </button>
      </div>
    </div>
  );
}

// ── Main Dashboard ───────────────────────────────────────────

export default function AgentsDashboard() {
  const [active, setActive] = useState("pipelines");
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.push("/agents/login");
  };

  const renderView = () => {
    switch (active) {
      case "pipelines":
        return <PipelinesView />;
      case "settings":
        return <SettingsView />;
      default:
        return (
          <ComingSoon
            title={NAV.find((n) => n.id === active)?.label || active}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex font-sans">
      {/* Background grid */}
      <div
        className="fixed inset-0 opacity-[0.02] pointer-events-none"
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

        {/* User */}
        <div className="p-3 border-t border-white/[0.05]">
          <div className="px-3 py-2 mb-1">
            <div className="text-gray-400 text-xs truncate">
              {user?.email || "user@example.com"}
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-400/5 transition-colors text-sm"
          >
            {icons.logout}
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
