"use client";
import * as React from "react";
import { useRouter } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL!;

async function apiFetch(path: string, init?: RequestInit) {
  return fetch(`${API_BASE}${path}`, {
    ...init,
    mode: "cors",
    credentials: "omit",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
}

type Field = {
  id: string;
  label?: string;
  name: string;
  placeholder?: string;
  type?: "text" | "email" | "password";
};

export default function AuthFormElement({
  kind,
  props,
  subdomain,
  editMode = false,
  onSuccess,
}: {
  kind: "login" | "register";
  props: any;
  subdomain?: string;
  editMode?: boolean;
  onSuccess?: () => void;
}) {
  const router = useRouter();

  // --- STATE FOR MULTI-STEP REGISTRATION ---
  const [formStep, setFormStep] = React.useState<"details" | "confirm_code">(
    "details"
  );
  const [emailForConfirmation, setEmailForConfirmation] = React.useState("");
  const [successMessage, setSuccessMessage] = React.useState("");

  const [form, setForm] = React.useState<Record<string, string>>({});
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const site = React.useMemo(() => {
    if (subdomain && subdomain.trim()) return subdomain.trim();
    if (typeof window !== "undefined") {
      const seg = window.location.pathname.split("/").filter(Boolean)[0];
      return seg || "";
    }
    return "";
  }, [subdomain]);

  const fields: Field[] = Array.isArray(props?.fields) ? props.fields : [];

  const containerStyle: React.CSSProperties = props?.style || {};
  const labelStyle: React.CSSProperties = props?.labelStyle || {};
  const inputStyle: React.CSSProperties = props?.inputStyle || {};
  const buttonStyle: React.CSSProperties = props?.submitButton?.style || {};
  const buttonText: string =
    props?.submitButton?.text || (kind === "login" ? "Login" : "Register");

  React.useEffect(() => {
    const initial: Record<string, string> = {};
    for (const f of fields) initial[f.name] = initial[f.name] ?? "";
    setForm((prev) => ({ ...initial, ...prev }));
  }, [fields.map((f) => f.name).join("|")]);

  const handleChange = (name: string, value: string) =>
    setForm((f) => ({ ...f, [name]: value }));

  const performRedirect = () => {
    const isMainHost =
      typeof window !== "undefined" &&
      (window.location.hostname === "zygoflow.com" ||
        window.location.hostname === "www.zygoflow.com");

    let redirect = "/";
    if (isMainHost) redirect = `/${site}`;

    const customRedirect = props?.successRedirect;
    if (customRedirect && typeof customRedirect === "string") {
      redirect = customRedirect.startsWith("/")
        ? customRedirect
        : `/${customRedirect}`;
      if (isMainHost) redirect = `/${site}${redirect}`;
    }
    router.push(redirect);
    router.refresh?.();
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editMode) return;
    setLoading(true);
    setError(null);

    try {
      if (!site) throw new Error("Missing site identifier for auth.");
      const res = await apiFetch(`/site-auth/${site}/register`, {
        method: "POST",
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.detail || "Registration failed");
      }

      setEmailForConfirmation(form.email);
      setSuccessMessage(
        "Registration successful! Please check your email for a 6-digit code."
      );
      setFormStep("confirm_code");
    } catch (err: any) {
      setError(err.message || "Request failed");
    } finally {
      setLoading(false);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editMode) return;
    setLoading(true);
    setError(null);
    try {
      if (!site) throw new Error("Missing site identifier for auth.");

      const res = await apiFetch(`/site-auth/${site}/login`, {
        method: "POST",
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.detail || "Login failed");
      }

      const data = await res.json();
      localStorage.setItem(`siteToken:${site}`, data.access_token);
      localStorage.setItem(`siteMemberId:${site}`, data.member_id);
      localStorage.setItem(`siteMemberEmail:${site}`, data.email);
      onSuccess?.();
      performRedirect();
    } catch (err: any) {
      setError(err.message || "Request failed");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editMode) return;
    setLoading(true);
    setError(null);

    try {
      if (!site) throw new Error("Missing site identifier for auth.");
      const res = await apiFetch(`/site-auth/${site}/confirm-code`, {
        method: "POST",
        body: JSON.stringify({ email: emailForConfirmation, code: form.code }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.detail || "Code confirmation failed");
      }

      const data = await res.json();
      localStorage.setItem(`siteToken:${site}`, data.access_token);
      localStorage.setItem(`siteMemberId:${site}`, data.member_id);
      localStorage.setItem(`siteMemberEmail:${site}`, emailForConfirmation);
      onSuccess?.();
      performRedirect();
    } catch (err: any) {
      setError(err.message || "Request failed");
    } finally {
      setLoading(false);
    }
  };

  if (kind === "register" && formStep === "confirm_code") {
    return (
      <div
        style={containerStyle}
        className={`bg-white p-8 rounded shadow max-w-md w-full mx-auto space-y-4`}
      >
        <h3 className="text-2xl font-bold text-center text-gray-800">
          Check Your Email
        </h3>
        {successMessage && (
          <p className="text-green-600 text-center text-sm">{successMessage}</p>
        )}
        {error && (
          <div className="text-red-600 text-center text-sm">{error}</div>
        )}

        <form onSubmit={handleConfirmCodeSubmit} className="grid gap-3">
          <div>
            <label
              htmlFor="code"
              className="block mb-1 text-gray-700"
              style={labelStyle}
            >
              Confirmation Code
            </label>
            <input
              id="code"
              type="text"
              name="code"
              placeholder="123456"
              value={form.code || ""}
              onChange={(e) => handleChange("code", e.target.value)}
              required
              style={inputStyle}
              className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pink-500"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            style={buttonStyle}
            className="w-full bg-pink-500 text-white font-bold py-2 rounded hover:bg-pink-600 transition-colors disabled:opacity-50"
          >
            {loading ? "Verifying..." : "Verify & Login"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <form
      onSubmit={kind === "register" ? handleRegisterSubmit : handleLoginSubmit}
      style={containerStyle}
      className={`bg-white p-8 rounded shadow max-w-md w-full mx-auto space-y-4`}
    >
      {props?.title && (
        <h3 className="text-2xl font-bold text-center text-gray-800">
          {props.title}
        </h3>
      )}

      {error && <div className="text-red-600 text-center text-sm">{error}</div>}

      <div className="grid gap-3">
        {fields.map((f) => {
          const inputId = f.id || f.name;
          return (
            <div key={inputId}>
              {f.label && (
                <label
                  htmlFor={inputId}
                  className="block mb-1 text-gray-700"
                  style={labelStyle}
                >
                  {f.label}
                </label>
              )}
              <input
                id={inputId}
                type={f.type || "text"}
                name={f.name}
                placeholder={f.placeholder || ""}
                value={form[f.name] || ""}
                onChange={(e) => handleChange(f.name, e.target.value)}
                required
                style={inputStyle}
                className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pink-500"
                autoComplete={
                  f.type === "password"
                    ? "current-password"
                    : f.type === "email"
                    ? "email"
                    : "on"
                }
              />
            </div>
          );
        })}
      </div>

      <button
        type={editMode ? "button" : "submit"}
        disabled={loading}
        style={buttonStyle}
        className="w-full bg-pink-500 text-white font-bold py-2 rounded hover:bg-pink-600 transition-colors disabled:opacity-50"
      >
        {loading
          ? kind === "login"
            ? "Logging in..."
            : "Registering..."
          : buttonText}
      </button>
    </form>
  );
}
