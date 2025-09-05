// src/components/builder/VisibilityEditor.tsx

import { VisibilityRule } from "./Properties";
import React, { useState } from "react";
import { X } from "lucide-react";

// Define a type for the products you'll pass in
type Product = {
  product_id: string;
  name: string;
};

// Note: You should also update your VisibilityRule type in your Properties.ts file to include this:
// export interface VisibilityRule {
//   // ... other rules
//   forbidden_product_id?: string;
// }

export default function VisibilityEditor({
  value,
  onChange,
  onBecameProtected,
  products = [],
  isSubscribed = false,
}: {
  value: any | undefined;
  onChange: (next: any) => void;
  onBecameProtected?: () => void;
  products?: Product[];
  isSubscribed?: boolean;
}) {
  const v: VisibilityRule = value?.visibility || {};
  const wasProtected =
    !!v.requiresAuth || !!v.required_product_id || !!v.forbidden_product_id;

  // ✅ 1. ADD STATE to manage the new email input
  const [newAdminEmail, setNewAdminEmail] = useState("");

  const handleVisibilityChange = (rule: keyof VisibilityRule, val: any) => {
    let nextVisibility: VisibilityRule = { ...v, [rule]: val };

    // --- Logic for exclusivity and dependencies ---
    if (rule === "requiresAuth" && val) {
      nextVisibility.requiresAnonymous = false;
    }
    if (rule === "requiresAnonymous" && val) {
      nextVisibility.requiresAuth = false;
      nextVisibility.required_product_id = ""; // Can't require product if user must be anonymous
      nextVisibility.forbidden_product_id = ""; // Can't forbid product if user must be anonymous
      nextVisibility.admin_emails = []; // Can't restrict by email if user must be anonymous
    }
    if (rule === "required_product_id" && val) {
      nextVisibility.requiresAuth = true; // Force login if a product is required
      nextVisibility.requiresAnonymous = false;
      nextVisibility.forbidden_product_id = ""; // A product cannot be both required and forbidden
    }
    if (rule === "forbidden_product_id" && val) {
      nextVisibility.requiresAuth = true; // Must be logged in to check purchase status
      nextVisibility.requiresAnonymous = false;
      nextVisibility.required_product_id = ""; // A product cannot be both required and forbidden
    }
    if (rule === "admin_emails" && val?.length > 0) {
      nextVisibility.requiresAnonymous = false; // Must be logged in to check email
    }

    onChange({ ...value, visibility: nextVisibility });

    const isNowProtected =
      nextVisibility.requiresAuth ||
      !!nextVisibility.required_product_id ||
      !!nextVisibility.forbidden_product_id;

    if (!wasProtected && isNowProtected) {
      onBecameProtected?.();
    }
  };
  // ✅ 2. ADD HANDLERS to add/remove admin emails
  const handleAddAdmin = () => {
    if (newAdminEmail && !v.admin_emails?.includes(newAdminEmail)) {
      const updatedAdmins = [...(v.admin_emails || []), newAdminEmail];
      handleVisibilityChange("admin_emails", updatedAdmins);
      setNewAdminEmail(""); // Clear the input
    }
  };

  const handleRemoveAdmin = (emailToRemove: string) => {
    const updatedAdmins = (v.admin_emails || []).filter(
      (email) => email !== emailToRemove
    );
    handleVisibilityChange("admin_emails", updatedAdmins);
  };

  return (
    <div className="mt-4 border-t pt-4 space-y-4">
      <div className="font-medium">Visibility</div>

      {!isSubscribed && (
        <div className="rounded-md border border-amber-300 bg-amber-50 text-amber-800 text-sm px-3 py-2">
          Please subscribe to use AI features.
        </div>
      )}

      <fieldset
        disabled={!isSubscribed}
        className={!isSubscribed ? "opacity-60 pointer-events-none" : ""}
      >
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={!!v.requiresAuth}
            onChange={(e) =>
              handleVisibilityChange("requiresAuth", e.target.checked)
            }
            disabled={
              !!v.required_product_id ||
              !!v.forbidden_product_id ||
              !isSubscribed
            }
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
            disabled={!isSubscribed}
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
            disabled={v.requiresAnonymous || !isSubscribed}
          >
            <option value="">-- No product required --</option>
            {products.map((p) => (
              <option key={p.product_id} value={p.product_id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Hide on Product Purchase
          </label>
          <p className="text-xs text-gray-500 mb-2">
            Hide this if the logged-in member has purchased a specific product.
          </p>
          <select
            value={v.forbidden_product_id || ""}
            onChange={(e) =>
              handleVisibilityChange("forbidden_product_id", e.target.value)
            }
            className="block w-full border-gray-300 rounded-md shadow-sm p-2"
            disabled={v.requiresAnonymous || !isSubscribed}
          >
            <option value="">-- Don't hide based on purchase --</option>
            {products.map((p) => (
              <option key={p.product_id} value={p.product_id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <hr />
        {/* ✅ 3. ADD THE NEW UI for managing the admin list */}
        <div>
          <h5 className="text-sm font-medium text-gray-800 mb-2">
            Restrict to Specific Members (by Email)
          </h5>
          <p className="text-xs text-gray-500 mb-2">
            If you add emails here, only logged-in members with a matching email
            can see this.
          </p>
          <div className="space-y-2">
            {(v.admin_emails || []).map((email) => (
              <div
                key={email}
                className="flex items-center justify-between bg-gray-100 p-2 rounded"
              >
                <span className="text-sm truncate">{email}</span>
                <button
                  onClick={() => handleRemoveAdmin(email)}
                  className="text-red-500 hover:text-red-700"
                >
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 mt-2">
            <input
              type="email"
              placeholder="member@example.com"
              value={newAdminEmail}
              onChange={(e) => setNewAdminEmail(e.target.value)}
              className="flex-grow border-gray-300 rounded-md shadow-sm p-2 text-sm"
              disabled={v.requiresAnonymous || !isSubscribed}
            />
            <button
              onClick={handleAddAdmin}
              className="bg-blue-600 text-white p-2 rounded"
              disabled={v.requiresAnonymous || !isSubscribed}
            >
              Add
            </button>
          </div>
        </div>
      </fieldset>
    </div>
  );
}
