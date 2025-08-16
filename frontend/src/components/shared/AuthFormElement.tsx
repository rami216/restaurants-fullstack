"use client";
import * as React from "react";
import api from "@/lib/axios";
import { useRouter } from "next/navigation";

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
  subdomain, // may be undefined in PublicCanvas
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

  // ✅ Resolve site slug from either prop OR current URL
  const site = React.useMemo(() => {
    if (subdomain && subdomain.trim()) return subdomain.trim();
    if (typeof window !== "undefined") {
      // first path segment: /my-site/..., fallback to ""
      const seg = window.location.pathname.split("/").filter(Boolean)[0];
      return seg || "";
    }
    return "";
  }, [subdomain]);

  const fields: Field[] = Array.isArray(props?.fields) ? props.fields : [];
  const labelStyle = props?.labelStyle || {};
  const inputStyle = props?.inputStyle || {};
  const buttonStyle = props?.submitButton?.style || {};
  const btnText =
    props?.submitButton?.text || (kind === "login" ? "Login" : "Register");

  const [form, setForm] = React.useState<Record<string, string>>({});
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const initial: Record<string, string> = {};
    for (const f of fields) initial[f.name] = initial[f.name] ?? "";
    setForm((prev) => ({ ...initial, ...prev }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fields.map((f) => f.name).join("|")]);

  const handleChange = (name: string, value: string) =>
    setForm((f) => ({ ...f, [name]: value }));

  function buildRedirect(
    kind: "login" | "register",
    siteSlug: string,
    props?: any
  ) {
    const sr: string | undefined = props?.successRedirect;
    if (sr && typeof sr === "string" && sr.trim()) {
      if (/^https?:\/\//i.test(sr)) return sr; // absolute
      return sr.startsWith("/") ? sr : `/${sr}`; // relative
    }
    if (!siteSlug) return "/"; // fallback
    return kind === "register" ? `/${siteSlug}/login` : `/${siteSlug}`;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editMode) return;

    setLoading(true);
    setError(null);

    try {
      if (!site) throw new Error("Missing site slug for auth.");

      // ✅ Use resolved `site`
      const url =
        kind === "login"
          ? `/site-auth/${site}/login`
          : `/site-auth/${site}/register`;

      const { data } = await api.post(url, form);

      if (kind === "login" && data?.access_token) {
        localStorage.setItem(`siteToken:${site}`, data.access_token);
        localStorage.setItem(`siteMemberId:${site}`, data.member_id);
      }

      onSuccess?.();

      const redirect = buildRedirect(kind, site, props);

      try {
        router.push(redirect); // relative to current origin (zygoflow.com)
        router.refresh?.();
      } catch {
        if (typeof window !== "undefined") window.location.assign(redirect);
      }
    } catch (err: any) {
      const d = err?.response?.data?.detail;
      const msg = Array.isArray(d)
        ? d.map((x: any) => x?.msg || "").join(", ")
        : d;
      setError(msg || err?.message || "Request failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={props?.style || {}}>
      {props?.title && (
        <h3 style={{ marginBottom: "1rem", fontWeight: 600 }}>{props.title}</h3>
      )}
      <div style={{ display: "grid", gap: "0.75rem" }}>
        {fields.map((f) => (
          <div key={f.id}>
            {f.label && (
              <label style={labelStyle} className="block mb-1">
                {f.label}
              </label>
            )}
            <input
              type={f.type || "text"}
              name={f.name}
              placeholder={f.placeholder || ""}
              value={form[f.name] || ""}
              onChange={(e) => handleChange(f.name, e.target.value)}
              className="w-full border rounded px-3 py-2"
              style={inputStyle}
              required
            />
          </div>
        ))}
      </div>
      {editMode && (
        <div className="mt-3 text-xs text-gray-500">
          Preview mode: submitting won’t call the API.
        </div>
      )}
      {error && <div className="mt-3 text-sm text-red-600">{error}</div>}
      <button
        type={editMode ? "button" : "submit"}
        disabled={loading}
        style={buttonStyle}
        className="mt-4 w-full"
      >
        {editMode
          ? `${btnText} (preview)`
          : loading
          ? "Please wait..."
          : btnText}
      </button>
    </form>
  );
}
