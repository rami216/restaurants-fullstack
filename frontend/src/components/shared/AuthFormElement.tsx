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

// ── Google SVG Icon ────────────────────────────────────────────
const GoogleIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 18 18"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fill="#4285F4"
      d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908C16.658 14.013 17.64 11.706 17.64 9.2z"
    />
    <path
      fill="#34A853"
      d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
    />
    <path
      fill="#FBBC05"
      d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z"
    />
    <path
      fill="#EA4335"
      d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 6.293C4.672 4.166 6.656 3.58 9 3.58z"
    />
  </svg>
);

// ── Divider ────────────────────────────────────────────────────
const Divider = () => (
  <div className="relative flex items-center my-2">
    <div className="flex-grow border-t border-gray-200" />
    <span className="mx-3 text-xs text-gray-400 whitespace-nowrap">
      or continue with email
    </span>
    <div className="flex-grow border-t border-gray-200" />
  </div>
);

// ══════════════════════════════════════════════════════════════
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

  // ── state ──────────────────────────────────────────────────
  const [formStep, setFormStep] = React.useState<"details" | "confirm_code">(
    "details",
  );
  const [emailForConfirmation, setEmailForConfirmation] = React.useState("");
  const [successMessage, setSuccessMessage] = React.useState("");
  const [form, setForm] = React.useState<Record<string, string>>({});
  const [loading, setLoading] = React.useState(false);
  const [googleLoading, setGoogleLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // ── site identifier ────────────────────────────────────────
  const site = React.useMemo(() => {
    if (subdomain && subdomain.trim()) return subdomain.trim();
    if (typeof window !== "undefined") {
      const seg = window.location.pathname.split("/").filter(Boolean)[0];
      return seg || "";
    }
    return "";
  }, [subdomain]);

  // ── styles from props ──────────────────────────────────────
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

  // ── redirect after success ─────────────────────────────────
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

  // ── audit logger ───────────────────────────────────────────
  const logSecurityEvent = async (
    eventType: string,
    email: string,
    status: string,
    errorMessage: string = "",
  ) => {
    const auditLogSchemaId = props?.auditLogSchemaId;
    if (!auditLogSchemaId) return;
    try {
      apiFetch(`/custom-data/rows/${auditLogSchemaId}`, {
        method: "POST",
        body: JSON.stringify({
          data: {
            event_type: eventType,
            email: email || "unknown",
            status,
            error_message: errorMessage,
          },
        }),
      });
    } catch (e) {
      console.error("Silent log failed", e);
    }
  };

  // ── Google login ───────────────────────────────────────────
  const handleGoogleLogin = async () => {
    if (editMode || !site) return;
    setGoogleLoading(true);
    setError(null);
    try {
      const currentHost =
        typeof window !== "undefined" ? window.location.hostname : "";
      const res = await apiFetch(
        `/site-auth/${site}/google-login-url?return_to=${encodeURIComponent(currentHost)}`,
      );
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error("No redirect URL returned");
      }
    } catch {
      setError("Failed to start Google login. Please try again.");
    } finally {
      setGoogleLoading(false);
    }
  };

  // ── register submit ────────────────────────────────────────
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
        "Registration successful! Please check your email for a 6-digit code.",
      );
      setFormStep("confirm_code");
    } catch (err: any) {
      setError(err.message || "Request failed");
    } finally {
      setLoading(false);
    }
  };

  // ── login submit ───────────────────────────────────────────
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
      logSecurityEvent("login", form.email, "success");
      localStorage.setItem(`siteToken:${site}`, data.access_token);
      localStorage.setItem(`siteMemberId:${site}`, data.member_id);
      localStorage.setItem(`siteMemberEmail:${site}`, data.email);
      onSuccess?.();
      performRedirect();
    } catch (err: any) {
      logSecurityEvent(
        "login",
        form.email,
        "failed",
        err.message || "Request failed",
      );
      setError(err.message || "Request failed");
    } finally {
      setLoading(false);
    }
  };

  // ── confirm code submit ────────────────────────────────────
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

  // ── confirm code step ──────────────────────────────────────
  if (kind === "register" && formStep === "confirm_code") {
    return (
      <div
        style={containerStyle}
        className="bg-white p-8 rounded shadow max-w-md w-full mx-auto space-y-4"
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

  // ── main form ──────────────────────────────────────────────
  return (
    <div
      style={containerStyle}
      className="bg-white p-8 rounded shadow max-w-md w-full mx-auto space-y-4"
    >
      {props?.title && (
        <h3 className="text-2xl font-bold text-center text-gray-800">
          {props.title}
        </h3>
      )}

      {error && <div className="text-red-600 text-center text-sm">{error}</div>}

      {/* ── Google Button ── */}
      <button
        type="button"
        onClick={handleGoogleLogin}
        disabled={googleLoading || editMode}
        className="w-full flex items-center justify-center gap-3 border border-gray-300 rounded-lg px-4 py-2.5 hover:bg-gray-50 transition-colors disabled:opacity-50 bg-white"
      >
        <GoogleIcon />
        <span className="text-sm font-medium text-gray-700">
          {googleLoading
            ? "Redirecting..."
            : kind === "login"
              ? "Sign in with Google"
              : "Sign up with Google"}
        </span>
      </button>

      {/* ── Divider ── */}
      <Divider />

      {/* ── Email/Password Form ── */}
      <form
        onSubmit={
          kind === "register" ? handleRegisterSubmit : handleLoginSubmit
        }
        className="grid gap-3"
      >
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
    </div>
  );
}
