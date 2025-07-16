"use client";

import React from "react";

type LocationFormProps = {
  locationName: string;
  setLocationName: (value: string) => void;
  address: string;
  setAddress: (value: string) => void;
  locationEmail: string;
  setLocationEmail: (value: string) => void;
  onSave: () => void;
};

const LocationForm: React.FC<LocationFormProps> = ({
  locationName,
  setLocationName,
  address,
  setAddress,
  locationEmail,
  setLocationEmail,
  onSave,
}) => {
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-xl font-bold mb-4 text-black">Add Location</h2>
      <input
        className="border border-gray-300 rounded p-2 text-black"
        placeholder="Location Name"
        value={locationName}
        onChange={(e) => setLocationName(e.target.value)}
      />
      <input
        className="border border-gray-300 rounded p-2 text-black"
        placeholder="Address"
        value={address}
        onChange={(e) => setAddress(e.target.value)}
      />
      <input
        className="border border-gray-300 rounded p-2 text-black"
        placeholder="location email"
        value={locationEmail}
        onChange={(e) => setLocationEmail(e.target.value)}
      />
      <button
        className="bg-pink-600 text-white font-semibold px-4 py-2 rounded hover:bg-pink-700"
        onClick={onSave}
      >
        Save
      </button>
    </div>
  );
};

export default LocationForm;
