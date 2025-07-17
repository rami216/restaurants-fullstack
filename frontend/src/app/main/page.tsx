"use client";

import React, { useEffect, useState, useRef } from "react"; // Import useRef
import api from "@/lib/axios";
import BrandForm from "@/components/BrandForm";
import LocationForm from "@/components/LocationForm";
import { tableConfigs } from "@/constants/tableConfigs";
import { loadStripe } from "@stripe/stripe-js";

const stripePromise = loadStripe(
  "pk_test_51PoT3lJ436yrzjfSZK3QP1DDzAG5HJvGKdAfj455nsKlalB76uKEjakezDDBVM2Ki9zaPxGm8UsvJKTpjdPejdEX00F4Pv3jkK"
);
const tableNames = [
  "locations",
  "categories",
  "menu_items",
  "extras",
  "menu_item_extras",
  "option_groups",
  "option_choices",
  "menu_item_options",
  "schedules",
];
const BACKEND_URL = "http://127.0.0.1:8000";

const MainPage = () => {
  // --- STATE MANAGEMENT ---
  const [loading, setLoading] = useState(true);
  const [hasRestaurant, setHasRestaurant] = useState<boolean | null>(null);
  const [hasBrand, setHasBrand] = useState<boolean | null>(null);
  const [hasLocations, setHasLocations] = useState<boolean>(false);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [brandId, setBrandId] = useState<string | null>(null);
  const [brandName, setBrandName] = useState("");
  const [showBrandForm, setShowBrandForm] = useState(false);
  const [showLocationForm, setShowLocationForm] = useState(false);
  const [locationName, setLocationName] = useState("");
  const [address, setAddress] = useState("");
  const [locationEmail, setLocationEmail] = useState("");
  const [selectedTable, setSelectedTable] = useState<string>("");
  const [selectedData, setSelectedData] = useState<any[]>([]);

  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(
    null
  );

  // --- NEW PAYMENT & BILLING STATE ---
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(
    null
  );
  const [creditBalance, setCreditBalance] = useState<number>(0);
  const [topUpAmount, setTopUpAmount] = useState<string>("10"); // Default to $10

  // NEW STATE: To track if the conditions for the link are met
  const [hasMenuItems, setHasMenuItems] = useState<boolean>(false);
  const [hasSchedules, setHasSchedules] = useState<boolean>(false);

  // NEW STATE: To store the calculated consumption cost
  const [totalConsumption, setTotalConsumption] = useState<number | null>(null);
  const [basePrice, setBasePrice] = useState(20);

  // NEW: Ref for the hidden file input
  const fileInputRef = useRef<HTMLInputElement>(null);
  // NEW: State to track which row's image is being uploaded
  const [uploadingImageIndex, setUploadingImageIndex] = useState<number | null>(
    null
  );

  const [dropdownOptions, setDropdownOptions] = useState<{
    locations: any[];
    categories: any[];
    menu_items: any[];
    extras: any[];
    option_groups: any[];
    days_of_week: any[]; // For the new schedule dropdown
  }>({
    locations: [],
    categories: [],
    menu_items: [],
    extras: [],
    option_groups: [],
    // Pre-populate with static data
    days_of_week: [
      { id: "Monday", name: "Monday" },
      { id: "Tuesday", name: "Tuesday" },
      { id: "Wednesday", name: "Wednesday" },
      { id: "Thursday", name: "Thursday" },
      { id: "Friday", name: "Friday" },
      { id: "Saturday", name: "Saturday" },
      { id: "Sunday", name: "Sunday" },
    ],
  });

  // --- AUTHENTICATION & SETUP FLOW ---
  const createRestaurant = async () => {
    try {
      await api.post("/restaurants/create", {
        owner_email: "",
        owner_name: "",
      });
      await checkRestaurant();
    } catch (error) {
      console.error("Failed to create restaurant", error);
      alert("Error creating restaurant.");
    }
  };
  const checkRestaurant = async () => {
    try {
      const res = await api.get("/restaurants/has-restaurant");
      if (res.data.has_restaurant) {
        setHasRestaurant(true);
        setRestaurantId(res.data.restaurant_id);
        // THE FIX: This line was missing. It updates the state with the new balance.
        setCreditBalance(res.data.credit_balance || 0);
        setSubscriptionStatus(res.data.subscription_status);
        await checkBrand(res.data.restaurant_id);
      } else {
        setHasRestaurant(false);
        setCreditBalance(0);
      }
    } catch (error) {
      console.error("Failed to check restaurant", error);
    } finally {
      setLoading(false);
    }
  };
  // --- PAYMENT HANDLERS ---
  const handleSubscribe = async () => {
    try {
      const res = await api.post("/payments/create-subscription-checkout");
      const { sessionId } = res.data;
      const stripe = await stripePromise;
      if (stripe) await stripe.redirectToCheckout({ sessionId });
    } catch (error) {
      console.error("Failed to create subscription session", error);
      alert("Error creating subscription.");
    }
  };
  const handleManageBilling = async () => {
    try {
      const res = await api.post("/payments/create-billing-portal-session");
      window.location.href = res.data.url;
    } catch (error) {
      console.error("Failed to create billing portal session", error);
      alert("Could not open billing portal.");
    }
  };
  const handleTopUp = async () => {
    const amount = parseFloat(topUpAmount);
    if (isNaN(amount) || amount <= 0)
      return alert("Please enter a valid amount.");
    try {
      const res = await api.post("/payments/create-top-up-session", { amount });
      const { sessionId } = res.data;
      const stripe = await stripePromise;
      if (stripe) await stripe.redirectToCheckout({ sessionId });
    } catch (error) {
      console.error("Failed to create top-up session", error);
      alert("Error creating payment session.");
    }
  };

  const createBrand = async () => {
    try {
      await api.post("/restaurants/create-brand", { name: brandName });
      await checkBrand(restaurantId);
    } catch (error) {
      console.error("Failed to create brand", error);
      alert("Error creating brand.");
    }
  };

  const checkBrand = async (currentRestaurantId: string | null) => {
    if (!currentRestaurantId) return;
    try {
      const res = await api.get("/restaurants/has-brand");
      if (res.data.has_brand) {
        setHasBrand(true);
        setBrandId(res.data.brand_id);
        setBrandName(res.data.brand_name);
        await checkLocations();
      } else {
        setHasBrand(false);
      }
    } catch (error) {
      console.error("Failed to check brand", error);
    }
  };

  const checkLocations = async () => {
    try {
      const res = await api.get(`/locations/has-location`);
      const locations = Array.isArray(res.data) ? res.data : [];
      setHasLocations(locations.length > 0);
      setDropdownOptions((prev) => ({ ...prev, locations: locations }));

      if (locations.length > 0) {
        // If locations exist, select the first one and check its data
        const firstLocationId = locations[0].location_id;
        setSelectedLocationId(firstLocationId);
        await checkDataCompleteness(firstLocationId);
      } else {
        // If no locations, reset all dependent states
        setSelectedLocationId(null);
        setHasMenuItems(false);
        setHasSchedules(false);
      }
    } catch (error) {
      console.error("Failed to check locations", error);
      setHasLocations(false);
      setDropdownOptions((prev) => ({ ...prev, locations: [] }));
    }
  };
  // NEW HELPER: Checks if the selected location has menu items and schedules
  const checkDataCompleteness = async (locationId: string) => {
    if (!locationId) {
      setHasMenuItems(false);
      setHasSchedules(false);
      return;
    }
    try {
      const [menuItemsRes, schedulesRes] = await Promise.all([
        api.get(`/locations/${locationId}/menu`),
        api.get(`/schedules/by-location/${locationId}`),
      ]);
      setHasMenuItems(menuItemsRes.data.length > 0);
      setHasSchedules(schedulesRes.data.length > 0);
    } catch (error) {
      console.error("Error checking data completeness:", error);
      setHasMenuItems(false);
      setHasSchedules(false);
    }
  };

  const createLocation = async () => {
    if (!restaurantId || !brandId)
      return alert("Missing restaurant or brand ID.");
    try {
      await api.post("/locations/create-location", {
        brand_id: brandId,
        location_name: locationName,
        address,
        phone_number: "",
        maps_link: "",
        location_owner_email: locationEmail,
        restaurant_id: restaurantId,
      });
      await checkLocations();
    } catch (error) {
      console.error("Failed to create location", error);
      alert("Error creating location.");
    }
  };
  // UPDATED: This function now updates the UI when the location changes
  const handleLocationChange = async (newLocationId: string) => {
    setSelectedLocationId(newLocationId);
    // Re-check data completeness for the new location to update the automation link
    await checkDataCompleteness(newLocationId);
    // If a table is already open, refresh its data for the new context
    if (selectedTable) {
      await handleTableClick(selectedTable, newLocationId);
    }
  };

  useEffect(() => {
    checkRestaurant();
  }, []);

  // --- CORE DATA HANDLING ---

  const handleTableClick = async (
    tableName: string,
    locationIdOverride?: string | null
  ) => {
    setSelectedTable(tableName);
    setSelectedData([]);
    const config = tableConfigs[tableName];
    if (!config) return;

    try {
      const locationId =
        locationIdOverride !== undefined
          ? locationIdOverride
          : selectedLocationId;

      if (!locationId && !["locations", "categories"].includes(tableName)) {
        return alert("Please select a location first.");
      }

      let mainData: any[] = [];
      let newDropdownOptions = {};

      if (tableName === "locations") {
        const res = await api.get(`/locations/has-location`);
        mainData = Array.isArray(res.data) ? res.data : [];
        setDropdownOptions((prev) => ({ ...prev, locations: mainData }));
      } else if (tableName === "categories") {
        const res = await api.get(`/restaurants/categories/${restaurantId}`);
        mainData = Array.isArray(res.data) ? res.data : [];
        newDropdownOptions = { categories: mainData };
      } else if (tableName === "menu_items") {
        const [menuItemsRes, categoriesRes] = await Promise.all([
          api.get(`/locations/${locationId}/menu`),
          api.get(`/restaurants/categories/${restaurantId}`),
        ]);
        mainData = Array.isArray(menuItemsRes.data) ? menuItemsRes.data : [];
        newDropdownOptions = { categories: categoriesRes.data };
      } else if (tableName === "extras") {
        const res = await api.get(`/extras/by-location/${locationId}`);
        mainData = Array.isArray(res.data) ? res.data : [];
      } else if (tableName === "menu_item_extras") {
        const [linksRes, menuItemsRes, extrasRes] = await Promise.all([
          api.get(`/menu-item-extras/by-location/${locationId}`),
          api.get(`/locations/${locationId}/menu`),
          api.get(`/extras/by-location/${locationId}`),
        ]);
        mainData = Array.isArray(linksRes.data) ? linksRes.data : [];
        newDropdownOptions = {
          menu_items: menuItemsRes.data,
          extras: extrasRes.data,
        };
      } else if (tableName === "option_groups") {
        const res = await api.get(`/option-groups/by-location/${locationId}`);
        mainData = Array.isArray(res.data) ? res.data : [];
      } else if (tableName === "option_choices") {
        const [choicesRes, groupsRes] = await Promise.all([
          api.get(`/option-choices/by-location/${locationId}`),
          api.get(`/option-groups/by-location/${locationId}`),
        ]);
        mainData = Array.isArray(choicesRes.data) ? choicesRes.data : [];
        newDropdownOptions = { option_groups: groupsRes.data };
      } else if (tableName === "menu_item_options") {
        const [linksRes, menuItemsRes, groupsRes] = await Promise.all([
          api.get(`/menu-item-options/by-location/${locationId}`),
          api.get(`/locations/${locationId}/menu`),
          api.get(`/option-groups/by-location/${locationId}`),
        ]);
        mainData = Array.isArray(linksRes.data) ? linksRes.data : [];
        newDropdownOptions = {
          menu_items: menuItemsRes.data,
          option_groups: groupsRes.data,
        };
      } else if (tableName === "schedules") {
        const res = await api.get(`/schedules/by-location/${locationId}`);
        mainData = Array.isArray(res.data) ? res.data : [];
      }

      setSelectedData(mainData);
      if (Object.keys(newDropdownOptions).length > 0) {
        setDropdownOptions((prev) => ({ ...prev, ...newDropdownOptions }));
      }
    } catch (error) {
      console.error(`Error fetching data for ${tableName}:`, error);
    }
  };
  const handleSaveChanges = async () => {
    const config = tableConfigs[selectedTable];
    if (!config) return;

    const getTypedPayload = (row: any, fields: typeof config.fields) => {
      const typedRow: { [key: string]: any } = {};
      for (const field of fields) {
        const rawValue = row[field.key];
        if (rawValue === null || rawValue === undefined || rawValue === "") {
          if (field.dataType === "boolean") typedRow[field.key] = false;
          else typedRow[field.key] = null;
          continue;
        }
        switch (field.dataType) {
          case "number":
            const num = parseFloat(rawValue);
            typedRow[field.key] = isNaN(num) ? null : num;
            break;
          case "boolean":
            typedRow[field.key] = String(rawValue).toLowerCase() === "true";
            break;
          default:
            typedRow[field.key] = rawValue;
            break;
        }
      }
      return typedRow;
    };

    for (const row of selectedData) {
      try {
        const primaryKeyField = config.primaryKey;
        const isExisting = row[primaryKeyField];
        const processedRow = getTypedPayload(row, config.fields);

        if (isExisting) {
          if (!config.updateApi) continue;
          const apiUrl = config.updateApi.replace(
            /\${(.*?)}/g,
            (_, key) => row[key]
          );
          await api.put(apiUrl, processedRow);
        } else {
          if (!config.createApi) continue;
          const payload: any = { ...processedRow };

          // THE FIX: Always use the currently selected location ID from the state.
          if (
            [
              "menu_items",
              "extras",
              "option_groups",
              "option_choices",
              "schedules",
            ].includes(selectedTable)
          ) {
            payload.location_id = selectedLocationId;
          }
          if (selectedTable === "categories") {
            payload.restaurant_id = restaurantId;
          }

          // Final check to ensure we have a location_id before sending
          if (
            payload.location_id === null &&
            [
              "menu_items",
              "extras",
              "option_groups",
              "option_choices",
              "schedules",
            ].includes(selectedTable)
          ) {
            alert("Error: No location selected. Cannot create new item.");
            return;
          }

          await api.post(config.createApi, payload);
        }
      } catch (error) {
        console.error("Error saving row:", error);
        alert(`Failed to save changes. Please check the console for details.`);
        return;
      }
    }
    alert("Changes saved!");
    await handleTableClick(selectedTable);
  };
  const handleDeleteRow = async (item: any) => {
    const config = tableConfigs[selectedTable];
    if (!config?.deleteApi) return;
    const primaryKeyValue = item[config.primaryKey];
    if (!primaryKeyValue)
      return alert("Cannot delete row without a primary key.");
    const apiUrl = config.deleteApi.replace(/\${(.*?)}/g, primaryKeyValue);
    try {
      await api.delete(apiUrl);
      alert("Deleted successfully!");
      await handleTableClick(selectedTable);
    } catch (error) {
      console.error("Delete error:", error);
      alert("Delete failed.");
    }
  };

  // --- NEW IMAGE UPLOAD HANDLER ---
  // --- NEW IMAGE UPLOAD HANDLER ---
  const handleImageUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file || uploadingImageIndex === null) return;

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await api.post("/uploads/image", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const imageUrl = response.data.image_url;
      const newData = [...selectedData];
      newData[uploadingImageIndex] = {
        ...newData[uploadingImageIndex],
        image_url: imageUrl,
      };
      setSelectedData(newData);
    } catch (error) {
      console.error("Image upload failed:", error);
      alert("Image upload failed. Please try again.");
    } finally {
      setUploadingImageIndex(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // --- RENDER ---
  if (loading) {
    return (
      <main className="h-screen flex items-center justify-center">
        <p className="text-white text-xl">Loading...</p>
      </main>
    );
  }

  return (
    <>
      <main className="h-[calc(90vh-64px)] flex flex-col items-center justify-center bg-gradient-to-r from-pink-500 to-red-500 text-white px-4">
        {/* --- Setup UI is unchanged --- */}
        <h1 className="text-3xl md:text-5xl font-extrabold mb-4">
          Welcome to Smart Fast Chatbot!
        </h1>
        {hasRestaurant ? (
          <>
            <h2 className="text-xl mb-4">✅ You have a restaurant!</h2>
            {hasBrand === null ? (
              <p>Checking brand...</p>
            ) : hasBrand ? (
              <>
                <h3 className="text-xl mb-4">
                  ✅ Brand: <span className="font-bold">{brandName}</span>
                </h3>
                {/* --- BILLING & LOCATION SECTION --- */}
                <div className="p-4 bg-black bg-opacity-20 rounded-lg text-center space-y-4">
                  {subscriptionStatus === "active" ? (
                    <>
                      <div>
                        {/* UPDATED: Simplified display */}
                        <h4 className="text-lg font-semibold">
                          Remaining Credit: ${creditBalance.toFixed(5)}
                        </h4>
                      </div>
                      <div className="flex items-center justify-center space-x-2">
                        <input
                          type="number"
                          value={topUpAmount}
                          onChange={(e) => setTopUpAmount(e.target.value)}
                          placeholder="e.g., 10.00"
                          className="bg-white text-black px-2 py-1 rounded w-24"
                        />
                        <button
                          onClick={handleTopUp}
                          className="bg-blue-500 hover:bg-blue-600 text-white font-semibold px-4 py-1 rounded"
                        >
                          Add Funds
                        </button>
                      </div>
                      <button
                        onClick={handleManageBilling}
                        className="text-sm text-gray-300 hover:underline"
                      >
                        Manage Subscription & Billing
                      </button>
                    </>
                  ) : (
                    <div className="text-center">
                      <p className="mb-2">
                        Subscribe for $20/month to activate your account.
                      </p>
                      <button
                        onClick={handleSubscribe}
                        className="bg-green-500 hover:bg-green-600 text-white font-bold px-6 py-2 rounded"
                      >
                        Subscribe Now
                      </button>
                    </div>
                  )}
                </div>
                {hasLocations ? (
                  <div className="text-center">
                    {/* This div keeps the label and dropdown on the same row */}
                    <div className="flex items-center justify-center space-x-4">
                      <h4 className="text-lg">✅ Current Location:</h4>
                      <select
                        value={selectedLocationId || ""}
                        onChange={(e) => handleLocationChange(e.target.value)}
                        className="bg-white text-pink-600 font-semibold px-4 py-2 rounded"
                      >
                        {dropdownOptions.locations.map((loc) => (
                          <option key={loc.location_id} value={loc.location_id}>
                            {loc.location_name}
                          </option>
                        ))}
                      </select>
                      <button
                        className="bg-white text-pink-600 font-semibold px-4 py-2 rounded hover:bg-pink-100"
                        onClick={() => setShowLocationForm(true)}
                      >
                        + Add New
                      </button>
                    </div>

                    {/* This div puts the automation link on its own line */}
                    {hasMenuItems && hasSchedules && (
                      <div className="mt-4">
                        <a
                          href={`https://restaurants-automation.onrender.com/?restaurant_id=${restaurantId}&restaurant_name=${encodeURIComponent(
                            brandName
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-white underline hover:text-pink-200 text-lg"
                        >
                          View Automation Link
                        </a>
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    <h4 className="text-lg mb-4">❌ No locations yet.</h4>
                    <button
                      className="bg-white text-pink-600 font-semibold px-4 py-2 rounded hover:bg-pink-100"
                      onClick={() => setShowLocationForm(true)}
                    >
                      Add Location
                    </button>
                  </>
                )}
                {showLocationForm && (
                  <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
                    <div className="bg-white p-6 rounded shadow-lg">
                      <LocationForm
                        locationName={locationName}
                        setLocationName={setLocationName}
                        address={address}
                        setAddress={setAddress}
                        locationEmail={locationEmail}
                        setLocationEmail={setLocationEmail}
                        onSave={() => {
                          createLocation();
                          setShowLocationForm(false);
                        }}
                      />
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                <h3 className="text-xl mb-4">❌ No brand yet.</h3>
                <button
                  className="bg-white text-pink-600 font-semibold px-4 py-2 rounded hover:bg-pink-100"
                  onClick={() => setShowBrandForm(true)}
                >
                  Create Brand
                </button>
                {showBrandForm && (
                  <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
                    <div className="bg-white p-6 rounded shadow-lg">
                      <BrandForm
                        brandName={brandName}
                        setBrandName={setBrandName}
                        onSave={() => {
                          createBrand();
                          setShowBrandForm(false);
                        }}
                      />
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        ) : (
          <>
            <h2 className="text-xl mb-4">❌ No restaurant yet.</h2>
            <button
              className="bg-white text-pink-600 font-semibold px-4 py-2 rounded hover:bg-pink-100"
              onClick={createRestaurant}
            >
              Create Restaurant
            </button>
          </>
        )}
      </main>

      {hasLocations && (
        <section className="w-full flex justify-start bg-gray-100 text-black p-8">
          <div className="w-64 bg-white rounded shadow p-4 mr-8">
            <h5 className="text-lg font-bold mb-2">Tables</h5>
            <table className="w-full border border-gray-300">
              <tbody>
                {tableNames.map((name) => (
                  <tr key={name}>
                    <td className="p-2 border border-gray-300">
                      <button
                        className={`w-full text-left ${
                          selectedTable === name
                            ? "font-bold text-pink-600"
                            : ""
                        }`}
                        onClick={() => handleTableClick(name)}
                      >
                        {name}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {selectedTable && tableConfigs[selectedTable] && (
            <div className="flex-1">
              <div className="flex justify-between mb-4">
                <h3 className="text-xl font-bold">
                  {selectedTable.charAt(0).toUpperCase() +
                    selectedTable.slice(1).replace(/_/g, " ")}{" "}
                  Table
                </h3>
                {selectedTable !== "locations" && (
                  <button
                    className="bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700"
                    onClick={() => {
                      const emptyRow: any = {};
                      tableConfigs[selectedTable].fields.forEach(
                        (field) => (emptyRow[field.key] = "")
                      );
                      setSelectedData((prev) => [...prev, emptyRow]);
                    }}
                  >
                    + Add Row
                  </button>
                )}
              </div>

              <table className="min-w-full bg-white border border-gray-300">
                <thead className="bg-gray-200">
                  <tr>
                    {tableConfigs[selectedTable].fields.map((field) => (
                      <th
                        key={field.key}
                        className="p-2 border border-gray-300"
                      >
                        {field.label}
                      </th>
                    ))}
                    <th className="p-2 border border-gray-300">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedData.map((item, index) => (
                    <tr key={index}>
                      {tableConfigs[selectedTable].fields.map((field) => {
                        const renderConfig = field.renderAs;
                        return (
                          <td
                            key={field.key}
                            className="p-2 border border-gray-300"
                          >
                            {renderConfig?.type === "dropdown" &&
                            renderConfig.optionsSource ? (
                              <select
                                className="border border-gray-300 rounded p-1 w-full"
                                value={item[field.key] ?? ""}
                                onChange={(e) => {
                                  const newValue = e.target.value;
                                  setSelectedData((prev) => {
                                    const dataArray = [...prev];
                                    dataArray[index] = {
                                      ...dataArray[index],
                                      [field.key]: newValue,
                                    };
                                    return dataArray;
                                  });
                                }}
                              >
                                <option value="" disabled>
                                  -- Select --
                                </option>
                                {(
                                  dropdownOptions[renderConfig.optionsSource] ||
                                  []
                                ).map((option: any) => {
                                  const optionValue =
                                    option.group_id ||
                                    option.item_id ||
                                    option.extra_id ||
                                    option.id;
                                  const optionLabel =
                                    option.group_name ||
                                    option.item_name ||
                                    option.name;
                                  return (
                                    <option
                                      key={optionValue}
                                      value={optionValue}
                                    >
                                      {optionLabel}
                                    </option>
                                  );
                                })}
                              </select>
                            ) : renderConfig?.type === "boolean" ? (
                              <select
                                className="border border-gray-300 rounded p-1 w-full"
                                value={String(item[field.key])}
                                onChange={(e) => {
                                  const newValue = e.target.value === "true";
                                  setSelectedData((prev) => {
                                    const dataArray = [...prev];
                                    dataArray[index] = {
                                      ...dataArray[index],
                                      [field.key]: newValue,
                                    };
                                    return dataArray;
                                  });
                                }}
                              >
                                <option value="true">True</option>
                                <option value="false">False</option>
                              </select>
                            ) : renderConfig?.type === "image" ? (
                              <div className="flex items-center space-x-2">
                                <img
                                  src={
                                    item[field.key]
                                      ? `${BACKEND_URL}${item[field.key]}`
                                      : "https://placehold.co/60x60/e2e8f0/a0aec0?text=No+Image"
                                  }
                                  alt={
                                    item.name || item.item_name || "Item image"
                                  }
                                  className="w-16 h-16 object-cover rounded"
                                  onError={(e) => {
                                    e.currentTarget.src =
                                      "https://placehold.co/60x60/fecaca/991b1b?text=Error";
                                  }}
                                />
                                <button
                                  onClick={() => {
                                    setUploadingImageIndex(index);
                                    fileInputRef.current?.click();
                                  }}
                                  className="bg-gray-200 text-gray-700 px-3 py-1 rounded text-sm hover:bg-gray-300"
                                >
                                  Change
                                </button>
                              </div>
                            ) : (
                              <input
                                className="border border-gray-300 rounded p-1 w-full"
                                value={item[field.key] ?? ""}
                                onChange={(e) => {
                                  const newValue = e.target.value;
                                  setSelectedData((prev) => {
                                    const dataArray = [...prev];
                                    dataArray[index] = {
                                      ...dataArray[index],
                                      [field.key]: newValue,
                                    };
                                    return dataArray;
                                  });
                                }}
                              />
                            )}
                          </td>
                        );
                      })}
                      <td className="p-2 border border-gray-300">
                        {selectedTable !== "locations" && (
                          <button
                            className="bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600"
                            onClick={() => handleDeleteRow(item)}
                          >
                            Delete
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <button
                className="mt-4 bg-pink-600 text-white px-4 py-2 rounded hover:bg-pink-700"
                onClick={handleSaveChanges}
              >
                Save Changes
              </button>
            </div>
          )}
        </section>
      )}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleImageUpload}
      />
    </>
  );
};

export default MainPage;
