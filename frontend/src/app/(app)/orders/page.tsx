"use client";

import React, { useState, useEffect } from "react";
import api from "@/lib/axios";
import { WebsiteOrder } from "@/components/builder/Properties";
import { ChevronDown, Package, FileText } from "lucide-react";

// Interface for Form Submissions to match your backend schema
interface FormSubmission {
  submission_id: string;
  website_id: string;
  form_element_id: string;
  submission_data: Record<string, any>;
  created_at: string;
}

export default function OrdersPage() {
  const [activeTab, setActiveTab] = useState("orders");
  const [orders, setOrders] = useState<WebsiteOrder[]>([]);
  const [submissions, setSubmissions] = useState<FormSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      setExpandedId(null); // Collapse all items when switching tabs

      try {
        if (activeTab === "orders") {
          const response = await api.get(`/orders/my-orders`);
          setOrders(response.data);
        } else if (activeTab === "forms") {
          const response = await api.get(`/builder/my-submissions`);
          setSubmissions(response.data);
        }
      } catch (err) {
        setError(`Failed to load ${activeTab}. Please try again.`);
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [activeTab]);

  const toggleItem = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8">
      <h1 className="text-3xl font-bold mb-6">Your Dashboard</h1>

      <div className="border-b mb-6">
        <nav className="flex space-x-4">
          <button
            onClick={() => setActiveTab("orders")}
            className={`py-2 px-4 font-semibold transition-colors duration-200 ${
              activeTab === "orders"
                ? "border-b-2 border-indigo-600 text-indigo-600"
                : "text-gray-500 hover:text-indigo-600"
            }`}
          >
            Website Orders
          </button>
          <button
            onClick={() => setActiveTab("forms")}
            className={`py-2 px-4 font-semibold transition-colors duration-200 ${
              activeTab === "forms"
                ? "border-b-2 border-indigo-600 text-indigo-600"
                : "text-gray-500 hover:text-indigo-600"
            }`}
          >
            Form Submissions
          </button>
        </nav>
      </div>

      {/* Orders Tab Content */}
      {activeTab === "orders" && (
        <div className="bg-white p-6 rounded-lg shadow-md">
          {loading && <p className="text-center py-12">Loading orders...</p>}
          {error && <p className="text-red-500 text-center py-12">{error}</p>}
          {!loading && !error && orders.length === 0 && (
            <div className="text-center py-12">
              <Package size={48} className="mx-auto text-gray-400" />
              <h3 className="mt-2 text-xl font-semibold">No Orders Yet</h3>
              <p className="mt-1 text-gray-500">
                New orders from your website will appear here.
              </p>
            </div>
          )}
          {!loading && !error && orders.length > 0 && (
            <div className="space-y-3">
              {orders.map((order) => (
                <div key={order.order_id} className="border rounded-lg">
                  <button
                    onClick={() => toggleItem(order.order_id)}
                    className="w-full flex items-center justify-between p-4 text-left"
                  >
                    <div className="flex-1 grid grid-cols-4 gap-4 items-center">
                      <span className="font-semibold">
                        {order.customer_name}
                      </span>
                      <span className="text-gray-600">
                        {new Date(order.created_at).toLocaleString()}
                      </span>
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full text-center capitalize ${
                          order.status === "paid"
                            ? "bg-green-100 text-green-800"
                            : "bg-yellow-100 text-yellow-800"
                        }`}
                      >
                        {order.status}
                      </span>
                      <span className="font-semibold text-right">
                        ${(order.total_amount_cents / 100).toFixed(2)}
                      </span>
                    </div>
                    <ChevronDown
                      size={20}
                      className={`ml-4 transition-transform ${
                        expandedId === order.order_id ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {expandedId === order.order_id && (
                    <div className="border-t p-4 bg-gray-50 text-sm">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <h4 className="font-semibold mb-2">
                            Customer Details:
                          </h4>
                          <p>
                            <strong>Name:</strong> {order.customer_name}
                          </p>
                          <p>
                            <strong>Email:</strong> {order.customer_email}
                          </p>
                          <p>
                            <strong>Phone:</strong>{" "}
                            {order.customer_phone || "N/A"}
                          </p>
                          <p>
                            <strong>Address:</strong> {order.shipping_address}
                          </p>
                        </div>
                        <div>
                          <h4 className="font-semibold mb-2">
                            Payment Details:
                          </h4>
                          <p>
                            <strong>Status:</strong>{" "}
                            <span className="capitalize">{order.status}</span>
                          </p>
                          <p>
                            <strong>Payment ID:</strong>{" "}
                            {order.payment_intent_id ||
                              "N/A (Cash on Delivery)"}
                          </p>
                        </div>
                      </div>
                      <hr className="my-4" />
                      <h5 className="font-semibold mb-2">Items Ordered:</h5>
                      <ul className="list-disc pl-5 space-y-2">
                        {order.cart_items.map((item, index) => (
                          <li key={item.cartItemId || index}>
                            {item.quantity}x {item.name} -{" "}
                            <strong>
                              ${(item.unitPrice * item.quantity).toFixed(2)}
                            </strong>
                            <div className="text-xs text-gray-500 pl-4">
                              {/* Updated display logic in OrdersPage */}
                              {Object.entries(item.selectedOptions).map(
                                ([group, choice]) => (
                                  <span
                                    key={group}
                                    className="mr-2 font-medium"
                                  >
                                    <span className="capitalize">{group}</span>:{" "}
                                    <span className="text-gray-500 font-normal">
                                      {String(choice)}
                                    </span>
                                  </span>
                                )
                              )}
                              {item.selectedExtras.map((e) => (
                                <span
                                  key={e.extra_id}
                                  className="mr-2 text-blue-600"
                                >
                                  +{e.name}
                                </span>
                              ))}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Form Submissions Tab Content */}
      {activeTab === "forms" && (
        <div className="bg-white p-6 rounded-lg shadow-md">
          {loading && (
            <p className="text-center py-12">Loading submissions...</p>
          )}
          {error && <p className="text-red-500 text-center py-12">{error}</p>}
          {!loading && !error && submissions.length === 0 && (
            <div className="text-center py-12">
              <FileText size={48} className="mx-auto text-gray-400" />
              <h3 className="mt-2 text-xl font-semibold">
                No Form Submissions Yet
              </h3>
              <p className="mt-1 text-gray-500">
                New entries from your website's forms will appear here.
              </p>
            </div>
          )}
          {!loading && !error && submissions.length > 0 && (
            <div className="space-y-3">
              {submissions.map((sub) => (
                <div key={sub.submission_id} className="border rounded-lg">
                  <button
                    onClick={() => toggleItem(sub.submission_id)}
                    className="w-full flex items-center justify-between p-4 text-left"
                  >
                    <div className="flex-1 grid grid-cols-2 gap-4 items-center">
                      <span className="font-semibold truncate">
                        {Object.values(sub.submission_data)[0]}
                      </span>
                      <span className="text-gray-600 text-right">
                        {new Date(sub.created_at).toLocaleString()}
                      </span>
                    </div>
                    <ChevronDown
                      size={20}
                      className={`ml-4 transition-transform ${
                        expandedId === sub.submission_id ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {expandedId === sub.submission_id && (
                    <div className="border-t p-4 bg-gray-50 text-sm">
                      <h4 className="font-semibold mb-2">Submitted Data:</h4>
                      <ul className="space-y-1">
                        {Object.entries(sub.submission_data).map(
                          ([key, value]) => (
                            <li key={key}>
                              <strong>{key}:</strong> {String(value)}
                            </li>
                          )
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
