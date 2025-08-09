// VisibilityEditor.tsx
import React from "react";
type Visibility = {
  requiresAuth?: boolean;
  requiresAnonymous?: boolean;
  roles?: string[];
};

export default function VisibilityEditor({
  value, // the full properties object (or page.properties)
  onChange, // setState for the properties object
  onBecameProtected, // call ensure-auth-pages once when switching on
}: {
  value: any | undefined;
  onChange: (next: any) => void;
  onBecameProtected?: () => void;
}) {
  const v: Visibility = value?.visibility || {};
  const wasProtected = !!v.requiresAuth;

  return (
    <div className="mt-4 border-t pt-4 space-y-2">
      <div className="font-medium">Visibility</div>

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={!!v.requiresAuth}
          onChange={(e) => {
            const next = {
              ...(value || {}),
              visibility: {
                ...(v || {}),
                requiresAuth: e.target.checked,
                requiresAnonymous: false,
              },
            };
            onChange(next);
            if (!wasProtected && e.target.checked) onBecameProtected?.();
          }}
        />
        <span>Require login (site member)</span>
      </label>

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={!!v.requiresAnonymous}
          onChange={(e) => {
            const next = {
              ...(value || {}),
              visibility: {
                ...(v || {}),
                requiresAnonymous: e.target.checked,
                requiresAuth: false,
              },
            };
            onChange(next);
          }}
        />
        <span>Only show to logged-out visitors</span>
      </label>
    </div>
  );
}
