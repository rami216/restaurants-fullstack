// src/components/builder/VisibilityEditor.tsx

import React from "react";
import { VisibilityRule } from "./Properties";

// Define a type for the products you'll pass in
type Product = {
  product_id: string;
  name: string;
};

export default function VisibilityEditor({
  value,
  onChange,
  onBecameProtected,
  products = [],
}: {
  value: any | undefined;
  onChange: (next: any) => void;
  onBecameProtected?: () => void;
  products?: Product[];
}) {
  const v: VisibilityRule = value?.visibility || {};
  const wasProtected = !!v.requiresAuth || !!v.required_product_id;

  const handleVisibilityChange = (rule: keyof VisibilityRule, val: any) => {
    let nextVisibility: VisibilityRule = { ...v, [rule]: val };

    // Add logic for exclusivity and dependencies
    if (rule === "requiresAuth" && val) {
      nextVisibility.requiresAnonymous = false;
    }
    if (rule === "requiresAnonymous" && val) {
      nextVisibility.requiresAuth = false;
      nextVisibility.required_product_id = ""; // Can't require product if user must be anonymous
    }
    if (rule === "required_product_id" && val) {
      nextVisibility.requiresAuth = true; // Force login if a product is required
    }

    onChange({ ...value, visibility: nextVisibility });

    // Trigger auth page creation if needed
    const isNowProtected =
      nextVisibility.requiresAuth || !!nextVisibility.required_product_id;
    if (!wasProtected && isNowProtected) {
      onBecameProtected?.();
    }
  };

  return (
    <div className="mt-4 border-t pt-4 space-y-4">
      <div className="font-medium">Visibility</div>

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={!!v.requiresAuth}
          onChange={(e) =>
            handleVisibilityChange("requiresAuth", e.target.checked)
          }
          disabled={!!v.required_product_id} // Disable if a product is required
        />
        <span>Require login (site member)</span>
      </label>

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={!!v.requiresAnonymous}
          onChange={(e) =>
            handleVisibilityChange("requiresAnonymous", e.target.checked)
          }
        />
        <span>Only show to logged-out visitors</span>
      </label>

      <hr />
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Require Product Purchase
        </label>
        <p className="text-xs text-gray-500 mb-2">
          Only show this if the logged-in member has purchased a product.
        </p>
        <select
          value={v.required_product_id || ""}
          onChange={(e) =>
            handleVisibilityChange("required_product_id", e.target.value)
          }
          className="block w-full border-gray-300 rounded-md shadow-sm p-2"
          disabled={v.requiresAnonymous}
        >
          <option value="">-- No product required --</option>
          {products.map((p) => (
            <option key={p.product_id} value={p.product_id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
