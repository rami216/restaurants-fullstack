"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import api from "@/lib/axios";

type StripeConfigView =
  | { exists: false }
  | {
      exists: true;
      secret_key_last4: string | null;
      has_webhook: boolean;
      created_at?: string;
      updated_at?: string;
    };

type ProductRow = {
  product_id: string;
  name: string;
  description: string | null;
  stripe_price_id: string;
  currency: string;
  amount_cents: number;
  active: boolean;
};

export default function BuilderPaymentsPage() {
  const params = useParams<{ website_id: string }>();
  const router = useRouter();

  const websiteId = Array.isArray(params?.website_id)
    ? params?.website_id[0]
    : params?.website_id;

  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [view, setView] = React.useState<StripeConfigView | null>(null);

  // product list & form
  const [products, setProducts] = React.useState<ProductRow[]>([]);
  const [creatingProduct, setCreatingProduct] = React.useState(false);
  const [prodError, setProdError] = React.useState<string | null>(null);

  // create form fields
  const [pName, setPName] = React.useState("");
  const [pDesc, setPDesc] = React.useState("");
  const [pPriceId, setPPriceId] = React.useState("");
  const [pCurrency, setPCurrency] = React.useState("usd");
  const [pAmount, setPAmount] = React.useState<string | number>("");
  const [pActive, setPActive] = React.useState(true);

  React.useEffect(() => {
    if (!websiteId) return;

    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        // 1) load stripe config (to know if configured)
        const { data } = await api.get(
          `/users-stripe-account/builder/websites/${websiteId}/stripe-config`
        );
        setView(data as StripeConfigView);

        // 2) if configured, load products
        if (data?.exists) {
          await loadProducts();
        }
      } catch (err: any) {
        if (err?.response?.status === 401) {
          router.replace("/login");
          return;
        }
        setError(
          err?.response?.data?.detail ||
            err?.message ||
            "Failed to load Stripe config"
        );
      } finally {
        setLoading(false);
      }
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [websiteId]);

  const loadProducts = async () => {
    try {
      const { data } = await api.get(
        `/users-stripe-account/builder/websites/${websiteId}/products`
      );
      setProducts(data as ProductRow[]);
    } catch (err: any) {
      // don’t block the page; just show a small error below the section
      setProdError(
        err?.response?.data?.detail || err?.message || "Failed to load products"
      );
    }
  };

  // ---- Auto-fill from Stripe Price ----
  const fetchFromStripePrice = async () => {
    setProdError(null);
    const priceId = pPriceId.trim();
    if (!priceId.startsWith("price_")) {
      setProdError(
        "Please paste a valid Stripe Price ID (starts with price_)."
      );
      return;
    }
    try {
      const { data } = await api.get(
        `/users-stripe-account/builder/websites/${websiteId}/stripe/price/${priceId}`
      );
      // backend returns { product_id, product_name, currency, unit_amount }
      setPName((prev) => (prev?.trim() ? prev : data.product_name || ""));
      setPCurrency((data.currency || "usd").toLowerCase());
      setPAmount(
        typeof data.unit_amount === "number"
          ? (data.unit_amount / 100).toFixed(2)
          : ""
      );
    } catch (err: any) {
      setProdError(
        err?.response?.data?.detail ||
          err?.message ||
          "Couldn’t look up that Price ID in Stripe"
      );
    }
  };

  const onCreateStripeConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget as HTMLFormElement);
    const secretKey = String(form.get("secretKey") || "").trim();
    const webhookSecret = String(form.get("webhookSecret") || "").trim();
    if (!secretKey || !webhookSecret) {
      setError("Both fields are required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.post(
        `/users-stripe-account/builder/websites/${websiteId}/stripe-config`,
        {
          stripe_secret_key: secretKey,
          stripe_webhook_secret: webhookSecret,
        }
      );
      const { data } = await api.get(
        `/users-stripe-account/builder/websites/${websiteId}/stripe-config`
      );
      setView(data as StripeConfigView);
      await loadProducts();
    } catch (err: any) {
      setError(
        err?.response?.data?.detail ||
          err?.message ||
          "Failed to save Stripe config"
      );
    } finally {
      setSaving(false);
    }
  };

  const onCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!websiteId) return;
    if (!pName || !pPriceId || !pCurrency || !pAmount) {
      setProdError("Name, Price ID, Currency, and Amount are required.");
      return;
    }
    setCreatingProduct(true);
    setProdError(null);
    try {
      const numericAmount =
        typeof pAmount === "string" ? parseFloat(pAmount) : pAmount;
      const amount_cents = Math.round((numericAmount || 0) * 100);

      await api.post(
        `/users-stripe-account/builder/websites/${websiteId}/products`,
        {
          name: pName.trim(),
          description: pDescOrNull(pDesc),
          stripe_price_id: pPriceId.trim(),
          currency: pCurrency.trim().toLowerCase(),
          amount_cents,
          active: pActive,
        }
      );
      await loadProducts();

      // clear
      setPName("");
      setPDesc("");
      setPCurrency("usd");
      setPAmount("");
      setPPriceId("");
      setPActive(true);
    } catch (err: any) {
      setProdError(
        err?.response?.data?.detail ||
          err?.message ||
          "Failed to create product"
      );
    } finally {
      setCreatingProduct(false);
    }
  };

  const webhookUrl = `http://localhost:8000/users-stripe-account/builder/websites/${websiteId}/stripe/webhook`;

  if (!websiteId) return null;
  if (loading) return <div className="p-6">Loading…</div>;
  if (error)
    return (
      <div className="p-6 text-red-600">
        {error}
        <button
          onClick={() => router.refresh()}
          className="ml-3 underline text-blue-700"
        >
          Retry
        </button>
      </div>
    );

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-8">
      <h1 className="text-2xl font-bold">Payments setup</h1>

      {/* 1) Stripe config */}
      {view?.exists ? (
        <ConfiguredBox webhookUrl={webhookUrl} view={view} />
      ) : (
        <StripeConfigForm
          saving={saving}
          webhookUrl={webhookUrl}
          onSubmit={onCreateStripeConfig}
        />
      )}

      {/* 2) Products (show only if Stripe config exists) */}
      {view?.exists && (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Products</h2>

          {/* Create product */}
          <form
            onSubmit={onCreateProduct}
            className="border rounded p-4 bg-white space-y-3"
          >
            <div>
              <label className="block text-sm font-medium">
                Stripe Price ID
              </label>
              <div className="flex gap-2">
                <input
                  value={pPriceId}
                  onChange={(e) => setPPriceId(e.target.value)}
                  onBlur={() => {
                    if (pPriceId.trim().startsWith("price_")) {
                      fetchFromStripePrice();
                    }
                  }}
                  placeholder="price_..."
                  className="flex-1 border rounded px-3 py-2"
                  required
                />
                <button
                  type="button"
                  onClick={fetchFromStripePrice}
                  className="px-3 py-2 border rounded"
                >
                  Fetch from Stripe
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Paste a <code>price_...</code> from Stripe. We’ll auto-fill the
                fields below.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium">Name</label>
              <input
                value={pName}
                onChange={(e) => setPName(e.target.value)}
                placeholder="e.g. Tutorials Pack"
                className="w-full border rounded px-3 py-2"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium">Description</label>
              <textarea
                value={pDesc}
                onChange={(e) => setPDesc(e.target.value)}
                placeholder="Optional"
                className="w-full border rounded px-3 py-2"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium">Currency</label>
                <input
                  value={pCurrency}
                  onChange={(e) => setPCurrency(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Amount</label>
                <input
                  value={pAmount}
                  onChange={(e) => setPAmount(e.target.value)}
                  type="number"
                  step="0.01"
                  min="0"
                  className="w-full border rounded px-3 py-2"
                  required
                />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={pActive}
                    onChange={(e) => setPActive(e.target.checked)}
                  />
                  Active
                </label>
              </div>
            </div>

            {prodError && (
              <div className="text-sm text-red-600">{prodError}</div>
            )}

            <button
              type="submit"
              disabled={creatingProduct}
              className="w-full bg-blue-600 text-white rounded px-4 py-2 disabled:opacity-50"
            >
              {creatingProduct ? "Saving…" : "Create Product"}
            </button>
          </form>

          {/* List products */}
          <div className="border rounded p-4 bg-white">
            <h3 className="font-medium mb-3">Existing products</h3>
            {products.length === 0 ? (
              <div className="text-sm text-gray-500">No products yet.</div>
            ) : (
              <ul className="space-y-2">
                {products.map((p) => (
                  <li
                    key={p.product_id}
                    className="text-sm flex items-center justify-between border rounded px-3 py-2"
                  >
                    <div>
                      <div className="font-medium">{p.name}</div>
                      <div className="opacity-70">
                        {p.currency.toUpperCase()}{" "}
                        {(p.amount_cents / 100).toFixed(2)} ·{" "}
                        {p.stripe_price_id}
                      </div>
                    </div>
                    <span
                      className={`text-xs px-2 py-1 rounded ${
                        p.active ? "bg-green-100 text-green-700" : "bg-gray-100"
                      }`}
                    >
                      {p.active ? "Active" : "Inactive"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

/* --- helpers/components --- */

function pDescOrNull(s: string) {
  const t = (s || "").trim();
  return t ? t : null;
}

function ConfiguredBox({
  webhookUrl,
  view,
}: {
  webhookUrl: string;
  view: Extract<StripeConfigView, { exists: true }>;
}) {
  return (
    <div className="border rounded p-4 bg-white space-y-3">
      <div className="text-sm">
        <div>
          <span className="font-medium">Status:</span>{" "}
          <span className="text-green-700">Configured</span>
        </div>
        <div>
          <span className="font-medium">Stripe Secret Key:</span>{" "}
          {view.secret_key_last4 ? `•••• ${view.secret_key_last4}` : "Hidden"}
        </div>
        <div>
          <span className="font-medium">Webhook Secret:</span>{" "}
          {view.has_webhook ? "••••••" : "Not set"}
        </div>
        {view.updated_at && (
          <div className="text-xs text-gray-500">
            Updated: {new Date(view.updated_at).toLocaleString()}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <div className="text-sm">
          <span className="font-medium">Webhook URL to use in Stripe:</span>
          <div className="mt-1">
            <code className="bg-gray-100 px-2 py-1 rounded">{webhookUrl}</code>
          </div>
        </div>
        <div className="text-xs text-gray-500">
          Paste that URL into <b>Stripe → Developers → Webhooks</b> and enable{" "}
          <code>checkout.session.completed</code>. Copy the{" "}
          <b>signing secret</b> from Stripe and save it here.
        </div>
      </div>
    </div>
  );
}

function StripeConfigForm({
  saving,
  webhookUrl,
  onSubmit,
}: {
  saving: boolean;
  webhookUrl: string;
  onSubmit: (e: React.FormEvent) => void;
}) {
  const [showSecret, setShowSecret] = React.useState(false);
  const [showWebhook, setShowWebhook] = React.useState(false);

  return (
    <form onSubmit={onSubmit} className="border rounded p-4 bg-white space-y-4">
      <div className="space-y-1">
        <label className="block text-sm font-medium">
          Stripe Secret Key (test or live)
        </label>
        <div className="flex gap-2">
          <input
            name="secretKey"
            type={showSecret ? "text" : "password"}
            placeholder="sk_test_..."
            className="flex-1 border rounded px-3 py-2"
            required
          />
          <button
            type="button"
            onClick={() => setShowSecret((s) => !s)}
            className="text-sm underline"
          >
            {showSecret ? "Hide" : "Show"}
          </button>
        </div>
      </div>

      <div className="space-y-1">
        <label className="block text-sm font-medium">
          Stripe Webhook Signing Secret
        </label>
        <div className="flex gap-2">
          <input
            name="webhookSecret"
            type={showWebhook ? "text" : "password"}
            placeholder="whsec_..."
            className="flex-1 border rounded px-3 py-2"
            required
          />
          <button
            type="button"
            onClick={() => setShowWebhook((s) => !s)}
            className="text-sm underline"
          >
            {showWebhook ? "Hide" : "Show"}
          </button>
        </div>
        <p className="text-xs text-gray-500">
          In Stripe Dashboard: Developers → Webhooks → “Add endpoint” with URL{" "}
          <code className="bg-gray-100 px-1 rounded">{webhookUrl}</code> → copy
          the “Signing secret”.
        </p>
      </div>

      <button
        type="submit"
        disabled={saving}
        className="w-full bg-blue-600 text-white rounded px-4 py-2 disabled:opacity-50"
      >
        {saving ? "Saving…" : "Create Stripe Account"}
      </button>
    </form>
  );
}
