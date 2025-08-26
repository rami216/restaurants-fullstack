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

export default function BuilderPaymentsPage() {
  const params = useParams<{ website_id: string }>();
  const router = useRouter();
  const websiteId = params?.website_id;
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [view, setView] = React.useState<StripeConfigView | null>(null);

  // form state (only used if not configured)
  const [secretKey, setSecretKey] = React.useState("");
  const [webhookSecret, setWebhookSecret] = React.useState("");
  const [showSecret, setShowSecret] = React.useState(false);
  const [showWebhook, setShowWebhook] = React.useState(false);

  // builder token
  const token =
    typeof window !== "undefined" ? localStorage.getItem("builderToken") : null;

  React.useEffect(() => {
    if (!websiteId) return;

    if (!token) {
      // not logged in → redirect to builder login
      router.replace(`/login`);
      return;
    }

    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data } = await api.get(
          `/users-stripe-account/builder/websites/${websiteId}/stripe-config`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setView(data as StripeConfigView);
      } catch (err: any) {
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
  }, [websiteId, token, router]);
  
  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
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
          stripe_secret_key: secretKey.trim(),
          stripe_webhook_secret: webhookSecret.trim(),
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      // refetch
      const { data } = await api.get(
        `/users-stripe-account/builder/websites/${websiteId}/stripe-config`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setView(data as StripeConfigView);
      setSecretKey("");
      setWebhookSecret("");
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

  const webhookUrl = `http://localhost:8000/users-stripe-account/builder/websites/${websiteId}/stripe/webhook`;

  return (
    <div className="max-w-xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Payments setup</h1>

      {view?.exists ? (
        <div className="border rounded p-4 bg-white space-y-3">
          <div className="text-sm">
            <div>
              <span className="font-medium">Status:</span>{" "}
              <span className="text-green-700">Configured</span>
            </div>
            <div>
              <span className="font-medium">Stripe Secret Key:</span>{" "}
              {view.secret_key_last4
                ? `•••• ${view.secret_key_last4}`
                : "Hidden"}
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
                <code className="bg-gray-100 px-2 py-1 rounded">
                  {webhookUrl}
                </code>
              </div>
            </div>
            <div className="text-xs text-gray-500">
              Paste that URL into{" "}
              <span className="font-medium">
                Stripe &gt; Developers &gt; Webhooks
              </span>{" "}
              and set your endpoint events to at least{" "}
              <code>checkout.session.completed</code>. Copy the **signing
              secret** from Stripe and keep it saved here.
            </div>
          </div>
        </div>
      ) : (
        <form
          onSubmit={onCreate}
          className="border rounded p-4 bg-white space-y-4"
        >
          <div className="space-y-1">
            <label className="block text-sm font-medium">
              Stripe Secret Key (test or live)
            </label>
            <div className="flex gap-2">
              <input
                type={showSecret ? "text" : "password"}
                value={secretKey}
                onChange={(e) => setSecretKey(e.target.value)}
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
                type={showWebhook ? "text" : "password"}
                value={webhookSecret}
                onChange={(e) => setWebhookSecret(e.target.value)}
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
              In Stripe Dashboard: Developers → Webhooks → “Add endpoint” with
              URL <code className="bg-gray-100 px-1 rounded">{webhookUrl}</code>{" "}
              → copy the “Signing secret”.
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
      )}
    </div>
  );
}
