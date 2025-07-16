"use client";

import React from "react";

type BrandFormProps = {
  brandName: string;
  setBrandName: (name: string) => void;
  onSave: () => void;
};

const BrandForm: React.FC<BrandFormProps> = ({
  brandName,
  setBrandName,
  onSave,
}) => {
  return (
    <div className="flex flex-col items-center justify-center space-y-4">
      <input
        type="text"
        value={brandName}
        onChange={(e) => setBrandName(e.target.value)}
        placeholder="Enter brand name"
        className="px-4 py-2 rounded text-pink-600 focus:outline-none focus:ring-2 focus:ring-pink-300"
      />
      <button
        onClick={onSave}
        className="bg-white text-pink-600 font-semibold px-4 py-2 rounded hover:bg-pink-100"
      >
        Save Brand
      </button>
    </div>
  );
};

export default BrandForm;
