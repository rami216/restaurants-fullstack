"use client";
import * as React from "react";
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

  const site = React.useMemo(() => {
    if (subdomain && subdomain.trim()) return subdomain.trim();
    if (typeof window !== "undefined") {
      const seg = window.location.pathname.split("/").filter(Boolean)[0];
      return seg || "";
    }
    return "";
  }, [subdomain]);

  const fields: Field[] = Array.isArray(props?.fields) ? props.fields : [];
  const [form, setForm] = React.useState<Record<string, string>>({});
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const initial: Record<string, string> = {};
    for (const f of fields) initial[f.name] = initial[f.name] ?? "";
    setForm((prev) => ({ ...initial, ...prev }));
  }, [fields.map((f) => f.name).join("|")]);

  const handleChange = (name: string, value: string) =>
    setForm((f) => ({ ...f, [name]: value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editMode) return;

    setLoading(true);
    setError(null);

    try {
      if (!site) throw new Error("Missing site identifier for auth.");

      // call backend API
      const res = await fetch(`/site-auth/${site}/${kind}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.detail || "Request failed");
      }

      const data = await res.json();

      if (kind === "login" && data?.access_token) {
        localStorage.setItem(`siteToken:${site}`, data.access_token);
        localStorage.setItem(`siteMemberId:${site}`, data.member_id);
      }

      onSuccess?.();

      // Redirect logic
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
    } catch (err: any) {
      setError(err.message || "Request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={props?.style || {}}>
      {props?.title && <h3>{props.title}</h3>}
      <div style={{ display: "grid", gap: "0.75rem" }}>
        {fields.map((f) => (
          <div key={f.id}>
            {f.label && <label>{f.label}</label>}
            <input
              type={f.type || "text"}
              name={f.name}
              placeholder={f.placeholder || ""}
              value={form[f.name] || ""}
              onChange={(e) => handleChange(f.name, e.target.value)}
              required
            />
          </div>
        ))}
      </div>
      {error && <div style={{ color: "red" }}>{error}</div>}
      <button type={editMode ? "button" : "submit"} disabled={loading}>
        {loading ? "Please wait..." : kind === "login" ? "Login" : "Register"}
      </button>
    </form>
  );
}
