"use client";

import React, { useState, useEffect } from "react";
import { loadStripe } from "@stripe/stripe-js";
import api from "@/lib/axios";
import { useSubscription } from "@/context/SubscriptionContext";

// Initialize Stripe with your public key
const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "",
);

// ✅ NEW: Helper function to format bytes into MB/GB
const formatBytes = (bytes: number, decimals = 2) => {
  if (bytes === 0) return "0 Bytes";
  const k = 1000;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
};

export default function BillingPage() {
  // Get live subscription data from the context (Chatbot credits & Storage)
  const {
    subscriptionStatus,
    creditBalance,
    isLoading,
    fetchSubscriptionStatus,
    storageUsed,
    storageLimit,
  } = useSubscription();

  const [topUpAmount, setTopUpAmount] = useState("10"); // Default to $10

  // ✅ NEW: State for AI Builder Data (fetched separately)
  const [builderData, setBuilderData] = useState<{
    monthly_spend_usd?: number;
    monthly_spend_limit_usd?: number;
  } | null>(null);

  // ✅ NEW: Fetch AI Builder usage data on mount
  useEffect(() => {
    const fetchBuilderData = async () => {
      try {
        const res = await api.get("/builder/website");
        if (res.status === 200) {
          setBuilderData(res.data);
        }
      } catch (error) {
        console.error("Failed to fetch builder usage data:", error);
      }
    };
    fetchBuilderData();
  }, []);

  // --- PAYMENT HANDLERS ---

  const handleSubscribe = async () => {
    try {
      const { data } = await api.post("/payments/create-subscription-checkout");
      const stripe = await stripePromise;
      if (stripe) {
        await stripe.redirectToCheckout({ sessionId: data.sessionId });
      }
    } catch (error) {
      console.error("Failed to create subscription session", error);
      alert("Error creating subscription.");
    }
  };

  const handleManageBilling = async () => {
    try {
      const { data } = await api.post(
        "/payments/create-billing-portal-session",
      );
      window.location.href = data.url;
    } catch (error) {
      console.error("Failed to create billing portal session", error);
      alert("Could not open billing portal.");
    }
  };

  const handleTopUp = async () => {
    const amount = parseFloat(topUpAmount);
    if (isNaN(amount) || amount <= 0) {
      return alert("Please enter a valid amount.");
    }
    try {
      const { data } = await api.post("/payments/create-top-up-session", {
        amount,
      });
      const stripe = await stripePromise;
      if (stripe) {
        await stripe.redirectToCheckout({ sessionId: data.sessionId });
      }
    } catch (error) {
      console.error("Failed to create top-up session", error);
      alert("Error creating payment session.");
    }
  };
  function AgentTokenSection({ websiteId }: { websiteId: string }) {
    const [token, setToken] = React.useState<string | null>(null);
    const [loading, setLoading] = React.useState(false);
    const [copied, setCopied] = React.useState(false);

    React.useEffect(() => {
      api
        .get(`/agent-bridge/websites/${websiteId}/token-status`)
        .then((res) => {
          if (res.data.token) setToken(res.data.token);
        })
        .catch(() => {});
    }, [websiteId]);

    const handleGenerate = async () => {
      setLoading(true);
      try {
        const res = await api.post(
          `/agent-bridge/websites/${websiteId}/generate-token`,
        );
        setToken(res.data.token);
      } catch {
        alert("Failed to generate token.");
      } finally {
        setLoading(false);
      }
    };

    const handleCopy = () => {
      if (!token) return;
      navigator.clipboard.writeText(token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };

    return (
      <div>
        {token ? (
          <div className="flex items-center gap-3">
            <code className="flex-1 bg-gray-100 p-3 rounded text-sm font-mono break-all">
              {token}
            </code>
            <button
              onClick={handleCopy}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded font-medium whitespace-nowrap"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        ) : (
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded font-medium disabled:opacity-50"
          >
            {loading ? "Generating..." : "Generate Token"}
          </button>
        )}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <p>Loading Billing Information...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8">
      <h1 className="text-3xl font-bold mb-8">Billing & Subscription</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* 1. Subscription Card */}
        <div className="bg-white p-6 rounded-lg shadow-md flex flex-col">
          <h2 className="text-xl font-semibold mb-4">Subscription Status</h2>
          {subscriptionStatus === "active" ? (
            <div className="flex-grow">
              <p className="text-green-600 font-medium mb-4">
                Your subscription is active.
              </p>
              <p className="text-gray-600 text-sm">
                You can manage your subscription, view invoices, and update your
                payment method at any time.
              </p>
            </div>
          ) : (
            <div className="flex-grow">
              <p className="text-red-600 font-medium mb-4">
                You do not have an active subscription.
              </p>
              <p className="text-gray-600 text-sm">
                Subscribe for $20/month to unlock all features and start using
                your AI credits.
              </p>
            </div>
          )}
          {subscriptionStatus === "active" ? (
            <button
              onClick={handleManageBilling}
              className="mt-6 w-full bg-gray-700 hover:bg-gray-800 text-white font-semibold py-2 px-4 rounded"
            >
              Manage Billing & Invoices
            </button>
          ) : (
            <button
              onClick={handleSubscribe}
              className="mt-6 w-full bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded"
            >
              Subscribe Now
            </button>
          )}
        </div>

        {/* 2. Chatbot Credits Card */}
        {/* <div className="bg-white p-6 rounded-lg shadow-md flex flex-col">
          <h2 className="text-xl font-semibold mb-4">Chatbot Credits</h2>
          <div className="flex-grow">
            <p className="text-gray-600 mb-2">Pre-paid balance for Chatbot:</p>
            <p className="text-4xl font-bold text-indigo-600 mb-4">
              ${creditBalance.toFixed(2)}
            </p>
            <p className="text-gray-600 text-sm">
              Add funds to your account to continue using the Chatbot.
            </p>
          </div>
          <div className="mt-6 flex items-center gap-4">
            <input
              type="number"
              value={topUpAmount}
              onChange={(e) => setTopUpAmount(e.target.value)}
              placeholder="10.00"
              className="bg-gray-100 text-black px-3 py-2 rounded w-full border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              onClick={handleTopUp}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-4 rounded whitespace-nowrap"
            >
              Add Funds
            </button>
          </div>
        </div> */}

        {/* 3. ✅ NEW: AI Builder Monthly Budget Card */}
        <div className="bg-white p-6 rounded-lg shadow-md flex flex-col">
          <h2 className="text-xl font-semibold mb-4">AI Builder Budget</h2>
          <div className="flex-grow">
            {(() => {
              const spent = Number(builderData?.monthly_spend_usd || 0);
              const limit = Number(builderData?.monthly_spend_limit_usd || 8); // Default $8 if null
              const remaining = Math.max(0, limit - spent);
              const percentUsed = limit > 0 ? (spent / limit) * 100 : 0;

              return (
                <>
                  <div className="flex justify-between text-sm text-gray-600 mb-1">
                    <span>Used: ${spent.toFixed(4)}</span>
                    <span>Limit: ${limit.toFixed(2)}</span>
                  </div>

                  <div className="w-full bg-gray-200 rounded-full h-4 mb-3">
                    <div
                      className={`h-4 rounded-full transition-all duration-500 ${
                        percentUsed > 90 ? "bg-red-500" : "bg-teal-500"
                      }`}
                      style={{ width: `${Math.min(percentUsed, 100)}%` }}
                    />
                  </div>

                  <p className="text-gray-700 mb-2">
                    You have{" "}
                    <span className="font-bold text-teal-600">
                      ${remaining.toFixed(2)}
                    </span>{" "}
                    remaining this month for the Website Builder prompts.
                  </p>
                  <p className="text-xs text-gray-400">
                    This budget resets automatically on the 1st of every month.
                  </p>
                </>
              );
            })()}
          </div>
        </div>

        {/* 4. Storage Usage Card */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">Storage Usage</h2>
          <div className="space-y-2">
            <div className="w-full bg-gray-200 rounded-full h-4">
              <div
                className="bg-purple-600 h-4 rounded-full"
                style={{
                  width: `${Math.min((storageUsed / storageLimit) * 100, 100)}%`,
                }}
              ></div>
            </div>
            <p className="text-sm text-gray-600 text-right">
              {formatBytes(storageUsed)} of {formatBytes(storageLimit)} used
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}