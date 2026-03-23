"use client";

import React, { useEffect, useState, useRef } from "react";
import api from "@/lib/axios";
import BrandForm from "@/components/BrandForm";
import LocationForm from "@/components/LocationForm";
import { tableConfigs } from "@/constants/tableConfigs";
import { useSubscription } from "@/context/SubscriptionContext";
import Link from "next/link";
import {
  CheckCircle,
  XCircle,
  MapPin,
  Plus,
  Trash2,
  Save,
  ChevronDown,
  Settings,
  Bot,
  Key,
  Zap,
  Globe,
} from "lucide-react";

// ══════════════════════════════════════════════════════════════
// AI SETTINGS PANEL
// ══════════════════════════════════════════════════════════════
function AISettingsPanel({ websiteId }: { websiteId: string }) {
  const [form, setForm] = useState({
    openai_key: "",
    openai_model: "gpt-4o",
    claude_key: "",
    claude_model: "claude-sonnet-4-6",
    gemini_key: "",
    gemini_model: "gemini-2.0-flash",
    provider: "openai",
  });
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<any>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    api
      .get(`/builder/websites/${websiteId}/ai-settings`)
      .then((r) => {
        setSettings(r.data);
        setForm((prev) => ({
          ...prev,
          openai_model: r.data.user_openai_model || "gpt-4o",
          claude_model: r.data.user_claude_model || "claude-sonnet-4-6",
          gemini_model: r.data.user_gemini_model || "gemini-2.0-flash",
          provider: r.data.preferred_ai_provider || "openai",
        }));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [websiteId]);

  const set = (key: string, val: string) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  const save = async () => {
    await api.patch(`/builder/websites/${websiteId}/ai-settings`, {
      user_openai_key: form.openai_key || undefined,
      user_claude_key: form.claude_key || undefined,
      user_gemini_key: form.gemini_key || undefined,
      user_openai_model: form.openai_model,
      user_claude_model: form.claude_model,
      user_gemini_model: form.gemini_model,
      preferred_ai_provider: form.provider,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const providers = [
    { value: "openai", label: "OpenAI", icon: "🟢" },
    { value: "claude", label: "Claude", icon: "🟣" },
    { value: "gemini", label: "Gemini", icon: "🔵" },
  ];

  const fields = [
    {
      id: "openai",
      label: "OpenAI",
      keyField: "openai_key",
      keyPlaceholder: "sk-...",
      modelField: "openai_model",
      modelPlaceholder: "e.g. gpt-4o, gpt-4.5, o3",
      hasSaved: settings?.has_openai_key,
    },
    {
      id: "claude",
      label: "Claude",
      keyField: "claude_key",
      keyPlaceholder: "sk-ant-...",
      modelField: "claude_model",
      modelPlaceholder: "e.g. claude-sonnet-4-6, claude-opus-4",
      hasSaved: settings?.has_claude_key,
    },
    {
      id: "gemini",
      label: "Gemini",
      keyField: "gemini_key",
      keyPlaceholder: "AIza...",
      modelField: "gemini_model",
      modelPlaceholder: "e.g. gemini-2.0-flash, gemini-1.5-pro",
      hasSaved: settings?.has_gemini_key,
    },
  ];

  if (loading) return null;

  return (
    <div className="mt-6 w-full max-w-xl">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-3 bg-white/10 hover:bg-white/15 backdrop-blur border border-white/20 rounded-2xl transition-all text-white"
      >
        <div className="flex items-center gap-3">
          <Bot size={18} />
          <span className="font-semibold text-sm">AI Provider Settings</span>
          {settings &&
            (settings.has_openai_key ||
              settings.has_claude_key ||
              settings.has_gemini_key) && (
              <span className="text-xs bg-green-400/20 text-green-300 px-2 py-0.5 rounded-full border border-green-400/30">
                configured
              </span>
            )}
        </div>
        <ChevronDown
          size={16}
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="mt-2 bg-white rounded-2xl border border-gray-200 p-5 shadow-xl">
          <p className="text-gray-500 text-xs mb-4">
            Use your own API keys. The AI will use your key and model for all
            website builder features.
          </p>

          {/* Provider selector */}
          <div className="mb-5">
            <label className="block text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">
              Preferred Provider
            </label>
            <div className="grid grid-cols-3 gap-2">
              {providers.map((p) => (
                <button
                  key={p.value}
                  onClick={() => set("provider", p.value)}
                  className={`p-2.5 rounded-xl border text-xs font-semibold transition-all ${
                    form.provider === p.value
                      ? "border-pink-400 bg-pink-50 text-pink-700"
                      : "border-gray-200 hover:border-gray-300 text-gray-500"
                  }`}
                >
                  {p.icon} {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Key + Model inputs */}
          <div className="space-y-4">
            {fields.map((f) => (
              <div
                key={f.id}
                className={`p-3.5 rounded-xl border transition-all ${
                  form.provider === f.id
                    ? "border-pink-300 bg-pink-50/40"
                    : "border-gray-100 bg-gray-50/50"
                }`}
              >
                <div className="flex items-center gap-2 mb-2.5">
                  <span className="text-xs font-bold text-gray-700">
                    {f.label}
                  </span>
                  {f.hasSaved && (
                    <span className="text-green-500 text-xs">✅ Key saved</span>
                  )}
                  {form.provider === f.id && (
                    <span className="ml-auto text-[10px] bg-pink-100 text-pink-600 px-2 py-0.5 rounded-full font-semibold">
                      Active
                    </span>
                  )}
                </div>
                <input
                  type="password"
                  placeholder={f.keyPlaceholder}
                  value={(form as any)[f.keyField]}
                  onChange={(e) => set(f.keyField, e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-xs mb-1.5 focus:outline-none focus:border-pink-400 bg-white text-gray-900"
                />
                <input
                  type="text"
                  placeholder={f.modelPlaceholder}
                  value={(form as any)[f.modelField]}
                  onChange={(e) => set(f.modelField, e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-pink-400 font-mono bg-white text-gray-900"
                />
              </div>
            ))}
          </div>

          <button
            onClick={save}
            className="mt-4 w-full bg-gradient-to-r from-pink-500 to-red-500 text-white font-semibold py-2.5 rounded-xl hover:opacity-90 transition-opacity text-sm"
          >
            {saved ? "✅ Saved!" : "💾 Save AI Settings"}
          </button>

          <p className="text-gray-400 text-[10px] mt-2 text-center">
            Keys are stored securely. Leave blank to use platform credits.
          </p>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════
const tableNames = [
  "locations",
  "categories",
  "menu_items",
  "extras",
  "menu_item_extras",
  "option_groups",
  "option_choices",
  "menu_item_options",
  "schedules",
];

const MainPage = () => {
  const { subscriptionStatus, creditBalance } = useSubscription();

  // ── state ──────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [hasRestaurant, setHasRestaurant] = useState<boolean | null>(null);
  const [hasBrand, setHasBrand] = useState<boolean | null>(null);
  const [hasLocations, setHasLocations] = useState(false);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [websiteId, setWebsiteId] = useState<string | null>(null);
  const [brandId, setBrandId] = useState<string | null>(null);
  const [brandName, setBrandName] = useState("");
  const [showBrandForm, setShowBrandForm] = useState(false);
  const [showLocationForm, setShowLocationForm] = useState(false);
  const [locationName, setLocationName] = useState("");
  const [address, setAddress] = useState("");
  const [locationEmail, setLocationEmail] = useState("");
  const [selectedTable, setSelectedTable] = useState("");
  const [selectedData, setSelectedData] = useState<any[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(
    null,
  );
  const [hasMenuItems, setHasMenuItems] = useState(false);
  const [hasSchedules, setHasSchedules] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<Record<number, File | null>>(
    {},
  );
  const [uploadingImageIndex, setUploadingImageIndex] = useState<number | null>(
    null,
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dropdownOptions, setDropdownOptions] = useState<any>({
    locations: [],
    categories: [],
    menu_items: [],
    extras: [],
    option_groups: [],
    days_of_week: [
      { id: "Monday", name: "Monday" },
      { id: "Tuesday", name: "Tuesday" },
      { id: "Wednesday", name: "Wednesday" },
      { id: "Thursday", name: "Thursday" },
      { id: "Friday", name: "Friday" },
      { id: "Saturday", name: "Saturday" },
      { id: "Sunday", name: "Sunday" },
    ],
  });

  // ── resolveImageSrc ────────────────────────────────────────
  const resolveImageSrc = (val: string | null | undefined) => {
    if (!val) return "https://placehold.co/60x60/e2e8f0/a0aec0?text=No+Image";
    if (
      val.startsWith("http") ||
      val.startsWith("blob:") ||
      val.startsWith("data:")
    )
      return val;
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "");
    if (!base) return "https://placehold.co/60x60/fecaca/991b1b?text=Bad+URL";
    if (val.startsWith("/")) return `${base}${val}`;
    return `${base}/storage/v1/object/public/menu_item_images/${val}`;
  };

  // ── setup flow ─────────────────────────────────────────────
  const checkRestaurant = async () => {
    try {
      const res = await api.get("/restaurants/has-restaurant");
      if (res.data.has_restaurant) {
        setHasRestaurant(true);
        setRestaurantId(res.data.restaurant_id);
        try {
          const wRes = await api.get("/builder/my-website-id");
          setWebsiteId(wRes.data.website_id);
        } catch {}
        await checkBrand(res.data.restaurant_id);
      } else {
        setHasRestaurant(false);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const createRestaurant = async () => {
    try {
      await api.post("/restaurants/create", {
        owner_email: "",
        owner_name: "",
      });
      await checkRestaurant();
    } catch {
      alert("Error creating restaurant.");
    }
  };

  const createBrand = async () => {
    try {
      await api.post("/restaurants/create-brand", { name: brandName });
      await checkBrand(restaurantId);
    } catch {
      alert("Error creating brand.");
    }
  };

  const checkBrand = async (id: string | null) => {
    if (!id) return;
    try {
      const res = await api.get("/restaurants/has-brand");
      if (res.data.has_brand) {
        setHasBrand(true);
        setBrandId(res.data.brand_id);
        setBrandName(res.data.brand_name);
        await checkLocations();
      } else {
        setHasBrand(false);
      }
    } catch {}
  };

  const checkLocations = async () => {
    try {
      const res = await api.get("/locations/has-location");
      const locations = Array.isArray(res.data) ? res.data : [];
      setHasLocations(locations.length > 0);
      setDropdownOptions((prev: any) => ({ ...prev, locations }));
      if (locations.length > 0) {
        setSelectedLocationId(locations[0].location_id);
        await checkDataCompleteness(locations[0].location_id);
      } else {
        setSelectedLocationId(null);
        setHasMenuItems(false);
        setHasSchedules(false);
      }
    } catch {
      setHasLocations(false);
    }
  };

  const checkDataCompleteness = async (locationId: string) => {
    try {
      const [m, s] = await Promise.all([
        api.get(`/locations/${locationId}/menu`),
        api.get(`/schedules/by-location/${locationId}`),
      ]);
      setHasMenuItems(m.data.length > 0);
      setHasSchedules(s.data.length > 0);
    } catch {
      setHasMenuItems(false);
      setHasSchedules(false);
    }
  };

  const createLocation = async () => {
    if (!restaurantId || !brandId)
      return alert("Missing restaurant or brand ID.");
    try {
      await api.post("/locations/create-location", {
        brand_id: brandId,
        location_name: locationName,
        address,
        phone_number: "",
        maps_link: "",
        location_owner_email: locationEmail,
        restaurant_id: restaurantId,
        business_info_only: false,
      });
      await checkLocations();
    } catch {
      alert("Error creating location.");
    }
  };

  const handleLocationChange = async (id: string) => {
    setSelectedLocationId(id);
    await checkDataCompleteness(id);
    if (selectedTable) await handleTableClick(selectedTable, id);
  };

  useEffect(() => {
    checkRestaurant();
  }, []);

  // ── table data ─────────────────────────────────────────────
  const handleTableClick = async (
    tableName: string,
    locationIdOverride?: string | null,
  ) => {
    setSelectedTable(tableName);
    setSelectedData([]);
    const config = tableConfigs[tableName];
    if (!config) return;
    const locationId =
      locationIdOverride !== undefined
        ? locationIdOverride
        : selectedLocationId;
    if (!locationId && !["locations", "categories"].includes(tableName))
      return alert("Please select a location first.");

    try {
      let mainData: any[] = [];
      let newDropdowns: any = {};

      if (tableName === "locations") {
        const res = await api.get("/locations/has-location");
        mainData = Array.isArray(res.data) ? res.data : [];
        setDropdownOptions((p: any) => ({ ...p, locations: mainData }));
      } else if (tableName === "categories") {
        const res = await api.get(`/restaurants/categories/${restaurantId}`);
        mainData = Array.isArray(res.data) ? res.data : [];
        newDropdowns = { categories: mainData };
      } else if (tableName === "menu_items") {
        const [m, c] = await Promise.all([
          api.get(`/locations/${locationId}/menu`),
          api.get(`/restaurants/categories/${restaurantId}`),
        ]);
        mainData = Array.isArray(m.data) ? m.data : [];
        newDropdowns = { categories: c.data };
      } else if (tableName === "extras") {
        const res = await api.get(`/extras/by-location/${locationId}`);
        mainData = Array.isArray(res.data) ? res.data : [];
      } else if (tableName === "menu_item_extras") {
        const [l, m, e] = await Promise.all([
          api.get(`/menu-item-extras/by-location/${locationId}`),
          api.get(`/locations/${locationId}/menu`),
          api.get(`/extras/by-location/${locationId}`),
        ]);
        mainData = Array.isArray(l.data) ? l.data : [];
        newDropdowns = { menu_items: m.data, extras: e.data };
      } else if (tableName === "option_groups") {
        const res = await api.get(`/option-groups/by-location/${locationId}`);
        mainData = Array.isArray(res.data) ? res.data : [];
      } else if (tableName === "option_choices") {
        const [c, g] = await Promise.all([
          api.get(`/option-choices/by-location/${locationId}`),
          api.get(`/option-groups/by-location/${locationId}`),
        ]);
        mainData = Array.isArray(c.data) ? c.data : [];
        newDropdowns = { option_groups: g.data };
      } else if (tableName === "menu_item_options") {
        const [l, m, g] = await Promise.all([
          api.get(`/menu-item-options/by-location/${locationId}`),
          api.get(`/locations/${locationId}/menu`),
          api.get(`/option-groups/by-location/${locationId}`),
        ]);
        mainData = Array.isArray(l.data) ? l.data : [];
        newDropdowns = { menu_items: m.data, option_groups: g.data };
      } else if (tableName === "schedules") {
        const res = await api.get(`/schedules/by-location/${locationId}`);
        mainData = Array.isArray(res.data) ? res.data : [];
      }

      setSelectedData(mainData);
      if (Object.keys(newDropdowns).length > 0)
        setDropdownOptions((p: any) => ({ ...p, ...newDropdowns }));
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveChanges = async () => {
    const config = tableConfigs[selectedTable];
    if (!config) return;

    const getTypedPayload = (row: any, fields: typeof config.fields) => {
      const typed: any = {};
      for (const field of fields) {
        const raw = row[field.key];
        if (raw === null || raw === undefined || raw === "") {
          typed[field.key] = field.dataType === "boolean" ? false : null;
          continue;
        }
        if (field.dataType === "number") {
          const n = parseFloat(raw);
          typed[field.key] = isNaN(n) ? null : n;
        } else if (field.dataType === "boolean")
          typed[field.key] = String(raw).toLowerCase() === "true";
        else typed[field.key] = raw;
      }
      return typed;
    };

    let updatedRows = [...selectedData];
    for (let i = 0; i < selectedData.length; i++) {
      const row = selectedData[i];
      try {
        const isExisting = row[config.primaryKey];
        const processed = getTypedPayload(row, config.fields);
        const pending = pendingFiles?.[i];
        if (pending) {
          const fd = new FormData();
          fd.append("file", pending as File);
          const up = await api.post("/uploads/image", fd, {
            headers: { "Content-Type": "multipart/form-data" },
          });
          const imageUrl = up.data?.image_url;
          if (!imageUrl) throw new Error("No image_url returned.");
          processed.image_url = imageUrl;
          updatedRows[i] = { ...updatedRows[i], image_url: imageUrl };
          delete (updatedRows[i] as any).__preview;
          setPendingFiles((prev) => {
            const n = { ...prev };
            delete n[i];
            return n;
          });
        }
        if (isExisting) {
          if (!config.updateApi) continue;
          const url = config.updateApi.replace(
            /\${(.*?)}/g,
            (_: any, k: string) => row[k] ?? "",
          );
          await api.put(url, processed);
        } else {
          if (!config.createApi) continue;
          const payload: any = { ...processed };
          if (
            [
              "menu_items",
              "extras",
              "option_groups",
              "option_choices",
              "schedules",
            ].includes(selectedTable)
          )
            payload.location_id = selectedLocationId;
          if (selectedTable === "categories")
            payload.restaurant_id = restaurantId;
          await api.post(config.createApi, payload);
        }
      } catch {
        alert("Failed to save changes.");
        return;
      }
    }
    setSelectedData(updatedRows);
    alert("Changes saved!");
    await handleTableClick(selectedTable);
  };

  const handleDeleteRow = async (item: any) => {
    const config = tableConfigs[selectedTable];
    if (!config?.deleteApi) return;
    const pkVal = item[config.primaryKey];
    if (!pkVal) {
      alert("Cannot delete row without a primary key.");
      return;
    }
    try {
      const url = config.deleteApi.replace(
        /\${(.*?)}/g,
        (_: any, k: string) => {
          const ctx: any = {
            restaurant_id: restaurantId,
            location_id: selectedLocationId,
            brand_id: brandId,
            id: pkVal,
            ...item,
          };
          return ctx[k] != null ? encodeURIComponent(String(ctx[k])) : "";
        },
      );
      await api.delete(url);
      alert("Deleted successfully!");
      await handleTableClick(selectedTable);
    } catch {
      alert("Delete failed.");
    }
  };

  const handlePickFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || uploadingImageIndex === null) return;
    setPendingFiles((prev) => ({ ...prev, [uploadingImageIndex]: file }));
    setSelectedData((prev) => {
      const rows = [...prev];
      rows[uploadingImageIndex] = {
        ...rows[uploadingImageIndex],
        image_url: URL.createObjectURL(file),
        __preview: true,
      };
      return rows;
    });
    setUploadingImageIndex(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ── render ─────────────────────────────────────────────────
  if (loading) {
    return (
      <main className="h-screen flex items-center justify-center bg-gradient-to-br from-pink-500 to-red-500">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin" />
          <p className="text-white font-medium">Loading your dashboard...</p>
        </div>
      </main>
    );
  }

  return (
    <>
      {/* ── HERO SECTION ─────────────────────────────────── */}
      <main className="min-h-[calc(90vh-64px)] flex flex-col items-center justify-center bg-gradient-to-br from-pink-500 via-red-500 to-orange-400 text-white px-4 py-12">
        {/* Setup not started */}
        {!hasRestaurant && (
          <div className="text-center max-w-md">
            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Settings size={28} />
            </div>
            <h1 className="text-3xl font-extrabold mb-3">Welcome!</h1>
            <p className="text-white/80 mb-6">
              Let's get your account set up to start building.
            </p>
            <button
              onClick={createRestaurant}
              className="bg-white text-pink-600 font-bold px-8 py-3 rounded-2xl hover:bg-pink-50 transition-all shadow-lg"
            >
              Complete Setup
            </button>
          </div>
        )}

        {/* Setup in progress */}
        {hasRestaurant && hasBrand === false && (
          <div className="text-center max-w-md">
            <h1 className="text-3xl font-extrabold mb-6">Create Your Brand</h1>
            <button
              onClick={() => setShowBrandForm(true)}
              className="bg-white text-pink-600 font-bold px-8 py-3 rounded-2xl hover:bg-pink-50 transition-all shadow-lg"
            >
              Create Brand
            </button>
            {showBrandForm && (
              <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
                <div className="bg-white p-6 rounded-2xl shadow-xl">
                  <BrandForm
                    brandName={brandName}
                    setBrandName={setBrandName}
                    onSave={() => {
                      createBrand();
                      setShowBrandForm(false);
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Fully set up */}
        {hasRestaurant && hasBrand && (
          <div className="w-full max-w-xl flex flex-col items-center">
            {/* Brand header */}
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <CheckCircle size={20} />
              </div>
              <div>
                <p className="text-white/70 text-xs font-medium uppercase tracking-wider">
                  Active Brand
                </p>
                <h1 className="text-2xl font-extrabold leading-tight">
                  {brandName}
                </h1>
              </div>
            </div>

            {/* Status badges */}
            <div className="flex flex-wrap gap-2 justify-center mb-6">
              <span
                className={`text-xs px-3 py-1 rounded-full font-semibold border ${
                  subscriptionStatus === "active"
                    ? "bg-green-400/20 border-green-300/40 text-green-100"
                    : "bg-red-400/20 border-red-300/40 text-red-100"
                }`}
              >
                {subscriptionStatus === "active"
                  ? "✅ Subscribed"
                  : "❌ No Subscription"}
              </span>
              <Link
                href="/billingPage"
                className="text-xs px-3 py-1 rounded-full font-semibold border border-white/30 bg-white/10 hover:bg-white/20 transition-all"
              >
                Manage Billing →
              </Link>
              {websiteId && (
                <Link
                  href="/createwebsite"
                  className="text-xs px-3 py-1 rounded-full font-semibold border border-white/30 bg-white/10 hover:bg-white/20 transition-all"
                >
                  🌐 Open Builder →
                </Link>
              )}
            </div>

            {/* Location selector */}
            {hasLocations ? (
              <div className="w-full bg-white/10 backdrop-blur border border-white/20 rounded-2xl p-4 mb-4">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-2">
                    <MapPin size={16} />
                    <span className="text-sm font-semibold">
                      Current Location
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={selectedLocationId || ""}
                      onChange={(e) => handleLocationChange(e.target.value)}
                      className="bg-white/20 border border-white/30 text-white text-sm px-3 py-1.5 rounded-xl focus:outline-none"
                    >
                      {dropdownOptions.locations.map((loc: any) => (
                        <option
                          key={loc.location_id}
                          value={loc.location_id}
                          className="text-gray-800"
                        >
                          {loc.location_name}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => setShowLocationForm(true)}
                      className="flex items-center gap-1 bg-white/20 hover:bg-white/30 border border-white/30 px-3 py-1.5 rounded-xl text-sm font-semibold transition-all"
                    >
                      <Plus size={14} /> Add
                    </button>
                  </div>
                </div>

                {hasMenuItems && hasSchedules && creditBalance > 0 && (
                  <a
                    href={`https://restaurants-automation.onrender.com/?restaurant_id=${restaurantId}&restaurant_name=${encodeURIComponent(brandName)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 block text-center text-sm text-white/80 hover:text-white underline transition-colors"
                  >
                    View Automation Link →
                  </a>
                )}
              </div>
            ) : (
              <div className="w-full bg-white/10 border border-white/20 rounded-2xl p-4 mb-4 text-center">
                <p className="text-white/80 text-sm mb-2">
                  No data tables yet. This is optional — you can add data tables
                  later to manage your content(watch tutorial to understand it).
                </p>
                <p className="text-white/60 text-xs mb-3">
                  Data tables let you store and display dynamic content on your
                  website (e.g. services,products,extras,options,anything you
                  want and can be edited with ai later!).
                </p>
                <button
                  onClick={() => setShowLocationForm(true)}
                  className="bg-white/20 border border-white/30 text-white font-semibold px-6 py-2 rounded-xl hover:bg-white/30 text-sm transition-all"
                >
                  + Add Data Source (Optional)
                </button>
              </div>
            )}

            {/* AI Settings Panel */}
            {websiteId && <AISettingsPanel websiteId={websiteId} />}
          </div>
        )}

        {/* Location form modal */}
        {showLocationForm && (
          <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
            <div className="bg-white p-6 rounded-2xl shadow-xl">
              <LocationForm
                locationName={locationName}
                setLocationName={setLocationName}
                address={address}
                setAddress={setAddress}
                locationEmail={locationEmail}
                setLocationEmail={setLocationEmail}
                onSave={() => {
                  createLocation();
                  setShowLocationForm(false);
                }}
              />
            </div>
          </div>
        )}
      </main>

      {/* ── DATA TABLES SECTION ──────────────────────────── */}
      {hasLocations && (
        <section className="bg-gray-50 min-h-screen p-6">
          <div className="max-w-7xl mx-auto flex gap-6">
            {/* Sidebar */}
            <aside className="w-52 flex-shrink-0">
              <div className="bg-white rounded-2xl border border-gray-200 p-4 sticky top-6">
                <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                  Content Tables
                </h2>
                <div className="space-y-1">
                  {tableNames.map((name) => (
                    <button
                      key={name}
                      onClick={() => handleTableClick(name)}
                      className={`w-full text-left px-3 py-2 rounded-xl text-sm transition-all ${
                        selectedTable === name
                          ? "bg-pink-50 text-pink-600 font-semibold"
                          : "text-gray-600 hover:bg-gray-50 hover:text-gray-800"
                      }`}
                    >
                      {name.replace(/_/g, " ")}
                    </button>
                  ))}
                </div>
              </div>
            </aside>

            {/* Table content */}
            <div className="flex-1 min-w-0">
              {!selectedTable ? (
                <div className="bg-white rounded-2xl border border-gray-200 p-16 text-center">
                  <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                    <Zap size={20} className="text-gray-400" />
                  </div>
                  <p className="text-gray-500 font-medium">
                    Select a table from the sidebar
                  </p>
                </div>
              ) : tableConfigs[selectedTable] ? (
                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                  {/* Table header */}
                  <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                    <h3 className="font-bold text-gray-800 capitalize">
                      {selectedTable.replace(/_/g, " ")}
                      <span className="ml-2 text-xs font-normal text-gray-400">
                        {selectedData.length} rows
                      </span>
                    </h3>
                    <div className="flex items-center gap-2">
                      {selectedTable !== "locations" && (
                        <button
                          onClick={() => {
                            const empty: any = {};
                            tableConfigs[selectedTable].fields.forEach(
                              (f) => (empty[f.key] = ""),
                            );
                            setSelectedData((prev) => [...prev, empty]);
                          }}
                          className="flex items-center gap-1.5 bg-green-600 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-green-700 transition-all"
                        >
                          <Plus size={14} /> Add Row
                        </button>
                      )}
                      <button
                        onClick={handleSaveChanges}
                        className="flex items-center gap-1.5 bg-pink-600 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-pink-700 transition-all"
                      >
                        <Save size={14} /> Save
                      </button>
                    </div>
                  </div>

                  {/* Table */}
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                          {tableConfigs[selectedTable].fields.map((field) => (
                            <th
                              key={field.key}
                              className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide"
                            >
                              {field.label}
                            </th>
                          ))}
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {selectedData.map((item, index) => (
                          <tr
                            key={index}
                            className="hover:bg-gray-50/50 transition-colors"
                          >
                            {tableConfigs[selectedTable].fields.map((field) => {
                              const rc = field.renderAs;
                              return (
                                <td key={field.key} className="px-4 py-3">
                                  {rc?.type === "dropdown" &&
                                  rc.optionsSource ? (
                                    <select
                                      value={item[field.key] ?? ""}
                                      onChange={(e) =>
                                        setSelectedData((prev) => {
                                          const a = [...prev];
                                          a[index] = {
                                            ...a[index],
                                            [field.key]: e.target.value,
                                          };
                                          return a;
                                        })
                                      }
                                      className="border border-gray-200 rounded-lg p-1.5 text-sm w-full bg-white focus:outline-none focus:border-pink-400"
                                    >
                                      <option value="" disabled>
                                        -- Select --
                                      </option>
                                      {(
                                        dropdownOptions[rc.optionsSource] || []
                                      ).map((opt: any) => {
                                        const val =
                                          opt.group_id ||
                                          opt.item_id ||
                                          opt.extra_id ||
                                          opt.id;
                                        const lbl =
                                          opt.group_name ||
                                          opt.item_name ||
                                          opt.name;
                                        return (
                                          <option key={val} value={val}>
                                            {lbl}
                                          </option>
                                        );
                                      })}
                                    </select>
                                  ) : rc?.type === "boolean" ? (
                                    <select
                                      value={String(item[field.key])}
                                      onChange={(e) =>
                                        setSelectedData((prev) => {
                                          const a = [...prev];
                                          a[index] = {
                                            ...a[index],
                                            [field.key]:
                                              e.target.value === "true",
                                          };
                                          return a;
                                        })
                                      }
                                      className="border border-gray-200 rounded-lg p-1.5 text-sm w-full bg-white focus:outline-none focus:border-pink-400"
                                    >
                                      <option value="true">True</option>
                                      <option value="false">False</option>
                                    </select>
                                  ) : rc?.type === "image" ? (
                                    <div className="flex items-center gap-2">
                                      <img
                                        src={
                                          pendingFiles[index]
                                            ? URL.createObjectURL(
                                                pendingFiles[index]!,
                                              )
                                            : resolveImageSrc(item[field.key])
                                        }
                                        alt="item"
                                        className="w-12 h-12 object-cover rounded-lg border border-gray-200"
                                        onError={(e) => {
                                          (
                                            e.currentTarget as HTMLImageElement
                                          ).src =
                                            "https://placehold.co/48x48/fecaca/991b1b?text=!";
                                        }}
                                      />
                                      <button
                                        onClick={() => {
                                          setUploadingImageIndex(index);
                                          fileInputRef.current?.click();
                                        }}
                                        className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                                      >
                                        Change
                                      </button>
                                    </div>
                                  ) : (
                                    <input
                                      value={item[field.key] ?? ""}
                                      onChange={(e) =>
                                        setSelectedData((prev) => {
                                          const a = [...prev];
                                          a[index] = {
                                            ...a[index],
                                            [field.key]: e.target.value,
                                          };
                                          return a;
                                        })
                                      }
                                      className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm w-full focus:outline-none focus:border-pink-400 bg-white min-w-[100px]"
                                    />
                                  )}
                                </td>
                              );
                            })}
                            <td className="px-4 py-3">
                              {selectedTable !== "locations" && (
                                <button
                                  onClick={() => handleDeleteRow(item)}
                                  className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                >
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                        {selectedData.length === 0 && (
                          <tr>
                            <td
                              colSpan={
                                tableConfigs[selectedTable].fields.length + 1
                              }
                              className="px-4 py-12 text-center text-gray-400 text-sm"
                            >
                              No data yet. Click "Add Row" to get started.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </section>
      )}

      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        style={{ display: "none" }}
        onChange={handlePickFile}
      />
    </>
  );
};

export default MainPage;
