"use client";

import * as React from "react";
import api from "@/lib/axios";
import { useRouter } from "next/navigation";

type Field = {
  id: string;
  label?: string;
  name: string; // sent to backend as a key in the payload
  placeholder?: string;
  type?: "text" | "email" | "password";
};

export default function AuthFormElement({
  kind, // "login" | "register"
  props, // element.properties
  subdomain, // websiteData.subdomain
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

  const fields: Field[] = Array.isArray(props?.fields) ? props.fields : [];
  const labelStyle = props?.labelStyle || {};
  const inputStyle = props?.inputStyle || {};
  const buttonStyle = props?.submitButton?.style || {};
  const btnText =
    props?.submitButton?.text || (kind === "login" ? "Login" : "Register");

  const [form, setForm] = React.useState<Record<string, string>>({});
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Base app URL (no trailing slash)
  const appBase = React.useMemo(
    () =>
      (process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
        "http://localhost:3000") as string,
    []
  );

  // initialize empty values for controlled inputs
  React.useEffect(() => {
    const initial: Record<string, string> = {};
    for (const f of fields) initial[f.name] = initial[f.name] ?? "";
    setForm((prev) => ({ ...initial, ...prev }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fields.map((f) => f.name).join("|")]);

  const handleChange = (name: string, value: string) =>
    setForm((f) => ({ ...f, [name]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editMode) return; // no API calls from preview

    setLoading(true);
    setError(null);

    try {
      if (!subdomain) {
        throw new Error("Missing subdomain for site auth.");
      }

      const url =
        kind === "login"
          ? `/site-auth/${subdomain}/login`
          : `/site-auth/${subdomain}/register`;

      const { data } = await api.post(url, form);

      // On LOGIN: store token if provided
      if (kind === "login" && data?.access_token) {
        localStorage.setItem(`siteToken:${subdomain}`, data.access_token);
      }

      onSuccess?.();

      // Redirect rules (no override):
      const redirect =
        kind === "register"
          ? `${appBase}/${subdomain}/login`
          : `${appBase}/${subdomain}`;

      try {
        router.push(redirect);
        router.refresh?.();
      } catch {
        if (typeof window !== "undefined") window.location.assign(redirect);
      }
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || "Request failed");
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
